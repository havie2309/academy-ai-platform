# llm-server (Ollama)

Placeholder cho LLM serving qua Ollama.

## Dev (1 máy)

```bash
ollama pull qwen2.5:3b
```

Cấu hình trong `.env`:

- `LLM_BASE_URL=http://localhost:11434`
- `LLM_MODEL=qwen2.5:3b`

## Nghiệm thu (Máy mô hình)

Đổi `LLM_MODEL` → `qwen2.5:3b` và trỏ `LLM_BASE_URL` tới IP Máy mô hình.
