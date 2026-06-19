from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, connections, utility

from app.config import EMBEDDING_DIM, MILVUS_COLLECTION, MILVUS_HOST, MILVUS_PORT

_connected = False


def connect_milvus() -> None:
    global _connected
    if not _connected:
        connections.connect(alias="default", host=MILVUS_HOST, port=MILVUS_PORT)
        _connected = True


def ensure_collection() -> Collection:
    connect_milvus()
    if utility.has_collection(MILVUS_COLLECTION):
        col = Collection(MILVUS_COLLECTION)
        col.load()
        return col

    fields = [
        FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(name="chunk_id", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="document_id", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="security_rank", dtype=DataType.INT64),
        FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM),
    ]
    schema = CollectionSchema(fields, description="Document chunk vectors for RAG")
    col = Collection(MILVUS_COLLECTION, schema)
    col.create_index(
        field_name="vector",
        index_params={"index_type": "AUTOINDEX", "metric_type": "COSINE"},
    )
    col.load()
    return col


def insert_vectors(
    chunk_ids: list[str],
    document_ids: list[str],
    security_ranks: list[int],
    vectors: list[list[float]],
) -> list[int]:
    col = ensure_collection()
    result = col.insert([chunk_ids, document_ids, security_ranks, vectors])
    col.flush()
    return list(result.primary_keys)


def delete_by_document(document_id: str) -> None:
    connect_milvus()
    if not utility.has_collection(MILVUS_COLLECTION):
        return
    col = Collection(MILVUS_COLLECTION)
    col.load()
    col.delete(expr=f'document_id == "{document_id}"')
    col.flush()


def delete_document_except(document_id: str, keep_chunk_ids: list[str]) -> None:
    """Xóa vectors của document_id, ngoại trừ các chunk_id trong keep_chunk_ids."""
    connect_milvus()
    if not utility.has_collection(MILVUS_COLLECTION):
        return
    col = Collection(MILVUS_COLLECTION)
    col.load()

    if not keep_chunk_ids:
        col.delete(expr=f'document_id == "{document_id}"')
        col.flush()
        return

    # Query primary keys của các vector cũ (cùng document, không nằm trong bản mới).
    quoted = ", ".join(f'"{cid}"' for cid in keep_chunk_ids)
    stale = col.query(
        expr=f'document_id == "{document_id}" && chunk_id not in [{quoted}]',
        output_fields=["id"],
    )
    stale_ids = [r["id"] for r in stale]
    if stale_ids:
        col.delete(expr=f"id in {stale_ids}")
        col.flush()
