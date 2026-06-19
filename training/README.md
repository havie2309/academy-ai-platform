# Training — fine-tune & experiments

Workspace **local** cho huấn luyện / fine-tune (dataset, checkpoint, log). **Không commit artifact** vào Git.

## Cấu trúc

| Path | Mục đích |
|------|----------|
| `datasets/` | Dataset train/val (export từ Postgres, file JSONL…) |
| `configs/` | Cấu hình train (YAML/JSON nhỏ — có thể commit mẫu) |
| `runs/` | Log từng run (TensorBoard, metrics) |
| `checkpoints/` | Weight sau epoch / LoRA adapter |
| `exports/` | Model export để copy sang `models/inference/` hoặc Ollama Modelfile |

## Luồng gợi ý (sau khi có RAG baseline)

1. Thu thập Q&A + citation từ `eval/` → `datasets/`
2. Fine-tune LoRA trên base `qwen2.5:3b`
3. Export → `exports/` → import Ollama / copy sang `models/inference/`
4. Đổi `LLM_MODEL` trong `.env` để smoke

## Quy tắc

- Checkpoint, log, dataset thô: **gitignore**.
- Chỉ commit `README.md`, `.gitkeep`, và file config mẫu nhỏ trong `configs/` nếu cần.
