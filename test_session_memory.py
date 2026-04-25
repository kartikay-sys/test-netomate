"""
Verification of session memory v2 — soft-preference engine.
Tests decay, demotion (not elimination), and fallback guarantee.
"""
import sys
sys.path.insert(0, r"e:\NETOMATE")

from llm_manager import (
    distill_session, post_process, build_vocabulary, get_flows,
    _same_category, _build_suppression_scores,
    _SUPPRESS_PENALTY_MAX, _SUPPRESS_PENALTY_MIN, _SUPPRESS_RECENCY_WINDOW
)

flows = get_flows()
vocab = build_vocabulary(flows)

# ---------------------------------------------------------------
# Test 1: Empty session = total no-op
# ---------------------------------------------------------------
result = distill_session([], ["connect_mobile"], "test")
assert result["suppression_scores"] == {}
assert result["boost_list"] == set()
assert result["micro_hint"] == ""
print("[PASS] Test 1: Empty session = clean no-op")

# ---------------------------------------------------------------
# Test 2: Accepted functions land in boost_list
# ---------------------------------------------------------------
session = [
    {"time": "09:43", "action": "action-add", "text": "Accepted: <strong>connect_mobile</strong>"},
    {"time": "09:45", "action": "action-add", "text": "Accepted: <strong>check_radio</strong>"},
]
result = distill_session(session, ["connect_mobile", "check_radio"], "improve")
assert "connect_mobile" in result["boost_list"]
assert "check_radio" in result["boost_list"]
assert result["suppression_scores"] == {}
print("[PASS] Test 2: Accepted functions in boost_list")

# ---------------------------------------------------------------
# Test 3: Ignored functions get penalty scores (not a flat set)
# ---------------------------------------------------------------
session = [
    {"time": "09:43", "action": "action-rejected", "text": "Ignored: epcems_login, mo_speed_test"},
]
result = distill_session(session, ["connect_mobile"], "improve")
assert "epcems_login" in result["suppression_scores"]
assert "mo_speed_test" in result["suppression_scores"]
assert result["suppression_scores"]["epcems_login"] == _SUPPRESS_PENALTY_MAX  # single event = max
print("[PASS] Test 3: Ignored functions get penalty scores")

# ---------------------------------------------------------------
# Test 4: Recency decay — older ignores get weaker penalties
# ---------------------------------------------------------------
events = [
    ["fn_old_1"],       # oldest
    ["fn_mid_1"],       # middle
    ["fn_recent_1"],    # most recent
]
scores = _build_suppression_scores(events, set())
assert scores["fn_old_1"] < scores["fn_recent_1"], "Older should have weaker penalty"
assert scores["fn_old_1"] == _SUPPRESS_PENALTY_MIN
assert scores["fn_recent_1"] == _SUPPRESS_PENALTY_MAX
print(f"[PASS] Test 4: Decay works (old={scores['fn_old_1']}, recent={scores['fn_recent_1']})")

# ---------------------------------------------------------------
# Test 5: Only last N events matter (recency window)
# ---------------------------------------------------------------
many_events = [["fn_ancient"]] + [["fn_filler"]] * (_SUPPRESS_RECENCY_WINDOW + 5)
scores = _build_suppression_scores(many_events, set())
assert "fn_ancient" not in scores, "Ancient events should be forgotten"
print("[PASS] Test 5: Events beyond recency window are forgotten")

# ---------------------------------------------------------------
# Test 6: Accepted overrides ignored (user changed mind)
# ---------------------------------------------------------------
session = [
    {"time": "09:43", "action": "action-rejected", "text": "Ignored: epcems_login"},
    {"time": "09:45", "action": "action-add", "text": "Accepted: <strong>epcems_login</strong>"},
]
result = distill_session(session, ["connect_mobile", "epcems_login"], "test")
assert "epcems_login" not in result["suppression_scores"]
assert "epcems_login" in result["boost_list"]
print("[PASS] Test 6: Accepted overrides ignored")

# ---------------------------------------------------------------
# Test 7: Context-aware reset — EMS query clears epcems_ penalties
# ---------------------------------------------------------------
session = [
    {"time": "09:43", "action": "action-rejected", "text": "Ignored: epcems_login, mo_speed_test"},
]
result = distill_session(session, ["connect_mobile"], "add EMS monitoring")
assert "epcems_login" not in result["suppression_scores"]
assert "mo_speed_test" in result["suppression_scores"]
print("[PASS] Test 7: Context-aware reset works")

# ---------------------------------------------------------------
# Test 8: Hybrid flow clears all penalties
# ---------------------------------------------------------------
session = [
    {"time": "09:43", "action": "action-rejected", "text": "Ignored: epcems_login, mo_speed_test"},
]
result = distill_session(session, ["connect_mobile", "epcems_login"], "test")
assert len(result["suppression_scores"]) == 0
print("[PASS] Test 8: Hybrid flow clears all penalties")

# ---------------------------------------------------------------
# Test 9: Micro-hint generation
# ---------------------------------------------------------------
session = [
    {"time": "09:43", "action": "action-add", "text": "Accepted: <strong>connect_mobile</strong>"},
    {"time": "09:44", "action": "action-query", "text": 'Asked: "<strong>add validation</strong>"'},
    {"time": "09:45", "action": "action-add", "text": "Accepted: <strong>check_radio</strong>"},
]
result = distill_session(session, ["connect_mobile", "check_radio"], "improve")
assert "mobile" in result["micro_hint"].lower()
assert "add validation" in result["micro_hint"]
print(f"[PASS] Test 9: Micro-hint = '{result['micro_hint']}'")

# ---------------------------------------------------------------
# Test 10: post_process DEMOTES (not eliminates) suppressed fns
# ---------------------------------------------------------------
raw = [
    {"function": "connect_mobile", "confidence": 80, "type": "next", "explanation": "test"},
    {"function": "check_radio", "confidence": 70, "type": "next", "explanation": "test"},
    {"function": "epcems_login", "confidence": 60, "type": "next", "explanation": "test"},
]
result = post_process(raw, [], "Any", {}, vocab,
                      suppression_scores={"epcems_login": 25})
fns = [s["function"] for s in result]
# epcems_login should STILL be present, but with reduced confidence
assert "epcems_login" in fns, "Suppressed fn should still appear (demoted, not removed)"
epcems_entry = [s for s in result if s["function"] == "epcems_login"][0]
assert epcems_entry["confidence"] == 35, f"Expected 60-25=35, got {epcems_entry['confidence']}"
print("[PASS] Test 10: Suppressed fn DEMOTED to 35% (not eliminated)")

# ---------------------------------------------------------------
# Test 11: post_process WITHOUT session memory = identical
# ---------------------------------------------------------------
result_without = post_process(raw, [], "Any", {}, vocab)
result_with_none = post_process(raw, [], "Any", {}, vocab,
                                suppression_scores=None, boost_list=None)
assert [s["function"] for s in result_without] == [s["function"] for s in result_with_none]
print("[PASS] Test 11: No session memory = identical (zero regressions)")

# ---------------------------------------------------------------
# Test 12: Heavily suppressed fns still appear (never removed)
# ---------------------------------------------------------------
raw_heavy = [
    {"function": "connect_mobile", "confidence": 30, "type": "next", "explanation": "test"},
    {"function": "check_radio", "confidence": 25, "type": "next", "explanation": "test"},
    {"function": "epcems_login", "confidence": 20, "type": "next", "explanation": "test"},
]
result = post_process(raw_heavy, [], "Any", {}, vocab,
                      suppression_scores={"connect_mobile": 25, "check_radio": 25, "epcems_login": 25})
# All should survive with minimum confidence of 6
assert len(result) == 3, f"Expected 3 results (fallback guarantee), got {len(result)}"
for s in result:
    assert s["confidence"] >= 6, f"{s['function']} confidence too low: {s['confidence']}"
print("[PASS] Test 12: All fns survive even with max suppression (floor=6%)")

# ---------------------------------------------------------------
# Test 13: Boost does NOT apply to demoted functions
# ---------------------------------------------------------------
raw_mixed = [
    {"function": "connect_mobile", "confidence": 80, "type": "next", "explanation": "test"},
    {"function": "check_radio", "confidence": 70, "type": "next", "explanation": "test"},
]
result = post_process(raw_mixed, [], "Any", {}, vocab,
                      suppression_scores={"connect_mobile": 15},
                      boost_list={"check_radio"})
cm = [s for s in result if s["function"] == "connect_mobile"][0]
cr = [s for s in result if s["function"] == "check_radio"][0]
assert cm["confidence"] == 65, f"connect_mobile should be 80-15=65, got {cm['confidence']}"
assert cr["confidence"] == 75, f"check_radio should be 70+5=75, got {cr['confidence']}"
print("[PASS] Test 13: Boost skips demoted fns, applies to others")


print("\n" + "=" * 55)
print("ALL 13 TESTS PASSED")
print("Session memory is now a SOFT-PREFERENCE engine.")
print("  - Suppression DEMOTES, never eliminates")
print("  - Recency decay weakens old penalties")
print("  - Fallback guarantee: always returns results")
print("=" * 55)
