Requirements

You’ll be working on improving our test flow system.

I’ll share 3–4 existing flows. Your first task is to understand these flows properly — how functions are sequenced and how different steps relate to each other.

After that, categorize each flow into:
	•	UI flows (EPC/EMS related)
	•	Mobile flows
	•	Hybrid flows (Mobile + UI)

Next, build a suggestion system with the following logic:
	•	Input: user query (in natural language) + current flow
	•	Output: top 3 suggested functions

Requirements:
	•	Suggestions should be relevant to the query
	•	Suggestions should be based on patterns observed in existing flows
	•	Do NOT suggest functions that are already present in the current flow
	•	Suggestions should not be directly obvious from the flow — they should be useful additions or improvements
	•	Maintain logical consistency (e.g., validation, cleanup, enhancement steps)

Example:
If flow has:
connect_mobile → mo_voice_call_start

And user query is:
“improve this test”

Then suggestions can be:
	•	capture_device_health
	•	mo_speed_test
	•	print_results

(not repeating existing steps)


