# NetoMate Flow AI — Progress Report

## Project Overview

NetoMate Flow AI is an intelligent suggestion engine for telecom test automation. It assists engineers by recommending the next logical function to add to their test scripts, based on a curated dataset of 50 benchmark test flows and natural language queries.

---

## Architecture Evolution

### v1 — LLM Monolithic (Baseline)
- Single Gemini API call per request.
- No dataset awareness — the LLM guessed functions with zero reference material.
- High hallucination rate, inconsistent quality.
- **Latency**: 2–5 seconds.

### v2 — Constraint-Driven Layered Engine
- Introduced a 6-layer architecture: Input Parser → Intent Classifier → Core Engines → LLM Reranker → Feedback Loop → Output Formatter.
- Three math-based engines replaced the LLM for most queries:
  - **E1 (Start Predictor)**: Frequency-based first-step suggestions.
  - **E2 (Markov Chain)**: Order-2 Markov with trigram/bigram/unigram backoff.
  - **E3 (Embedding Retriever)**: TF-IDF / Sentence-Transformer semantic similarity.
- LLM used only for ~8% of queries (Reasoning intent).
- **Latency**: 150–300ms (deterministic), 2–5s (reasoning path).

### v3 — LLM-Centric with Full Dataset Injection *(Current)*
- Complete architectural shift: the entire 50-flow benchmark dataset is serialized and injected directly into the LLM prompt.
- The LLM receives full visibility of all known test patterns and reasons over them alongside the user's current flow and query.
- Dual-model support with a user-facing model selector in the UI.
- Robust post-processing pipeline validates all outputs against the known function vocabulary.
- **Latency**: Sub-1s (Gemini Flash), ~2 min (GPT OSS 120B).

---

## What Was Implemented in v3

### 1. Full Dataset Serialization
All 50 benchmark flows from `synthetic_flows_dataset.json` are converted into a compact, single-line format and placed inside the LLM prompt:

```
[Mobile] flow_3: search_pcap_file → reset_all_mobiles → connect_mobile → ...
[UI] flow_24: epcems_login → epcems_capture_node_alarms → ...
[Hybrid] flow_31: search_pcap_file → reset_all_mobiles → connect_mobile → ...
```

This gives the AI complete context (~3,000 tokens) to identify matching patterns and reason about what comes next.

### 2. Dual-Model Integration
Two LLM providers were integrated, selectable by the user at runtime:

| Model | Provider | Strengths | Latency |
|-------|----------|-----------|---------|
| **Gemini 2.5 Flash** | Google Generative AI | Fast, low-cost, reliable JSON output | Sub-1 second |
| **GPT OSS 120B** | OpenRouter | Deep reasoning, 117B MoE architecture | ~2 minutes |

Automatic fallback is built in — if the selected model fails, the system retries with the other.

### 3. Cold-Start Bypass
When the flow is empty (`step_count == 0`), the system skips the LLM entirely and uses a data-driven `StartPredictor` that returns the most common starting functions from the dataset. This ensures:
- Zero latency for new flows.
- Zero API cost for cold starts.

### 4. Post-Processing Pipeline
Every LLM response passes through a 5-stage validation pipeline before reaching the user:

| Stage | Action |
|-------|--------|
| 1. Vocabulary Check | Reject any function name not found in the benchmark dataset |
| 2. Deduplication | Remove functions already present in the current flow |
| 3. Category Filter | Enforce UI/Mobile/Hybrid boundaries |
| 4. Confidence Threshold | Drop candidates with confidence ≤ 5% |
| 5. Feedback Weighting | Boost functions the user has previously clicked |

### 5. UI Enhancements
- **Model Selector Dropdown**: Added to the AI Assistant panel, allowing real-time switching between Gemini Flash and GPT OSS 120B.
- **Model-Used Badge**: Displays which model generated the current suggestions.
- **Engine Path Indicator**: Shows whether the response came from Cold Start (frequency) or Full-Dataset LLM Reasoning.
- **Architecture Badge**: Header updated from "v2 — Constraint-Driven" to "v3 — LLM-Centric".

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Engineer Query                        │
│              query + current_flow + model                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   Layer 0: Parser    │
          │  category, state,    │
          │  step_count          │
          └──────────┬───────────┘
                     │
          ┌──────────▼───────────┐     ┌──────────────────┐
          │ step_count == 0?     │────▶│ StartPredictor   │
          │ (Cold Start)         │ YES │ (frequency, no   │
          └──────────┬───────────┘     │  API call)       │
                     │ NO              └────────┬─────────┘
                     ▼                          │
          ┌──────────────────────┐              │
          │  Serialize Dataset   │              │
          │  50 flows → compact  │              │
          │  single-line format  │              │
          └──────────┬───────────┘              │
                     │                          │
                     ▼                          │
          ┌──────────────────────┐              │
          │  Model Dispatcher    │              │
          │  (user's choice)     │              │
          ├──────────┬───────────┤              │
          │          │           │              │
          ▼          ▼           │              │
   ┌───────────┐ ┌────────────┐ │              │
   │  Gemini   │ │  GPT OSS   │ │              │
   │  2.5      │ │  120B      │ │              │
   │  Flash    │ │ (OpenRouter)│ │              │
   └─────┬─────┘ └──────┬─────┘ │              │
         │               │       │              │
         └───────┬───────┘       │              │
                 ▼               │              │
          ┌──────────────────────┘              │
          │  5 Raw Candidates                   │
          └──────────┬─────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Post-Processing     │
          │  • Vocab validation  │
          │  • Deduplication     │
          │  • Category filter   │
          │  • Confidence > 5%   │
          │  • Feedback weights  │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Top 3 Suggestions   │
          │  → UI Render         │
          └──────────────────────┘
```

---

## File Structure

| File | Role |
|------|------|
| `llm_manager.py` | v3 core engine: serialization, LLM calls, post-processing |
| `app.py` | Flask API server (`/api/suggest`, `/api/feedback`) |
| `templates/index.html` | Frontend UI with model selector |
| `static/script.js` | Frontend logic, API calls, suggestion rendering |
| `static/style.css` | Dark-mode UI styling |
| `synthetic_flows_dataset.json` | 50 benchmark test flows (the knowledge base) |
| `feedback.json` | User click history for feedback weighting |
| `suggestion_engine_v2_archived.py` | Archived v2 engine (Markov + Embeddings) |
| `.env` | API keys (GEMINI_API_KEY, OPENROUTER_API_KEY) |

---

## Sustainability Assessment

| Factor | Status |
|--------|--------|
| **Token Usage** | ~3,500 tokens/request (dataset + context). Well within 128K+ model limits. |
| **Cost per Request** | ~$0.007 (Gemini Flash). GPT OSS 120B is higher but optional. |
| **Cold Start Cost** | $0 (no API call). |
| **Scalability** | Sustainable up to ~150 flows. Beyond that, pre-filtering by category is recommended. |
| **Accuracy** | Higher than v2 — the LLM sees all patterns, not just Markov approximations. |
| **Hallucination Risk** | Mitigated by vocabulary validation in post-processing. |

---

## How to Run

```bash
# Install dependencies
pip install flask google-genai openai python-dotenv

# Set API keys in .env
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key

# Start the server
python app.py
# → http://127.0.0.1:1947
```
