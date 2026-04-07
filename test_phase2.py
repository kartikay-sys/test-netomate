import requests, json

print("Testing T1 - Mid-action capture intent")
r = requests.post('http://127.0.0.1:1947/api/suggest', json={
    'query': 'capture now',
    'current_flow': ['connect_mobile', 'mo_mt_voice_call_start', 'check_radio']
})
d = r.json()
print("Engine path:", d.get('engine_path'))
for s in d.get('suggestions', []):
    print(f"  {s['function']} ({s['source']}, {s['confidence']}%)")

print("\nTesting T2 - Teardown / Backfill threshold (should trigger > 5% filter)")
r = requests.post('http://127.0.0.1:1947/api/suggest', json={
    'query': 'next step',
    # A random flow to test Markov backfills
    'current_flow': ['epcems_login']
})
d = r.json()
print("Engine path:", d.get('engine_path'))
for s in d.get('suggestions', []):
    print(f"  {s['function']} ({s['source']}, {s['confidence']}%)")
