from flask import Flask, request, jsonify, render_template
from llm_manager import get_suggestions, feedback_store

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/suggest', methods=['POST'])
def suggest():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400
        
    query = data.get('query', '')
    current_flow = data.get('current_flow', [])
        
    result = get_suggestions(query, current_flow)
    
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

if __name__ == '__main__':
    app.run(debug=True, port=1947)
