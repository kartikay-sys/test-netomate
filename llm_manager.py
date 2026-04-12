"""
NetoMate Flow AI — Architecture v3
====================================
LLM-Centric with Full Dataset Injection.

The entire 50-flow dataset is serialized into the prompt.
The LLM reasons over all flows + context in one shot.
Post-processing validates and filters the output.

Supported models:
  - gemini-flash  (Gemini 2.5 Flash — fast, sub-1s)
  - gpt-oss-120b  (GPT OSS 120B via OpenRouter — high reasoning)
"""

import os
import json
import re
import logging
from collections import Counter
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    filename='llm_activity.log',
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataset & Vocabulary
# ---------------------------------------------------------------------------

def load_flows():
    file_path = os.path.join(os.path.dirname(__file__), "synthetic_flows_dataset.json")
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading flows: {e}")
        return []

_flows_cache = None

def get_flows():
    global _flows_cache
    if _flows_cache is None:
        _flows_cache = load_flows()
    return _flows_cache

def build_vocabulary(flows):
    """Extract all known function names from the dataset."""
    vocab = set()
    for flow in flows:
        for fn in flow.get("sequence", []):
            vocab.add(fn)
    return vocab


# ---------------------------------------------------------------------------
# Cold-Start Predictor (no API call)
# ---------------------------------------------------------------------------

class StartPredictor:
    """Frequency-based first-step predictor for empty flows."""

    def __init__(self, flows):
        self._freq = Counter()
        self._cat_freq = {}
        for flow in flows:
            seq = flow.get("sequence", [])
            cat = flow.get("category", "Any")
            if seq:
                self._freq[seq[0]] += 1
                if cat not in self._cat_freq:
                    self._cat_freq[cat] = Counter()
                self._cat_freq[cat][seq[0]] += 1

    def predict(self, category="Any", top_k=3):
        source = self._cat_freq.get(category) if category != "Any" else None
        if not source or len(source) < top_k:
            source = self._freq
        total = sum(source.values())
        results = []
        for fn, count in source.most_common(top_k):
            results.append({
                "function": fn,
                "confidence": min(99, int((count / total) * 100)) if total else 50,
                "explanation": f"Most common starting function ({count} of {total} flows).",
                "occurrences": count,
                "source": "frequency",
                "type": "next"
            })
        return results


# ---------------------------------------------------------------------------
# Feedback Store
# ---------------------------------------------------------------------------

class FeedbackStore:
    def __init__(self, path=None):
        if path is None:
            path = os.path.join(os.path.dirname(__file__), "feedback.json")
        self._path = path
        self._data = self._load()

    def _load(self):
        try:
            with open(self._path, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"clicks": [], "weights": {}}

    def _save(self):
        with open(self._path, "w") as f:
            json.dump(self._data, f, indent=2)

    def record(self, flow_state, suggestions, selected_fn):
        self._data["clicks"].append({
            "flow_state": flow_state,
            "suggestions": [s.get("fn_name", s.get("function", "")) for s in suggestions],
            "selected": selected_fn,
        })
        current = self._data["weights"].get(selected_fn, 0.0)
        self._data["weights"][selected_fn] = current + 1.0
        self._save()
        logger.info(f"Feedback recorded: selected '{selected_fn}'")

    def get_weights(self):
        return self._data.get("weights", {})

feedback_store = FeedbackStore()


# ---------------------------------------------------------------------------
# Input Parsing
# ---------------------------------------------------------------------------

CALL_START_TERMINATE_MAP = {
    "mo_mt_voice_call_start":    "mo_mt_voice_terminate_call",
    "mo_mt_video_call_start":    "mo_mt_video_terminate_call",
    "mo_mt_fw_voice_call_start": "mo_mt_fw_voice_terminate_call",
    "mo_voice_call_start":       "mo_voice_terminate_call",
    "mo_merge_call":             "conference_voice_terminate_call",
}

def detect_category(flow):
    if not flow:
        return "Any"
    has_ui = any(str(f).startswith("epcems_") for f in flow)
    has_mobile = any(not str(f).startswith("epcems_") for f in flow)
    if has_ui and not has_mobile:
        return "UI"
    elif has_mobile and not has_ui:
        return "Mobile"
    return "Hybrid"

def determine_flow_state(current_flow):
    if len(current_flow) == 0:
        return "EMPTY"
    if "pcap_parser" in current_flow:
        return "TEARDOWN"
    for start_fn, term_fn in CALL_START_TERMINATE_MAP.items():
        if start_fn in current_flow and term_fn not in current_flow:
            return "MID_ACTION"
    if any(fn.startswith(("mo_", "epcems_capture_")) for fn in current_flow):
        return "POST_ACTION"
    return "SETUP"


# ---------------------------------------------------------------------------
# Query Preprocessor — Keyword Intelligence Layer
# ---------------------------------------------------------------------------

CATEGORY_KEYWORDS = {
    "mobile": [
        "call", "sms", "speed", "attach", "detach", "radio", "wifi",
        "device", "browsing", "download", "emergency", "helpline",
        "ussd", "voice", "video", "conference", "merge"
    ],
    "ui": [
        "login", "logout", "ems", "capture", "performance", "license",
        "patch", "tal", "peer", "snmp", "alarm", "resource",
        "sls", "monitoring", "subscriber"
    ],
}

PHASE_KEYWORDS = {
    "setup":      ["before", "pre", "initial", "prepare", "configure",
                   "connect", "reset", "preset"],
    "execution":  ["start", "run", "execute", "test", "perform",
                   "make", "do", "begin"],
    "validation": ["during", "while", "check", "verify", "capture",
                   "monitor", "live", "real-time"],
    "analysis":   ["after", "analyze", "logs", "parse", "pcap",
                   "results", "report", "review"],
    "teardown":   ["cleanup", "teardown", "disconnect", "stop",
                   "end", "close", "finish", "release"],
}

# Keywords that enforce epcems_* functions in suggestions
EPCEMS_ENFORCEMENT_KEYWORDS = ["subscriber", "node", "alarm", "snmp",
                                "ems", "peer", "tal", "license", "patch",
                                "sls", "performance", "resource", "monitoring"]


def preprocess_query(query):
    """
    Extract structured metadata from the raw user query.
    Returns: {
        "query_category": "mobile" | "ui" | "hybrid" | "any",
        "query_phase": "setup" | "execution" | "validation" | "analysis" | "teardown",
        "intent_keywords": [...],
        "requires_epcems": bool
    }
    """
    if not query:
        return {
            "query_category": "any",
            "query_phase": "execution",
            "intent_keywords": [],
            "requires_epcems": False,
        }

    q_lower = query.lower()
    words = set(re.findall(r'[a-z]+', q_lower))

    # --- Category Detection ---
    mobile_hits = [kw for kw in CATEGORY_KEYWORDS["mobile"] if kw in words]
    ui_hits = [kw for kw in CATEGORY_KEYWORDS["ui"] if kw in words]

    if mobile_hits and ui_hits:
        query_category = "hybrid"
    elif ui_hits:
        query_category = "ui"
    elif mobile_hits:
        query_category = "mobile"
    else:
        query_category = "any"

    # --- Phase Detection ---
    query_phase = "execution"  # default
    for phase, keywords in PHASE_KEYWORDS.items():
        if any(kw in words for kw in keywords):
            query_phase = phase
            break

    # --- Intent Keywords (union of all hits) ---
    intent_keywords = list(set(mobile_hits + ui_hits +
                               [kw for kw in sum(PHASE_KEYWORDS.values(), []) if kw in words]))

    # --- EPCEMS Enforcement ---
    requires_epcems = any(kw in words for kw in EPCEMS_ENFORCEMENT_KEYWORDS)

    result = {
        "query_category": query_category,
        "query_phase": query_phase,
        "intent_keywords": intent_keywords,
        "requires_epcems": requires_epcems,
    }
    logger.info(f"[Preprocess] {result}")
    return result


def resolve_category(flow_category, query_category):
    """
    Conflict resolution between flow-based and query-based category.
    Rules:
      - query_category == hybrid  → override (user explicitly wants both)
      - query_category == ui      → restrict to epcems_* only
      - else                      → trust the flow_category
    """
    if query_category == "hybrid":
        return "Hybrid"
    if query_category == "ui":
        return "UI"
    return flow_category


def build_temporal_hint(query_phase):
    """
    Temporal decomposition: translate the detected phase into
    an explicit instruction block for the LLM.
    """
    hints = {
        "setup": "TEMPORAL HINT: The user wants PRE-CONDITION steps. "
                 "Prioritize functions that run before the core test action "
                 "(e.g., connect_mobile, check_radio, epcems_login, packet_capture_start).",
        "execution": "",
        "validation": "TEMPORAL HINT: The user wants VALIDATION steps inserted "
                      "after execution begins. Prioritize mid-flow checks "
                      "(e.g., epcems_capture_*, capture_device_health).",
        "analysis": "TEMPORAL HINT: The user wants POST-TEST ANALYSIS steps. "
                    "Prioritize functions like pcap_parser, search_pcap_file, "
                    "fetch_packet_capture_logs, print_results.",
        "teardown": "TEMPORAL HINT: The user wants CLEANUP/TEARDOWN steps. "
                    "Prioritize functions like disconnect_mobile, packet_capture_stop, "
                    "epcems_logout, print_results.",
    }
    return hints.get(query_phase, "")


# ---------------------------------------------------------------------------
# Dataset Serialization
# ---------------------------------------------------------------------------

def serialize_dataset(flows):
    """Serialize all flows into compact single-line format for the prompt."""
    lines = []
    for flow in flows:
        cat = flow.get("category", "?")
        fid = flow.get("flow_id", "?")
        seq = flow.get("sequence", [])
        line = f"[{cat}] {fid}: {' → '.join(seq)}"
        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Prompt Builder
# ---------------------------------------------------------------------------

def build_prompt(serialized_dataset, current_flow, query, category, flow_state,
                 preprocess_result=None):
    query_text = query if query else "(None provided. Please analyze the flow directly.)"

    if query:
        instruction_3_4 = """3. Interpret the engineer's intent from the query.
4. Suggest exactly 5 candidate next functions, ranked by relevance."""
    else:
        instruction_3_4 = """3. Since no query is provided, analyze the current flow. Identify if any crucial prerequisite functions are missing AND identify the logical next functions to continue the flow.
4. Suggest exactly 5 candidate functions (mix of missing prerequisites and next steps), ranked by relevance."""

    # Build optional preprocessing context block
    preprocess_block = ""
    if preprocess_result:
        parts = []
        qc = preprocess_result.get("query_category", "any")
        qp = preprocess_result.get("query_phase", "execution")
        ik = preprocess_result.get("intent_keywords", [])
        parts.append(f"QUERY CATEGORY (from intent): {qc}")
        parts.append(f"QUERY PHASE (from intent): {qp}")
        if ik:
            parts.append(f"INTENT KEYWORDS: {json.dumps(ik)}")
        if preprocess_result.get("requires_epcems"):
            parts.append("ENFORCEMENT: At least one suggestion MUST be an epcems_* function.")

        temporal = build_temporal_hint(qp)
        if temporal:
            parts.append(temporal)

        preprocess_block = "\n".join(parts) + "\n"

    return f"""You are a telecom test automation AI assistant. Below is the complete dataset of {len(get_flows())} benchmark test flows. Study every flow carefully.

=== BENCHMARK DATASET ===
{serialized_dataset}
=== END DATASET ===

CURRENT FLOW: {json.dumps(current_flow)}
FLOW CATEGORY (from sequence): {category}
FLOW STATE (from sequence): {flow_state}
{preprocess_block}USER QUERY: {query_text}

INSTRUCTIONS:
1. Identify which benchmark flows most closely resemble the current flow.
2. Understand what typically follows in those flows.
{instruction_3_4}
5. Only suggest functions that actually appear in the benchmark dataset above.
6. Do NOT suggest functions already present in the current flow.
7. If the flow is UI-only (epcems_*), do not suggest mobile functions, and vice-versa.
8. If the flow state is MID_ACTION, suggest mid-call appropriate functions (e.g., epcems_capture_*), not teardown functions.
9. Ensure your suggestions include at least 1 function aligned with the user's query intent AND at least 1 function that logically continues the current flow sequence.

Return ONLY valid JSON in this exact format:
{{
  "suggestions": [
    {{"function": "function_name", "type": "missing|next", "explanation": "one sentence why (shows relevance)", "confidence": 85}},
    {{"function": "function_name", "type": "missing|next", "explanation": "one sentence why (shows relevance)", "confidence": 75}},
    {{"function": "function_name", "type": "missing|next", "explanation": "one sentence why (shows relevance)", "confidence": 65}},
    {{"function": "function_name", "type": "missing|next", "explanation": "one sentence why (shows relevance)", "confidence": 55}},
    {{"function": "function_name", "type": "missing|next", "explanation": "one sentence why (shows relevance)", "confidence": 45}}
  ]
}}"""


# ---------------------------------------------------------------------------
# LLM Callers
# ---------------------------------------------------------------------------

def call_gpt_oss_120b(prompt):
    """Call GPT OSS 120B via OpenRouter — high reasoning."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        logger.warning("[OSS-120B] OPENROUTER_API_KEY missing")
        return None

    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        logger.info("[OSS-120B] Calling GPT OSS 120B via OpenRouter...")

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "You are a telecom test automation AI. Respond ONLY with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )

        result_text = response.choices[0].message.content
        logger.info(f"[OSS-120B] Response received ({len(result_text)} chars)")
        return _parse_llm_response(result_text)
    except Exception as e:
        logger.error(f"[OSS-120B] Call failed: {e}")
        return None


def _parse_llm_response(text):
    """Robust JSON extraction from LLM output."""
    try:
        # Try direct parse
        data = json.loads(text)
        if isinstance(data, dict) and "suggestions" in data:
            return data["suggestions"]
        if isinstance(data, list):
            return data
        return [data]
    except json.JSONDecodeError:
        pass

    # Try regex extraction
    json_match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
    if json_match:
        try:
            clean = json_match.group(1).replace('```json', '').replace('```', '')
            data = json.loads(clean)
            if isinstance(data, dict) and "suggestions" in data:
                return data["suggestions"]
            if isinstance(data, list):
                return data
            return [data]
        except json.JSONDecodeError:
            pass

    logger.error(f"Failed to parse LLM response: {text[:200]}")
    return None


# ---------------------------------------------------------------------------
# Post-Processing Pipeline
# ---------------------------------------------------------------------------

def post_process(raw_suggestions, current_flow, category, feedback_weights,
                 known_vocab, preprocess_result=None):
    """
    Pipeline:
    1. Vocabulary validation
    2. Remove already-in-flow
    3. Category boundary enforcement
    4. Confidence threshold (> 5%)
    5. Apply feedback click weights
    6. EPCEMS enforcement (if intent requires it)
    7. Smart output control (intent-aligned + flow-aligned balance)
    """
    if not raw_suggestions:
        return []

    current_set = set(current_flow)
    processed = []

    for s in raw_suggestions:
        if not isinstance(s, dict):
            continue

        fn = s.get("function", "")
        confidence = s.get("confidence", 50)
        explanation = s.get("explanation", "")
        suggestion_type = s.get("type", "next")

        # 1. Vocabulary check — reject hallucinated names
        if fn not in known_vocab:
            logger.info(f"[PostProcess] Rejected hallucinated fn: {fn}")
            continue

        # 2. Remove functions already in flow
        if fn in current_set:
            continue

        # 3. Category boundary enforcement
        if category == "UI" and not fn.startswith("epcems_"):
            continue
        if category == "Mobile" and fn.startswith("epcems_"):
            continue

        # 4. Confidence threshold
        if confidence <= 5:
            continue

        # 5. Feedback weight boost
        boost = feedback_weights.get(fn, 0)
        if boost > 0:
            confidence = min(99, confidence + int(boost * 3))

        processed.append({
            "function": fn,
            "type": suggestion_type,
            "confidence": confidence,
            "explanation": explanation,
            "occurrences": 0,
            "source": "llm"
        })

    # --- 6. EPCEMS Enforcement ---
    requires_epcems = preprocess_result.get("requires_epcems", False) if preprocess_result else False
    if requires_epcems:
        has_epcems = any(s["function"].startswith("epcems_") for s in processed)
        if not has_epcems:
            # Force-inject the highest-confidence epcems function from raw pool
            for s in raw_suggestions:
                if not isinstance(s, dict):
                    continue
                fn = s.get("function", "")
                if fn.startswith("epcems_") and fn in known_vocab and fn not in current_set:
                    processed.append({
                        "function": fn,
                        "type": "missing",
                        "confidence": s.get("confidence", 60),
                        "explanation": s.get("explanation", "Required by query intent (enforcement)."),
                        "occurrences": 0,
                        "source": "llm"
                    })
                    logger.info(f"[PostProcess] EPCEMS enforcement injected: {fn}")
                    break

    # --- 7. Smart Output Control ---
    # Don't blindly take top 3. Ensure balance:
    #   - At least 1 intent-aligned suggestion
    #   - At least 1 flow-continuation suggestion
    return _balance_output(processed, preprocess_result)


def _balance_output(processed, preprocess_result, max_results=3):
    """
    Ensure the final output has:
      - At least 1 suggestion that aligns with the user's query intent
      - At least 1 suggestion that aligns with flow continuation (type=next)
    Falls back to simple top-N if there aren't enough candidates.
    """
    if len(processed) <= max_results:
        return processed

    intent_keywords = (preprocess_result or {}).get("intent_keywords", [])

    # Classify each suggestion
    intent_aligned = []
    flow_aligned = []
    other = []

    for s in processed:
        fn_lower = s["function"].lower()
        exp_lower = s.get("explanation", "").lower()

        # Check if suggestion matches any intent keyword
        matches_intent = any(kw in fn_lower or kw in exp_lower for kw in intent_keywords)

        if matches_intent:
            intent_aligned.append(s)
        elif s.get("type") == "next":
            flow_aligned.append(s)
        else:
            other.append(s)

    # Build balanced output
    final = []

    # Guarantee at least 1 intent-aligned
    if intent_aligned:
        final.append(intent_aligned.pop(0))

    # Guarantee at least 1 flow-continuation
    if flow_aligned and len(final) < max_results:
        final.append(flow_aligned.pop(0))

    # Fill remaining slots by confidence (from all remaining)
    remaining = intent_aligned + flow_aligned + other
    remaining.sort(key=lambda s: s.get("confidence", 0), reverse=True)

    for s in remaining:
        if len(final) >= max_results:
            break
        if s not in final:
            final.append(s)

    return final


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------

# Engine caches
_start_predictor = None
_known_vocab = None
_serialized_dataset = None

def _init_caches():
    global _start_predictor, _known_vocab, _serialized_dataset
    flows = get_flows()
    if _start_predictor is None:
        _start_predictor = StartPredictor(flows)
    if _known_vocab is None:
        _known_vocab = build_vocabulary(flows)
    if _serialized_dataset is None:
        _serialized_dataset = serialize_dataset(flows)


# Model dispatch table
MODEL_CALLERS = {
    "gpt-oss-120b": call_gpt_oss_120b,
}

# Display names for logging
MODEL_NAMES = {
    "gpt-oss-120b": "GPT OSS 120B (OpenRouter)",
}


def get_suggestions(query, current_flow, model="gpt-oss-120b"):
    """
    Main entry point — Architecture v3 with Preprocessing Intelligence.

    Pipeline:
      1. Preprocess query → extract intent, query_category, query_phase
      2. Detect flow_category and flow_state from sequence
      3. Resolve conflicts between query vs flow signals
      4. Build enriched prompt (with temporal hints + enforcement)
      5. Call LLM (with fallback)
      6. Post-process with smart output control
    """
    logger.info("=" * 50)
    logger.info(f"[v3] NEW REQUEST — Model: {model}")
    logger.info(f"[v3] Query: '{query}'")
    logger.info(f"[v3] Current Flow ({len(current_flow)} steps): {current_flow}")

    _init_caches()

    # --- Step 1: Preprocess the query ---
    preprocess_result = preprocess_query(query)

    # --- Step 2: Flow-based detection ---
    flow_category = detect_category(current_flow)
    flow_state = determine_flow_state(current_flow)
    logger.info(f"[v3] Flow Category: {flow_category} | State: {flow_state}")

    # --- Step 3: Conflict resolution ---
    resolved_category = resolve_category(flow_category, preprocess_result["query_category"])
    logger.info(f"[v3] Resolved Category: {resolved_category} "
                f"(flow={flow_category}, query={preprocess_result['query_category']})")

    # Cold-start bypass — no API call needed
    if flow_state == "EMPTY":
        logger.info("[v3] Cold start — using StartPredictor (no API call)")
        suggestions = _start_predictor.predict(category=resolved_category, top_k=3)
        return {
            "suggestions": suggestions,
            "raw_llm_output": "Cold Start — Frequency-based (no LLM call)",
            "engine_path": "cold_start",
            "model_used": "none (frequency)",
            "preprocessing": preprocess_result
        }

    # --- Step 4: Build enriched prompt ---
    prompt = build_prompt(
        _serialized_dataset, current_flow, query,
        resolved_category, flow_state,
        preprocess_result=preprocess_result
    )
    logger.info(f"[v3] Prompt size: ~{len(prompt.split())} words")

    # --- Step 5: Call LLM ---
    model_key = "gpt-oss-120b"
    caller = MODEL_CALLERS[model_key]
    model_display = MODEL_NAMES.get(model_key, model_key)

    raw_suggestions = caller(prompt)
    source_label = model_key

    if raw_suggestions is None:
        return {"error": "All LLM providers failed", "status": 500}

    # --- Step 6: Post-process with smart output control ---
    feedback_weights = feedback_store.get_weights()
    suggestions = post_process(
        raw_suggestions, current_flow, resolved_category,
        feedback_weights, _known_vocab,
        preprocess_result=preprocess_result
    )

    # Tag each suggestion with the model source
    for s in suggestions:
        s["source"] = source_label

    logger.info(f"[v3] Final suggestions ({source_label}): {[s['function'] for s in suggestions]}")

    return {
        "suggestions": suggestions,
        "raw_llm_output": f"Architecture v3 — {model_display}",
        "engine_path": "llm_full_dataset",
        "model_used": model_display,
        "preprocessing": preprocess_result
    }
