import os
import json
from flask import Flask, request, jsonify, render_template
from werkzeug.security import check_password_hash
from llm_manager import get_suggestions, feedback_store, generate_flow_summary

app = Flask(__name__)

SESSIONS_FILE = os.path.join(os.path.dirname(__file__), "sessions.json")
USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "progress.json")

def load_sessions():
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_sessions(sessions_data):
    with open(SESSIONS_FILE, "w") as f:
        json.dump(sessions_data, f, indent=2)

def load_users():
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_progress_data(progress_data):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress_data, f, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    user_id = data.get('user_id', '').strip()
    password = data.get('password', '')

    if not user_id or not password:
        return jsonify({"error": "User ID and password are required"}), 400

    users = load_users()
    user = users.get(user_id)

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"status": "ok", "user_id": user_id, "name": user.get("name", user_id)})

@app.route('/api/suggest', methods=['POST'])
def suggest():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400
        
    query = data.get('query', '')
    current_flow = data.get('current_flow', [])
    use_memory = data.get('use_memory', True)
    session_log = data.get('session_log', [])
        
    result = get_suggestions(query, current_flow, use_memory=use_memory, session_log=session_log)
    
    if "error" in result:
        return jsonify(result), result.get("status", 500)
        
    return jsonify(result)

@app.route('/api/feedback', methods=['POST'])
def feedback():
    """Record which suggestion the user selected."""
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    flow_state = data.get('flow_state', [])
    suggestions = data.get('suggestions', [])
    selected_fn = data.get('selected_fn', '')

    if not selected_fn:
        return jsonify({"error": "selected_fn is required"}), 400

    feedback_store.record(flow_state, suggestions, selected_fn)
    return jsonify({"status": "ok"})

@app.route('/api/save_progress', methods=['POST'])
def save_progress():
    """Auto-save in-progress state (query + flow steps) for resume on next login."""
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    user_id = data.get('user_id')
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    progress = load_progress()
    progress[user_id] = {
        "query": data.get('query', ''),
        "flow_steps": data.get('flow_steps', [])
    }
    save_progress_data(progress)
    return jsonify({"status": "ok"})

@app.route('/api/save_session', methods=['POST'])
def save_session():
    data = request.json
    user_id = data.get('user_id')
    flow_steps = data.get('flow_steps', [])
    query = data.get('query', '')
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    if not flow_steps:
        return jsonify({"error": "flow_steps cannot be empty"}), 400

    sessions = load_sessions()
    
    # sessions[user_id] is now a list of past flows
    user_history = sessions.get(user_id, [])
    if isinstance(user_history, dict):
        # Migrate old format to list
        user_history = [user_history]
    elif not isinstance(user_history, list):
        user_history = []
    
    # Always generate a summary for a finished flow
    summary = generate_flow_summary(flow_steps)

    user_history.insert(0, {
        "flow": flow_steps,
        "query": query,
        "summary": summary
    })
    
    # Keep only the last 10
    sessions[user_id] = user_history[:10]
    
    save_sessions(sessions)

    # Keep the finished flow as last progress so resume works after logout
    progress = load_progress()
    progress[user_id] = {
        "query": query,
        "flow_steps": flow_steps
    }
    save_progress_data(progress)

    return jsonify({"status": "ok", "summary": summary})

@app.route('/api/get_session', methods=['GET'])
def get_session():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
        
    # Get in-progress state
    progress = load_progress()
    last_progress = progress.get(user_id, None)

    # Get completed flow history
    sessions = load_sessions()
    user_history = sessions.get(user_id, [])
    if isinstance(user_history, dict):
        user_history = [user_history]
    elif not isinstance(user_history, list):
        user_history = []
    
    return jsonify({
        "status": "ok",
        "last_progress": last_progress,
        "history": user_history
    })

if __name__ == '__main__':
    app.run(debug=True, port=1947)
