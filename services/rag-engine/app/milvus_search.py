from pymilvus import Collection, connections, utility

from app.config import MILVUS_COLLECTION, MILVUS_HOST, MILVUS_PORT


def search_vectors(
    query_vector: list[float],
    top_k: int,
    *,
    expr: str | None = None,
) -> list[dict]:
    connections.connect(alias="default", host=MILVUS_HOST, port=MILVUS_PORT)
    if not utility.has_collection(MILVUS_COLLECTION):
        return []

    col = Collection(MILVUS_COLLECTION)
    col.load()
    search_kwargs = {
        "data": [query_vector],
        "anns_field": "vector",
        "param": {"metric_type": "COSINE", "params": {}},
        "limit": top_k,
        "output_fields": ["chunk_id", "document_id", "security_rank"],
    }
    if expr:
        search_kwargs["expr"] = expr

    results = col.search(
        **search_kwargs,
    )

    hits: list[dict] = []
    for hit in results[0]:
        hits.append(
            {
                "chunk_id": hit.entity.get("chunk_id"),
                "document_id": hit.entity.get("document_id"),
                "security_rank": hit.entity.get("security_rank"),
                "score": float(hit.distance),
            }
        )
    return hits
