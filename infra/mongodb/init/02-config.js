// ============================================
// MONGODB SYSTEM CONFIGURATIONS
// ============================================

if (db.system_configs.countDocuments() === 0) {
    db.system_configs.insertMany([
        {
            key: "rag.chunking.default",
            value: { maxChunkSize: 1000, minChunkSize: 200, overlap: 0.1 },
            description: "Cấu hình chia chunk mặc định cho tài liệu",
            createdAt: new Date()
        },
        {
            key: "rag.embedding.model",
            value: { name: "BGE-M3", dimensions: 1024, maxTokens: 8192 },
            description: "Mô hình embedding sử dụng cho RAG",
            createdAt: new Date()
        },
        {
            key: "rag.retrieval.top_k",
            value: { default: 30, max: 50, min: 5 },
            description: "Số lượng chunk truy xuất mặc định",
            createdAt: new Date()
        },
        {
            key: "rag.retrieval.rerank_top_k",
            value: { default: 8, max: 20, min: 3 },
            description: "Số lượng chunk sau khi rerank",
            createdAt: new Date()
        },
        {
            key: "llm.default_config",
            value: { model: "Qwen2.5-3B", temperature: 0.1, maxTokens: 2048, topP: 0.95 },
            description: "Cấu hình mặc định cho LLM",
            createdAt: new Date()
        },
        {
            key: "cache.ttl",
            value: { ai_answer_cache: 604800, default: 86400 },
            description: "Thời gian sống của cache (giây)",
            createdAt: new Date()
        },
        {
            key: "security.max_login_attempts",
            value: 5,
            description: "Số lần đăng nhập sai tối đa trước khi khóa tài khoản",
            createdAt: new Date()
        },
        {
            key: "document.allowed_types",
            value: ["pdf", "docx", "pptx", "xlsx", "txt"],
            description: "Các loại tài liệu được phép upload",
            createdAt: new Date()
        },
        {
            key: "document.max_file_size_mb",
            value: 50,
            description: "Kích thước file tối đa cho phép upload (MB)",
            createdAt: new Date()
        }
    ]);
}
