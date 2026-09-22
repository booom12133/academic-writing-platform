# Phase P5 Performance Benchmark

Measured: 2026-09-22T05:15:38.877Z

Command: `npm run benchmark:p5`

Benchmark contract: `p5-manuscript-v1`

## Environment

- Node.js: v24.11.1 (`win32`, `x64`)
- CPU: 13th Gen Intel(R) Core(TM) i5-13490F, 16 logical CPUs
- RAM: 34,158,444,544 bytes
- Template: `generic-academic-v1@1`
- Renderer: `docx@1`
- Warm-up: 1 run per fixture
- Measurements: 5 runs per fixture

The fixture generator is deterministic and performs no database, network, LLM, production-storage, Redis, BullMQ, or Queue operation. Each measured run includes manuscript assembly/projection, whole-document citation normalization, DOCX rendering, and ZIP/XML validation. Peak RSS delta is the maximum observed at the projection, render, and ZIP/XML validation checkpoints; it is not a continuously sampled process high-water mark.

## Results

| Fixture | Wall p50 | Wall p95 | Peak observed RSS delta | DOCX bytes | Context coverage | Validation |
|---|---:|---:|---:|---:|---|---|
| 10,000 words | 14.35 ms | 15.74 ms | 13,262,848 bytes | 32,429 | 10/10 sections; bounded to 60,000 code points | deterministic fingerprint; ZIP/XML pass |
| 50,000 words | 33.62 ms | 34.58 ms | 12,636,160 bytes | 123,841 | 10/10 sections; bounded to 60,000 code points | deterministic fingerprint; ZIP/XML pass |
| 100,000 words | 85.04 ms | 143.43 ms | 3,907,584 bytes | 235,072 | 10/10 sections; bounded to 60,000 code points | deterministic fingerprint; ZIP/XML pass |

All three fixtures produced the exact requested projection word count. Every measured repetition for a fixture produced the same manuscript fingerprint. The 100,000-word fixture completed without stack overflow, produced a valid DOCX ZIP with `word/document.xml`, and preserved fair context coverage across all ten sections. Context truncation was explicit for all ten deliberately long sections.

## Decision

The local acceptance baseline passes. These measurements are evidence for the synchronous P5 design on this host, not a production SLA or a concurrency-capacity claim. They do not authorize Phase F, Redis, BullMQ, Queue, or any asynchronous export architecture.
