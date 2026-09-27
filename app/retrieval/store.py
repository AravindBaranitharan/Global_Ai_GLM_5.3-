"""Qdrant collection with named dense + sparse vectors and ACL payload filters."""
from __future__ import annotations

import uuid

from qdrant_client import QdrantClient, models

from app.retrieval.models import Encoded

DENSE = "dense"
SPARSE = "sparse"


def point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


def acl_filter(groups: list[str], include_quarantined: bool, domain: str | None = None) -> models.Filter:
    must: list = [models.FieldCondition(key="acl_groups", match=models.MatchAny(any=groups))]
    if domain:
        must.append(models.FieldCondition(key="domain", match=models.MatchValue(value=domain)))
    if not include_quarantined:
        must.append(models.FieldCondition(key="quarantined", match=models.MatchValue(value=False)))
    return models.Filter(must=must)


class VectorStore:
    def __init__(self, client: QdrantClient, collection: str, dim: int = 1024):
        self.client = client
        self.collection = collection
        self.dim = dim

    def ensure(self, reset: bool = False) -> None:
        exists = self.client.collection_exists(self.collection)
        if exists and reset:
            self.client.delete_collection(self.collection)
            exists = False
        if exists:
            return
        self.client.create_collection(
            self.collection,
            vectors_config={DENSE: models.VectorParams(size=self.dim, distance=models.Distance.COSINE)},
            sparse_vectors_config={SPARSE: models.SparseVectorParams()},
        )
        for field, schema in [("acl_groups", "keyword"), ("doc_id", "keyword"), ("quarantined", "bool"), ("domain", "keyword")]:
            self.client.create_payload_index(self.collection, field, field_schema=schema)

    def delete_doc(self, doc_id: str) -> None:
        self.client.delete(self.collection, points_selector=models.FilterSelector(filter=models.Filter(
            must=[models.FieldCondition(key="doc_id", match=models.MatchValue(value=doc_id))])))

    def upsert(self, payloads: list[dict], vectors: list[Encoded]) -> None:
        points = [
            models.PointStruct(
                id=point_id(p["chunk_id"]),
                vector={DENSE: v.dense, SPARSE: models.SparseVector(indices=v.sparse_indices, values=v.sparse_values)},
                payload=p,
            )
            for p, v in zip(payloads, vectors)
        ]
        if points:
            self.client.upsert(self.collection, points=points, wait=True)

    def hybrid_search(self, query: Encoded, groups: list[str], include_quarantined: bool, limit: int,
                      domain: str | None = None) -> list[dict]:
        if not groups:
            return []  # fail closed: no groups, no documents
        flt = acl_filter(groups, include_quarantined, domain)
        res = self.client.query_points(
            self.collection,
            prefetch=[
                models.Prefetch(query=query.dense, using=DENSE, limit=limit, filter=flt),
                models.Prefetch(query=models.SparseVector(indices=query.sparse_indices, values=query.sparse_values), using=SPARSE, limit=limit, filter=flt),
            ],
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            query_filter=flt,
            limit=limit,
            with_payload=True,
        )
        return [p.payload for p in res.points]

    def count(self) -> int:
        return self.client.count(self.collection, exact=True).count
