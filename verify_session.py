import sys
sys.path.insert(0, r"e:\NETOMATE")
from llm_manager import post_process, build_vocabulary, get_flows, distill_session, _init_caches

flows = get_flows()
vocab = build_vocabulary(flows)
_init_caches()

def test_empty_session():
    suppress, boost, hint = distill_session(None)
    assert len(suppress) == 0
    assert len(boost) == 0
    assert hint == ""
    print("[PASS] Empty session gracefully falls through")

def test_suppress_all():
    suppress = {"connect_mobile", "check_radio", "epcems_login"}
    raw = [
        {"function": "connect_mobile", "confidence": 80, "type": "next"},
        {"function": "check_radio", "confidence": 70, "type": "next"},
        {"function": "epcems_login", "confidence": 60, "type": "next"},
    ]
    result = post_process(raw, [], "Any", {}, vocab, suppression_list=suppress)
    print(f"Result count when all suppressed: {len(result)}")
    if len(result) == 3:
         print("[PASS] Backfill from Predictor successfully supplied 3 fallbacks.")
    else:
         print("[WARNING] Zero results returned when all suppressed (no backfill currently exists in code).")

test_empty_session()
test_suppress_all()
