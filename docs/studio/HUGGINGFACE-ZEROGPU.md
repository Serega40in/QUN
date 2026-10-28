# QUN Animation Studio — Hugging Face ZeroGPU

Status: provider discovery / API preflight. This document does **not** claim that video generation is already connected end-to-end.

## Candidate for the first test

Public Space: https://huggingface.co/spaces/zerogpu-aoti/wan2-2-fp8da-aoti-faster

The Hugging Face directory currently lists this Space as running on ZeroGPU. It is a community-hosted demo, not a QUN-controlled service: availability, API shape, model license, queue time, and output persistence can change. Use it only for a short, non-sensitive test after reviewing the Space's own license and usage rules.

## Free-tier guardrails

- Hugging Face documents a free-account ZeroGPU quota of 5 GPU minutes/day. Unauthenticated use has a shared 2-minute/day allowance. Quota resets 24 hours after first use.
- Never enable paid credits or paid hardware for this project. Stop when free quota is exhausted; do not add billing information for this test.
- A Space may sleep, queue, change its API, or disappear. This is a best-effort experiment, not production capacity.
- Do not place an HF access token in GitHub Pages, browser JavaScript, issue comments, URLs, or logs.
- The Space's visible “Running on Zero” status is not proof that its generation API currently works.

## Inspect API without consuming GPU quota

Open the API schema URL in a browser:

```text
https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space/gradio_api/openapi.json
```

This is a metadata request, not a generation request. If it returns JSON, look for the generation endpoint and its input schema. The Gradio “Use via API” section on the Space page is another source of truth.

If the schema URL does not load, open the Space and inspect “Use via API”; do not guess endpoint names or argument order.

## Manual smoke test

1. Open the Space and confirm it is available.
2. Read the Space license and API documentation.
3. Make the smallest possible test request from its own UI (for example, a short clip from a simple prompt). This consumes the Space's GPU quota, so do it only when ready to spend part of the free daily allowance.
4. Save the resulting output locally. Verify it is an actual video file and can be opened outside the Space.
5. Record the API endpoint, exact input order, output format, and whether results are returned as a temporary URL or downloadable file.

Do not use the public demo for private prompts or personal/reference images unless its data handling terms are acceptable.

## Integration design for QUN

1. QUN Studio submits an authenticated job to the QUN backend.
2. A server-side provider adapter calls the validated Gradio API.
3. The adapter polls the job and downloads the output while its temporary URL is valid.
4. The backend stores the artifact in QUN Storage and returns a QUN-owned result link.
5. UI shows provider, queue state, quota/availability errors, and a clear “free quota unavailable” state. No paid fallback.

The public demo's endpoint schema must be validated before writing the final adapter. The API can change, so keep Space ID and endpoint name configurable server-side. Any HF token, if later needed, belongs only in server-side secrets. The current project has not confirmed that such a secret is configured.

## Official references

- ZeroGPU quotas and constraints: https://huggingface.co/docs/hub/spaces-zerogpu
- Gradio Space API and OpenAPI schema: https://huggingface.co/docs/hub/en/spaces-api-endpoints
- Video-generation Space directory: https://huggingface.co/spaces?category=video-generation

## Acceptance criteria

- [ ] Candidate Space and license reviewed.
- [ ] API schema inspected; endpoint and input/output types recorded.
- [ ] One small video generated inside free quota.
- [ ] Backend can call the endpoint without exposing credentials to the browser.
- [ ] Result is downloaded and stored by QUN, not left at a temporary Space URL.
- [ ] No paid resource or paid fallback is enabled.

Until all criteria above pass, status remains **preflight only**, not end-to-end connected.
