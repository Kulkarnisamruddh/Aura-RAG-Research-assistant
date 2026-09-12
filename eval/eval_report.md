# 📊 Aura RAG Evaluation Benchmark Report

**Date:** 2026-09-12T06:33:09.437Z
**Model Evaluated:** `openai/gpt-oss-120b`
**LLM Judge:** `openai/gpt-oss-120b`

## Aggregate Performance Metrics

| Metric | Score | Target Threshold | Status |
| :--- | :--- | :--- | :--- |
| **Faithfulness / Grounding** | **5.00 / 5.0** | $\ge 4.5$ | 🟢 PASS |
| **Answer Relevance** | **5.00 / 5.0** | $\ge 4.5$ | 🟢 PASS |
| **Citation Compliance** | **100.0%** | $\ge 90\%$ | 🟢 PASS |
| **Out-of-Domain Refusal** | **100.0%** | $100\%$ | 🟢 PASS |
| **Average Latency** | **1332ms** | $< 1500\text{ms}$ | 🟢 PASS |

## Detailed Test Case Breakdown

### 1. [factual_retrieval] What embedding model is used in Aura and how does it reduce server RAM?

- **Generated Answer:** Aura employs the **all‑MiniLM‑L6‑v2** model, running it through ONNX Runtime Web inside a Web Worker in the user’s browser. Because the embeddings are generated client‑side, the server no longer needs to keep large transformer models in memory; the vector computation is offloaded to the client, which cuts the server’s RAM usage by avoiding in‑memory transformer models on Node.js【Source 1】.
- **Ground Truth:** Aura uses all-MiniLM-L6-v2 running in a Web Worker in the browser, offloading embedding computations and saving server RAM.
- **Scores:** Faithfulness: 5/5 | Relevance: 5/5 | Citation: Passed
- **Judge Reasoning:** *The answer uses only the provided context, correctly identifies the model and RAM reduction method, cites the source, and does not need to refuse.*

### 2. [security_and_limits] How is user authentication validated and what rate limits are enforced?

- **Generated Answer:** User authentication is validated on the backend by checking Supabase JWT tokens with `userSupabase.auth.getUser()` rather than trusting data sent from the client. The system also applies an Express rate‑limit of **50 requests per 15 minutes per IP address** on every API endpoint【Source 1】.
- **Ground Truth:** Authentication is verified server-side using Supabase JWT tokens, and an express-rate-limit of 50 requests per 15 minutes is enforced.
- **Scores:** Faithfulness: 5/5 | Relevance: 5/5 | Citation: Passed
- **Judge Reasoning:** *Answer uses only provided context, directly addresses authentication and rate limits, includes proper citation, and no refusal was needed.*

### 3. [database_optimization] What vector index is used in Supabase pgvector and why was it added?

- **Generated Answer:** Supabase pgvector uses an **HNSW (Hierarchical Navigable Small World) index** for its vector columns. It was added so that searches can avoid costly full‑table scans (O(N)) and instead perform sub‑linear approximate nearest‑neighbor lookups (≈ O(log N)) using cosine distance, dramatically improving query performance【Source 1】.
- **Ground Truth:** An HNSW index on the embedding vector column is used to enable fast O(log N) vector searches instead of full table scans.
- **Scores:** Faithfulness: 5/5 | Relevance: 5/5 | Citation: Passed
- **Judge Reasoning:** *The answer uses only the provided context, correctly identifies the HNSW index and its purpose, matches the ground truth, includes a proper citation, and does not need to refuse.*

### 4. [negative_refusal] What was the closing stock price of Tesla on January 15th 2024?

- **Generated Answer:** I cannot find the answer in the uploaded documents.
- **Ground Truth:** The model should state that it cannot find the answer in the uploaded documents.
- **Scores:** Faithfulness: 5/5 | Relevance: 5/5 | Citation: Passed
- **Judge Reasoning:** *The answer correctly states inability to find the answer, does not hallucinate, aligns with expected behavior, and requires no citations.*

### 5. [document_management] How does Aura prevent duplicate file uploads and what is the file size limit?

- **Generated Answer:** Aura prevents duplicate uploads by hashing each file on the client side with Web Crypto SHA‑256 before it is sent. If the resulting hash already exists for that user, the server responds with a **409 Conflict**, blocking the duplicate upload. Additionally, Aura limits each individual upload to a maximum of **20 MB** in size【Source 1】.
- **Ground Truth:** Aura uses client-side SHA-256 hashing to reject duplicates with 409 Conflict, and enforces a 20MB file size limit.
- **Scores:** Faithfulness: 5/5 | Relevance: 5/5 | Citation: Passed
- **Judge Reasoning:** *The answer uses only the provided context, accurately restates the duplicate‑check mechanism and size limit, directly addresses the question, and includes a proper citation.*

