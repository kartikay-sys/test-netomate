import json
import os
from app import set_user_progress, get_user_progress, fallback_progress

# Test data
user_id = "test_persistence"
query = "test query"
steps = ["step1", "step2"]

print("Initial fallback_progress:", fallback_progress.get(user_id))

# Set progress (this should save to progress.json)
set_user_progress(user_id, query, steps)
print(f"Set progress for {user_id}")

# Check if it was saved to file
if os.path.exists("progress.json"):
    with open("progress.json", "r") as f:
        data = json.load(f)
        print("Data in progress.json for user:", data.get(user_id))

# Simulate restart by clearing memory
import app
app.fallback_progress = {}
print("Cleared in-memory progress.")

# Reload from file (simulate app start)
app.fallback_progress = app.load_progress_from_file()
reloaded = get_user_progress(user_id)
print("Reloaded progress:", reloaded)

if reloaded and reloaded['query'] == query:
    print("SUCCESS: Persistence working!")
else:
    print("FAILURE: Persistence failed.")
