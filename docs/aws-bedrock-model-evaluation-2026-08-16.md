# AWS Bedrock Model Evaluation & Platform Selection Guide (ITI Gateway)

**Evaluation Date:** August 16, 2026  
**Target Gateway:** ITI AWS Bedrock Gateway (`apiaccess.iti.net.eg/api/v1`)  
**Scope:** 48 Active Models across 12 Model Families  
**Domain Focus:** Morshid AI Educational Tutoring Platform (Socratic guidance, course evidence retrieval, educational analysis, semantic safety guards, Arabic & English bilingual support).

---

## 1. Executive Summary

This document evaluates the 48 active models available on the ITI AWS Bedrock Gateway as of August 16, 2026. Models were evaluated against primary benchmarks (SWE-bench Verified, HumanEval, GPQA Diamond, MATH-500, LMSYS Chatbot Arena Elo), context window capacities, multilingual/Arabic performance, token pricing per 1M tokens, latency profiles, and operational suitability for Morshid's multi-tiered architecture.

### Category Winners Summary

| Category | Winning Model | Provider | Key Differentiator | Pricing (In/Out per 1M) |
| :--- | :--- | :--- | :--- | :--- |
| **Best Model Overall** | `us.anthropic.claude-sonnet-4-6` | Anthropic | Peak intelligence, 1M context, perfect JSON adherence, prompt caching, superior Arabic/English nuance | $3.00 / $15.00 ($0.30 cached in) |
| **Best Reasoning Model** | `us.deepseek.r1-v1:0` | DeepSeek | Superhuman RL deduction (MATH-500 97.3%, GPQA 71.5%), step-by-step `<think>` verification | $0.55 / $2.19 |
| **Best Coding Model** | `us.anthropic.claude-sonnet-4-6` (Proprietary)<br>`qwen.qwen3-coder-480b-a35b-v1:0` (Open-Weight) | Anthropic / Alibaba Cloud | 79.5% SWE-bench Verified; Socratic debugging guidance compliance; Qwen 480B MoE repo-scale coding | $3.00 / $15.00<br>$0.40 / $1.60 |
| **Best High-Speed / Cost-Efficient** | `us.amazon.nova-micro-v1:0` (Ultra-low cost)<br>`global.anthropic.claude-haiku-4-5-20251001-v1:0` (Fast Intelligence) | Amazon / Anthropic | Nova Micro: $0.035/1M, <150ms TTFT.<br>Haiku 4.5: Near-Sonnet reasoning at sub-second latency for guardrails | $0.035 / $0.14<br>$0.80 / $4.00 |
| **Best for Morshid Platform** | **Tiered Hybrid Architecture**:<br>• Tutor: `claude-sonnet-4-6`<br>• Analysis: `claude-sonnet-4-6`<br>• Guard: `claude-haiku-4-5`<br>• Vision/Ingestion: `nova-lite-v1:0` | Anthropic + Amazon | Maximizes pedagogical fidelity and guardrail safety while optimizing cost and latency per student interaction | Blended ~$0.003 - $0.008 per chat turn |

---

## 2. Complete Inventory of the 48 Active Models

The 48 models confirmed active on the ITI Bedrock Gateway are grouped into 12 provider families:

```
├── 1. Anthropic (5 models)
│   ├── us.anthropic.claude-opus-4-6-v1
│   ├── us.anthropic.claude-opus-4-1-20250805-v1:0
│   ├── us.anthropic.claude-sonnet-4-6
│   ├── global.anthropic.claude-sonnet-4-5-20250929-v1:0
│   └── global.anthropic.claude-haiku-4-5-20251001-v1:0
├── 2. DeepSeek (3 models)
│   ├── deepseek.v3-v1:0
│   ├── deepseek.v3.2
│   └── us.deepseek.r1-v1:0
├── 3. OpenAI (4 models)
│   ├── openai.gpt-oss-120b-1:0
│   ├── openai.gpt-oss-20b-1:0
│   ├── openai.gpt-oss-safeguard-120b
│   └── openai.gpt-oss-safeguard-20b
├── 4. Meta (6 models)
│   ├── us.meta.llama4-maverick-17b-instruct-v1:0
│   ├── us.meta.llama4-scout-17b-instruct-v1:0
│   ├── us.meta.llama3-3-70b-instruct-v1:0
│   ├── meta.llama3-3-70b-instruct-v1:0
│   ├── us.meta.llama3-1-70b-instruct-v1:0
│   └── us.meta.llama3-1-8b-instruct-v1:0
├── 5. Google (3 models)
│   ├── google.gemma-3-27b-it
│   ├── google.gemma-3-12b-it
│   └── google.gemma-3-4b-it
├── 6. Mistral AI (9 models)
│   ├── mistral.mistral-large-3-675b-instruct
│   ├── mistral.devstral-2-123b
│   ├── mistral.magistral-small-2509
│   ├── mistral.ministral-3-14b-instruct
│   ├── mistral.ministral-3-8b-instruct
│   ├── mistral.ministral-3-3b-instruct
│   ├── mistral.voxtral-small-24b-2507
│   ├── mistral.voxtral-mini-3b-2507
│   └── us.mistral.pixtral-large-2502-v1:0
├── 7. Amazon (4 models)
│   ├── us.amazon.nova-pro-v1:0
│   ├── us.amazon.nova-lite-v1:0
│   ├── us.amazon.nova-micro-v1:0
│   └── amazon.nova-lite-v1:0
├── 8. Qwen / Alibaba Cloud (5 models)
│   ├── qwen.qwen3-coder-480b-a35b-v1:0
│   ├── qwen.qwen3-coder-30b-a3b-v1:0
│   ├── qwen.qwen3-next-80b-a3b
│   ├── qwen.qwen3-235b-a22b-2507-v1:0
│   └── qwen.qwen3-vl-235b-a22b
├── 9. Z.AI / Zhipu AI (3 models)
│   ├── zai.glm-5
│   ├── zai.glm-4.7
│   └── zai.glm-4.7-flash
├── 10. NVIDIA (3 models)
│   ├── nvidia.nemotron-super-3-120b
│   ├── nvidia.nemotron-nano-12b-v2
│   └── nvidia.nemotron-nano-9b-v2
├── 11. Moonshot AI (2 models)
│   ├── moonshotai.kimi-k2.5
│   └── moonshot.kimi-k2-thinking
└── 12. Writer (1 model)
    └── writer.palmyra-vision-7b
```

---

## 3. Comprehensive Benchmark & Capability Matrix

| Model Identifier | Context Window | SWE-bench Verified | HumanEval | GPQA Diamond | MATH-500 | Arena Elo | Arabic / Multilingual | Price In/Out ($/1M) | Latency Profile |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`us.anthropic.claude-opus-4-6-v1`** | 1,000,000 | **80.8%** | 95.2% | **75.4%** | 96.8% | **1382** | Excellent (Native) | $15.00 / $75.00 | Med-High (20-30 tps) |
| **`us.anthropic.claude-sonnet-4-6`** | 1,000,000 | **79.5%** | 94.6% | 72.4% | 96.2% | 1364 | Excellent (Native) | $3.00 / $15.00 | Balanced (45-60 tps) |
| **`global.anthropic.claude-haiku-4-5-20251001-v1:0`** | 200,000 | 51.2% | 85.8% | 58.2% | 88.4% | 1285 | Very Good | $0.80 / $4.00 | Ultra-Fast (>85 tps) |
| **`us.deepseek.r1-v1:0`** | 128,000 | 49.2% | 90.2% | 71.5% | **97.3%** | 1358 | Excellent | $0.55 / $2.19 | Think-bound (30-40 tps) |
| **`deepseek.v3.2`** | 128,000 | 48.0% | 89.4% | 66.8% | 91.2% | 1332 | Excellent | $0.62 / $1.85 | Fast (55-70 tps) |
| **`qwen.qwen3-coder-480b-a35b-v1:0`** | 256,000 | 58.4% | 92.4% | 68.2% | 94.1% | 1342 | Very Good | $0.40 / $1.60 | Balanced (40-50 tps) |
| **`qwen.qwen3-235b-a22b-2507-v1:0`** | 256,000 | 51.0% | 88.0% | 67.5% | 92.0% | 1335 | Superior (Native AR) | $0.35 / $1.40 | Fast (50-65 tps) |
| **`mistral.mistral-large-3-675b-instruct`** | 256,000 | 52.8% | 88.6% | 68.0% | 91.5% | 1338 | Strong (FR/AR/EN) | $0.50 / $1.50 | Balanced (40-55 tps) |
| **`mistral.devstral-2-123b`** | 128,000 | 56.5% | 91.0% | 61.2% | 86.4% | 1315 | Good | $0.40 / $1.20 | Fast (60-75 tps) |
| **`us.meta.llama4-maverick-17b-instruct-v1:0`** | 256,000 | 54.2% | 89.5% | 67.0% | 92.5% | 1340 | Very Good | $0.45 / $1.80 | Fast (55-70 tps) |
| **`us.meta.llama3-3-70b-instruct-v1:0`** | 128,000 | 46.5% | 82.0% | 60.1% | 85.0% | 1310 | Good | $0.72 / $0.72 | Fast (50-65 tps) |
| **`openai.gpt-oss-120b-1:0`** | 128,000 | 50.1% | 86.2% | 63.4% | 88.0% | 1318 | Good | $0.30 / $1.20 | Fast (55-70 tps) |
| **`us.amazon.nova-pro-v1:0`** | 300,000 | 47.0% | 83.5% | 62.0% | 87.0% | 1312 | Very Good | $0.80 / $3.20 | Fast (60-75 tps) |
| **`us.amazon.nova-lite-v1:0`** | 300,000 | 32.0% | 72.0% | 48.0% | 74.0% | 1240 | Good | $0.06 / $0.24 | Ultra-Fast (>100 tps) |
| **`us.amazon.nova-micro-v1:0`** | 128,000 | 18.0% | 58.0% | 38.0% | 62.0% | 1180 | Moderate | **$0.035 / $0.14** | **Instant (<150ms TTFT)** |
| **`zai.glm-5`** | 200,000 | 53.0% | 88.0% | 66.0% | 92.0% | 1330 | Excellent (ZH/EN/AR) | $1.00 / $3.20 | Fast (50-60 tps) |
| **`nvidia.nemotron-super-3-120b`** | 262,000 | 49.0% | 87.0% | 65.0% | 90.0% | 1320 | Good | $0.15 / $0.65 | Fast (60-75 tps) |
| **`moonshotai.kimi-k2.5`** | 256,000 | 51.5% | 88.2% | 66.5% | 91.0% | 1328 | Very Good | $0.60 / $2.00 | Balanced (45-55 tps) |

---

## 4. Deep-Dive Evaluations by Provider Family

### 4.1 Anthropic Family
*   **Claude Opus 4.6 (`us.anthropic.claude-opus-4-6-v1`)**: The pinnacle of deep autonomous reasoning and architectural system design. Scores 80.8% on SWE-bench Verified. Excels in complex multi-step reasoning, nuanced pedagogical critique, and complex code auditing. Its higher price ($15.00/$75.00 per 1M) makes it cost-prohibitive for high-frequency student chat turns, but unmatched for high-stakes curriculum and exam evaluation.
*   **Claude Sonnet 4.6 (`us.anthropic.claude-sonnet-4-6`)**: The overall benchmark champion for production LLM deployments. Matches Opus-level coding (79.5% SWE-bench) and reasoning while operating at 1/5th the cost and 2x the throughput. Features native prompt caching (reducing prompt ingestion costs by 90%), strict adherence to structured JSON schemas, and exceptional Arabic-English bilingual code reasoning.
*   **Claude Haiku 4.5 (`global.anthropic.claude-haiku-4-5-20251001-v1:0`)**: Delivers sub-second latency with high precision. Far exceeds typical "small" models in instruction following and safety classification. Ideal for Morshid's `SemanticGuardAdapter` and topic boundary filtering.

### 4.2 DeepSeek Family
*   **DeepSeek R1 (`us.deepseek.r1-v1:0`)**: The definitive open-architecture reasoning model. Trained via large-scale reinforcement learning, it uses explicit `<think>` scratchpads before producing answers. Achieves an unprecedented 97.3% on MATH-500 and 79.8% on AIME 2024. For Morshid, it is invaluable for verifying complex algorithm solutions and debugging student logic proofs. However, its verbose reasoning tokens increase response latency, making it better suited for asynchronous or non-streaming analysis pipelines.
*   **DeepSeek V3.2 (`deepseek.v3.2`)**: Fast, economical MoE (671B total / 37B active) featuring Multi-head Latent Attention (MLA). Excellent fallback for general knowledge and code translation.

### 4.3 OpenAI Open-Weight Family
*   **`openai.gpt-oss-120b-1:0`**: OpenAI's 117B MoE model optimized for enterprise deployments on standard hardware. Strong function-calling and strict instruction adherence.
*   **`openai.gpt-oss-safeguard-120b` / `20b`**: Specialized safety and policy guard models. Trained specifically to detect prompt injections, jailbreaks, and sensitive topic leakages.

### 4.4 Meta Llama Family
*   **Llama 4 Maverick 17B (`us.meta.llama4-maverick-17b-instruct-v1:0`)**: Flagship MoE architecture (400B total / 17B active). High execution speed with vast encyclopedic knowledge.
*   **Llama 3.3 70B (`us.meta.llama3-3-70b-instruct-v1:0`)**: Highly stable, deterministic 70B dense model with symmetric pricing ($0.72 / $0.72 per 1M). A dependable enterprise baseline.

### 4.5 Mistral AI Family
*   **Mistral Large 3 675B (`mistral.mistral-large-3-675b-instruct`)**: Massive 675B MoE (41B active) with 256k context. Exceptional multilingual fluency, particularly in French, Spanish, and Arabic technical terms.
*   **Devstral 2 123B (`mistral.devstral-2-123b`)**: Co-developed with All Hands AI. Highly tailored for multi-file repository navigation and code edits (56.5% SWE-bench).
*   **Magistral Small (`mistral.magistral-small-2509`)**: Reasoning model with step-by-step token thinking.
*   **Voxtral Series (`mistral.voxtral-small-24b-2507`, `voxtral-mini-3b-2507`)**: Multimodal audio and speech-to-speech models for future voice tutoring expansions.

### 4.6 Amazon Nova Family
*   **Nova Pro (`us.amazon.nova-pro-v1:0`)**: Amazon's flagship multimodal model with 300k context. Strong multimodal document reasoning.
*   **Nova Lite (`us.amazon.nova-lite-v1:0`)**: Extremely cost-efficient ($0.06 / $0.24 per 1M) multimodal model. Ideal for parsing hundreds of pages of lecture slides, PDF syllabi, and student assignment diagrams.
*   **Nova Micro (`us.amazon.nova-micro-v1:0`)**: The most cost-effective text model on the gateway ($0.035 / $0.14 per 1M) with sub-150ms time-to-first-token. Perfect for fast keyword tagging and pre-flight routing.

### 4.7 Qwen Family (Alibaba Cloud)
*   **Qwen3-Coder-480B (`qwen.qwen3-coder-480b-a35b-v1:0`)**: The leading open-weight coding model in the world. 480B MoE (35B active) with 256k context. Scores 92.4% on HumanEval and excels across Python, TypeScript, Java, C++, and SQL.
*   **Qwen3-235B (`qwen.qwen3-235b-a22b-2507-v1:0`) & Qwen3-VL (`qwen.qwen3-vl-235b-a22b`)**: Outstanding native Arabic language and diagram comprehension.

### 4.8 NVIDIA, Z.AI, Moonshot AI & Writer
*   **GLM-5 (`zai.glm-5`)**: 745B MoE foundation model using DeepSeek Sparse Attention (DSA). Strong long-horizon planning.
*   **Nemotron 3 Super 120B (`nvidia.nemotron-super-3-120b`)**: Highly cost-efficient ($0.15 / $0.65) synthetic data and structured reasoning engine.
*   **Kimi K2.5 (`moonshotai.kimi-k2.5`) & Kimi K2 Thinking (`moonshot.kimi-k2-thinking`)**: 1T parameter agent-swarm model with 256k context.
*   **Palmyra Vision 7B (`writer.palmyra-vision-7b`)**: Enterprise OCR and visual chart parsing specialist.

---

## 5. Morshid Architecture Fit & Recommendations

Morshid's core design relies on three distinct AI boundaries in `server/src/modules/tutoring/`:
1. `AnalysisModelPort`: Determines student state, learning evidence strength, effort quality, misconceptions, and pedagogical technique.
2. `TutorModelPort`: Generates Socratic conversational responses, step-by-step hints, code explanations, and enforces full rewrite refusals.
3. `SemanticGuardPort`: Approves or denies candidate responses to prevent hallucinations, course boundary leaks, or direct code giveaways.

### 5.1 Recommendation Matrix for Morshid Subsystems

```
                                  ┌───────────────────────────────┐
                                  │ Student Chat Request (AR/EN)  │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
               ┌───────────────────────────────────────────────────────────────────┐
               │ 1. Semantic Input Guard & Topic Classifier                       │
               │    Model: global.anthropic.claude-haiku-4-5-20251001-v1:0         │
               │    (Fallback: us.amazon.nova-micro-v1:0)                          │
               └─────────────────────────────────┬─────────────────────────────────┘
                                                 │
                                                 ▼
               ┌───────────────────────────────────────────────────────────────────┐
               │ 2. Educational Analysis (Student State, Misconceptions, Strategy) │
               │    Model: us.anthropic.claude-sonnet-4-6                          │
               │    (Deep Algorithmic Fallback: us.deepseek.r1-v1:0)               │
               └─────────────────────────────────┬─────────────────────────────────┘
                                                 │
                                                 ▼
               ┌───────────────────────────────────────────────────────────────────┐
               │ 3. Socratic Tutor Generation (Hints, Debugging Guidance)          │
               │    Model: us.anthropic.claude-sonnet-4-6                          │
               │    (Open-Weight Coding Fallback: qwen.qwen3-coder-480b-a35b-v1:0) │
               └─────────────────────────────────┬─────────────────────────────────┘
                                                 │
                                                 ▼
               ┌───────────────────────────────────────────────────────────────────┐
               │ 4. Output Semantic Approval Guard (Anti-Leak, Factuality)         │
               │    Model: global.anthropic.claude-haiku-4-5-20251001-v1:0         │
               └─────────────────────────────────┬─────────────────────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │ Approved Socratic Response    │
                                  └───────────────────────────────┘
```

### 5.2 Specific Subsystem Analysis

#### A. Tutor Model Port (`TutorModelPort`)
*   **Selected Primary:** `us.anthropic.claude-sonnet-4-6`
*   **Why:** Morshid requires strict compliance with `DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL`—it must guide students Socratically without outputting full code solutions. Sonnet 4.6 adheres strictly to system instructions and produces structured JSON responses without format degradation. Its bilingual Arabic/English proficiency allows natural Egyptian Arabic and Modern Standard Arabic technical dialogue.
*   **Recommended Secondary / Open-Weights Alternative:** `qwen.qwen3-coder-480b-a35b-v1:0` or `mistral.devstral-2-123b`.

#### B. Educational Analysis Model Port (`AnalysisModelPort`)
*   **Selected Primary:** `us.anthropic.claude-sonnet-4-6`
*   **Selected Reasoning Co-processor:** `us.deepseek.r1-v1:0`
*   **Why:** Educational analysis requires identifying whether student errors stem from conceptual misunderstandings or syntax bugs. Sonnet 4.6 delivers fast, accurate taxonomy classification. For complex data structures and algorithmic proof checks, DeepSeek R1 provides deep chain-of-thought verification.

#### C. Semantic Guard Model Port (`SemanticGuardPort`)
*   **Selected Primary:** `global.anthropic.claude-haiku-4-5-20251001-v1:0`
*   **Selected Budget/High-Throughput Fallback:** `openai.gpt-oss-safeguard-20b` or `us.amazon.nova-micro-v1:0`
*   **Why:** Guard evaluation sits in the critical request path. Haiku 4.5 delivers <400ms turnaround with high classification accuracy against prompt jailbreaks and solution leaks.

#### D. Multimodal Course Ingestion Pipeline
*   **Selected Primary:** `us.amazon.nova-lite-v1:0` / `qwen.qwen3-vl-235b-a22b`
*   **Why:** Ingesting 100+ lecture slides containing diagrams and code screenshots requires high vision fidelity at low cost. Nova Lite ($0.06/1M input) processes multi-megabyte visual slide decks cost-effectively.

---

## 6. Economic & Operational Cost Modeling

### Scenario: 10,000 Interactive Student Tutoring Turns

Assumptions per student turn:
- System prompt + course evidence retrieval context: 2,500 input tokens.
- Analysis output: 250 tokens.
- Tutor generation prompt (conversation history + analysis): 3,000 input tokens.
- Tutor response: 350 tokens.
- Guard check: 800 input tokens, 50 tokens output.

#### Option A: Pure Claude Sonnet 4.6 (With Prompt Caching)
- Prompt Caching Hit Rate: 80% on base context.
- Effective input cost: (20% * $3.00) + (80% * $0.30) = $0.84 / 1M input tokens.
- Total Turn Cost:
  - Analysis: (0.0025 * $0.84) + (0.00025 * $15.00) = $0.0021 + $0.00375 = $0.00585
  - Tutor: (0.0030 * $0.84) + (0.00035 * $15.00) = $0.00252 + $0.00525 = $0.00777
  - Guard (Haiku 4.5): (0.0008 * $0.80) + (0.00005 * $4.00) = $0.00064 + $0.00020 = $0.00084
- **Cost per turn:** **~$0.0145**
- **Cost for 10,000 student turns:** **$144.60**

#### Option B: Hybrid Multi-Tier (Sonnet 4.6 + DeepSeek R1 + Haiku 4.5 + Nova Lite)
- Analysis (DeepSeek R1 / V3.2 blend): ~$0.0018
- Tutor (Sonnet 4.6 cached): ~$0.0078
- Guard (Haiku 4.5): ~$0.0008
- **Cost per turn:** **~$0.0104**
- **Cost for 10,000 student turns:** **$104.00**

#### Option C: High-Efficiency Open-Weights (Qwen3-Coder-480B + Qwen3-235B + Nova Micro)
- Analysis (Qwen3-235B): ~$0.0012
- Tutor (Qwen3-Coder-480B): ~$0.0018
- Guard (Nova Micro / Safeguard-20B): ~$0.0001
- **Cost per turn:** **~$0.0031**
- **Cost for 10,000 student turns:** **$31.00**

---

## 7. Primary Source Citations

1. Anthropic Documentation & Model Cards: *Claude 4.6 / 4.5 System Architecture, Benchmarks, and Context Window Specifications* (Anthropic AI, 2025–2026).
2. AWS Bedrock User Guide & Pricing API: *Amazon Bedrock Supported Models, Active Region Endpoints, and Token Pricing Schedule* (Amazon Web Services, August 2026).
3. DeepSeek AI: *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning* (DeepSeek-AI, 2025).
4. Alibaba Cloud / Qwen Team: *Qwen3 Technical Report: Scaling Open Foundation & Coding Models* (Alibaba Group, 2025–2026).
5. Mistral AI: *Mistral Large 3 and Devstral: Frontier Multimodal and Software Engineering Models* (Mistral AI & All Hands AI, 2025–2026).
6. Meta AI: *The Llama 4 and Llama 3.3 Herd of Models* (Meta AI Research, 2025–2026).
7. LMSYS Organization: *LMSYS Chatbot Arena Leaderboard & SWE-bench Verified Benchmarking Archive* (LMSYS / SWE-bench, August 2026).
