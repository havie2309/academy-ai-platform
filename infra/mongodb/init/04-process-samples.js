// =====================================================
// Process sample documents - trigger ingestion pipeline
// =====================================================

// Find all sample documents that haven't been processed
const sampleDocs = db.documents.find({ 
  isSample: true, 
  ingestStatus: { $ne: 'processing' },
  ingestStatus: { $ne: 'completed' }
}).toArray();

sampleDocs.forEach(doc => {
    db.documents.updateOne(
      { docId: doc.docId },
      { 
        $set: { 
          ingestStatus: 'processing',
          ingestStage: 'queued',
          ingestUpdatedAt: new Date()
        } 
      }
    );
});

// Create processing jobs in a separate collection
// that the document-processor can read
sampleDocs.forEach(doc => {
  db.processing_jobs.updateOne(
    { 
      documentId: doc.docId,
      isSample: true
    },
    {
      $set: {
        jobId: doc.docId + '-sample',
        documentId: doc.docId,
        storagePath: doc.storagePath,
        title: doc.title,
        mimeType: doc.mimeType,
        securityLevel: doc.securityLevel,
        scopeType: doc.scopeType,
        accessRoleCodes: doc.accessRoleCodes || [],
        accessDepartmentCodes: doc.accessDepartmentCodes || [],
        accessUserIds: doc.accessUserIds || [],
        uploadedById: doc.uploadedById,
        status: 'queued',
        updatedAt: new Date(),
        isSample: true,
        isAdversarial: doc.isAdversarial || false,
        adversarialType: doc.adversarialType || 'none',
        sourceSystem: 'sample_offline'
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }  // ← UPSERT: update if exists, insert if not
  );
});

// Update indexes to support sample processing
db.processing_jobs.createIndex({ status: 1, createdAt: 1 });
db.processing_jobs.createIndex({ documentId: 1 });
db.processing_jobs.createIndex({ isSample: 1, status: 1 });