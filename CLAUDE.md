# PawTales — working rules

- **Nothing on C:.** The C: drive is full. Every download, model cache, install, build output and scratch file goes on D: (scratch work in `D:\W\_scratch\`). Point model caches at D: explicitly (Transformers.js `env.cacheDir`, `HF_HOME`).
- **Zero budget.** Everything must be free and open source. No paid APIs, no paid hosting. AI runs in the player's browser (WebGPU); hosting is GitHub Pages.
- **Players are kids (8–14).** Every AI feature needs a safety layer beyond trusting the model: no personal info, no unsafe content, characters stay kind and in-world.
- **Model choice (from a spike on 2026-10-03):** Gemma 3 1B (`onnx-community/gemma-3-1b-it-ONNX`, q4f16, ~760 MB) held character and stayed kid-safe best; LFM2 1.2B was faster but flattened personalities; Qwen3 1.7B looped. Re-test before committing.
- Live site: https://w-electro.github.io/pawtales/ (Pages from `main`).
