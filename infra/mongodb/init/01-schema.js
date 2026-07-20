// ============================================
// MONGODB SCHEMA - Collections and Indexes
// ============================================

// Collections
db.createCollection("documents");
db.createCollection("document_chunks");
db.createCollection("document_summaries");
db.createCollection("summary_jobs");
db.createCollection("processing_jobs");
db.createCollection("chat_sessions");
db.createCollection("chat_messages");
db.createCollection("ai_answer_cache");
db.createCollection("retrieval_logs");
db.createCollection("sync_logs");
db.createCollection("system_configs");
db.createCollection("user_feedback");
db.createCollection("document_quizzes");
db.createCollection("quiz_jobs");

// Indexes
db.document_chunks.createIndex({ documentId: 1, chunkIndex: 1 });
db.document_chunks.createIndex({ milvusVectorId: 1 }, { unique: true, sparse: true });
db.document_chunks.createIndex({ "metadata.ownerUnitCode": 1 });
db.document_chunks.createIndex({ "metadata.securityLevel": 1 });
db.document_chunks.createIndex({ chunkText: "text" });

db.processing_jobs.createIndex({ documentId: 1 });
db.processing_jobs.createIndex({ status: 1, createdAt: -1 });

db.chat_sessions.createIndex({ userId: 1, updatedAt: -1 });
db.chat_sessions.createIndex({ "scope.domain": 1 });

db.chat_messages.createIndex({ sessionId: 1, createdAt: 1 });
db.chat_messages.createIndex({ userId: 1, createdAt: -1 });

db.ai_answer_cache.createIndex(
  { questionHash: 1, scopeHash: 1, "modelConfig.promptVersion": 1 },
  { unique: true }
);
db.ai_answer_cache.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.retrieval_logs.createIndex({ userId: 1, createdAt: -1 });
db.retrieval_logs.createIndex({ sessionId: 1 });

db.sync_logs.createIndex({ sourceSystem: 1, entity: 1, startedAt: -1 });
db.sync_logs.createIndex({ status: 1 });

db.system_configs.createIndex({ key: 1 }, { unique: true });

db.user_feedback.createIndex({ userId: 1, createdAt: -1 });
db.user_feedback.createIndex({ messageId: 1 });

db.document_summaries.createIndex(
    { documentId: 1, provider: 1, baseUrl: 1, model: 1, promptHash: 1 },
    { unique: true }
);

db.summary_jobs.createIndex({ documentId: 1 }, { unique: true });
db.summary_jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.document_quizzes.createIndex(
  { documentId: 1, configHash: 1, promptHash: 1, optionsHash: 1 },
  { unique: true }
);

db.quiz_jobs.createIndex({ documentId: 1, configHash: 1, optionsHash: 1 }, { unique: true });
db.quiz_jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
