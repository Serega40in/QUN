# QUN LLM tooling — v0.1

This directory defines a reproducible path toward a QUN-specific model adapter. It does **not** claim that a QUN fine-tuned model has already been trained.

## Current baseline

- **Desktop and web:** cloud-first through the QUN AI Gateway; no local model server is required.
- **Ollama:** intentionally disabled for this project because it is too heavy for the target PC. Do not instruct users to reinstall or run it.
- **Current web provider:** existing Supabase Edge Function `qun-ai-chat` uses the configured Gemini API key until a QUN LLM cloud endpoint is provisioned.
- **QUN LLM endpoint:** the gateway supports an operator-configured OpenAI-compatible cloud endpoint via Supabase secrets. No endpoint is currently confirmed as configured, so do not claim QUN LLM is serving production traffic.
- **Model ownership:** QUN-specific model/adapter is a development goal; a third-party base model is not itself a QUN-trained model.

## Safe workflow

1. Curate examples from public/approved QUN documentation, not private user chats by default.
2. Store a versioned JSONL dataset in private storage; each example must have source, license/permission, and a redaction review.
3. Run the fixed evaluation set in `docs/qun-ai/evaluation-v0.1.jsonl` against the baseline before training.
4. Use a compatible GPU runtime for LoRA/QLoRA; pin package versions, base model revision, tokenizer revision, training parameters, seed, and dataset checksum.
5. Run the exact same evaluation after training and compare results.
6. Reject candidates that regress factual accuracy, leak secrets, invent official URLs, or fail privacy/safety checks.
7. Publish only an approved adapter and model manifest with base-model license, adapter checksum, training data provenance, and evaluation report.

## Important

- Do not fine-tune from raw chat logs automatically.
- Do not put private conversations, API keys, passwords, wallet seeds, private keys, or user-uploaded confidential files into training datasets.
- RAG is the preferred first method for up-to-date facts. Fine-tuning teaches response style and task behavior; it does not reliably update factual knowledge.
- Do not run a public inference endpoint from a temporary notebook and imply production availability. Use an explicit health check and operator-visible status.
- Never store model weights in PostgreSQL. Use local model directories or private artifact/object storage.
- The model license must permit the intended use and distribution. Review it before publishing weights or adapters.

## Next implementation steps

- Add an isolated evaluation runner with a JSON report.
- Add a dataset validator for JSONL schema, duplicates, source/license fields, and secret-pattern checks.
- Add a pinned LoRA training recipe only after selecting a base model and a GPU runtime.
- Register model artifacts only after evaluation and human approval.
