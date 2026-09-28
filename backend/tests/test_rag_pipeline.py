"""
Unit tests for Fair Split Pinecone RAG Pipeline.
Tests:
- Vector store initialization and fallback
- Embeddings pipeline
- Canonical ontology seeding & semantic retrieval
- Receipt document ingestion
- Semantic caching layer (latency & cost reduction)
- Ground-truth evaluation guardrails
"""

from __future__ import annotations

import time
import pytest

from rag_service import PineconeRAGService, _deterministic_semantic_vector
from eval_guardrail import run_all_evaluations


@pytest.fixture
def rag():
    return PineconeRAGService()


def test_vector_db_initialization(rag):
    stats = rag.get_stats()
    assert "dimension" in stats
    assert stats["dimension"] == 768
    assert stats["total_ingested"] >= 8  # seeded canonical knowledge
    assert "index_name" in stats


def test_embedding_generation(rag):
    vec = rag.get_embedding("Butter Chicken and Garlic Naan")
    assert isinstance(vec, list)
    assert len(vec) == 768
    # Test batch embedding
    batch_vecs = rag.get_batch_embeddings(["Paneer Butter Masala", "Dal Makhani"])
    assert len(batch_vecs) == 2
    assert len(batch_vecs[0]) == 768


def test_semantic_retrieval_canonical_matches(rag):
    # Query with abbreviation
    matches = rag.retrieve_context("PBM", top_k=3)
    assert len(matches) > 0
    matched_names = [m["metadata"].get("name", "") for m in matches]
    assert any("Paneer Butter Masala" in name for name in matched_names)


def test_document_ingestion_and_retrieval(rag):
    mock_receipt = {
        "restaurant_name": "Tandoori Nights",
        "date": "24 Dec 2025",
        "grand_total": 920,
        "line_items": [
            {"name": "Murgh Makhani Special", "qty": 1, "amount": 420},
            {"name": "Garlic Naan Basket", "qty": 2, "amount": 180},
            {"name": "Cold Drinks", "qty": 3, "amount": 120},
        ],
    }

    doc_id = rag.ingest_receipt(mock_receipt)
    assert doc_id.startswith("rcpt_")

    # Search for this ingested document
    results = rag.retrieve_context("Murgh Makhani Tandoori Nights", top_k=2)
    assert len(results) > 0
    found_item = any("Murgh Makhani" in str(r["metadata"]) for r in results)
    assert found_item is True


def test_semantic_caching_latency_reduction(rag):
    sample_b64 = "fake_receipt_base64_data_for_caching_benchmark_001"
    sample_data = {
        "restaurant_name": "Green Park Bistro",
        "grand_total": 450,
        "line_items": [{"name": "Pasta Alfredo", "amount": 450, "qty": 1}],
    }

    # Cache miss on first lookup
    assert rag.check_semantic_cache(sample_b64) is None

    # Store in semantic cache
    rag.store_semantic_cache(sample_b64, sample_data)

    # Cache hit on second lookup
    start = time.perf_counter()
    hit_data = rag.check_semantic_cache(sample_b64)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert hit_data is not None
    assert hit_data["restaurant_name"] == "Green Park Bistro"
    # Latency should be sub-millisecond on cache hit (far below 600ms)
    assert elapsed_ms < 600.0


def test_rag_prompt_context_building(rag):
    prompt_context = rag.build_rag_prompt_context("Butter Chicken Naan tax")
    assert "Pinecone Vector Store" in prompt_context
    assert len(prompt_context) > 20


def test_eval_guardrail_report():
    report = run_all_evaluations()
    assert report["eval_1_ground_truth"]["precision_pct"] == 100.0
    assert report["eval_2_semantic_retrieval"]["accuracy_pct"] == 100.0
    assert report["eval_4_hallucination_guardrail"]["caught_hallucination"] is True
