import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.guardrails.document_security import (  # noqa: E402
    evaluate_document_security,
    filter_rows_by_document_security,
    merge_chunk_and_document_metadata,
)

STUDENT = {
    "userId": "u-student",
    "roles": ["HOC_VIEN"],
    "department": "CNTT",
    "maxSecurityLevel": 2,
}

ADMIN = {
    "userId": "u-admin",
    "roles": ["ADMIN"],
    "department": "CNTT",
    "maxSecurityLevel": 4,
}


def _meta(**overrides) -> dict:
    base = {
        "documentType": "document",
        "domain": "general",
        "securityLevel": "internal",
        "publicationStatus": "internal",
        "aiAccessPolicy": "allow",
        "scopeType": "all",
        "title": "Tai lieu",
    }
    base.update(overrides)
    return base


class DocumentSecurityTests(unittest.TestCase):
    def test_legacy_internal_document_allowed(self):
        decision = evaluate_document_security(_meta(), STUDENT)
        self.assertTrue(decision.allowed)

    def test_ai_access_deny_blocks(self):
        decision = evaluate_document_security(
            _meta(aiAccessPolicy="deny"),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "ai-access-deny")

    def test_practice_exam_public_allowed(self):
        decision = evaluate_document_security(
            _meta(
                domain="exam",
                documentType="exam",
                securityLevel="public",
                publicationStatus="public",
                aiAccessPolicy="allow",
                domainMetadata={"examType": "practice", "examStatus": "upcoming"},
            ),
            STUDENT,
        )
        self.assertTrue(decision.allowed)

    def test_official_upcoming_embargoed_denied(self):
        decision = evaluate_document_security(
            _meta(
                domain="exam",
                documentType="exam",
                securityLevel="confidential",
                publicationStatus="embargoed",
                aiAccessPolicy="deny",
                domainMetadata={"examType": "official", "examStatus": "upcoming"},
            ),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "exam-official-embargoed")

    def test_official_upcoming_not_public_denied_even_if_user_claims_public(self):
        decision = evaluate_document_security(
            _meta(
                domain="exam",
                documentType="exam",
                securityLevel="internal",
                publicationStatus="internal",
                aiAccessPolicy="allow",
                domainMetadata={"examType": "official", "examStatus": "active"},
            ),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "exam-official-unpublished")

    def test_answer_key_denied_before_generic_ai_deny(self):
        decision = evaluate_document_security(
            _meta(
                domain="exam",
                documentType="answer_key",
                securityLevel="confidential",
                publicationStatus="confidential",
                aiAccessPolicy="deny",
                domainMetadata={"examType": "answer_key", "examStatus": "active"},
            ),
            ADMIN,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "exam-answer-leak")
        self.assertEqual(
            decision.audit_payload()["denyReason"],
            "Exam answer or solution content is not allowed for AI retrieval.",
        )

    def test_answer_key_tag_denied(self):
        decision = evaluate_document_security(
            _meta(domain="exam", tags=["answer_key"], domainMetadata={}),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "exam-answer-leak")

    def test_exam_missing_metadata_denied(self):
        decision = evaluate_document_security(
            _meta(domain="exam", documentType="exam"),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "metadata-missing-exam")

    def test_legacy_exam_category_from_document_fallback_denied(self):
        merged = merge_chunk_and_document_metadata(
            {"securityLevel": "internal", "scopeType": "all", "title": "De thi"},
            {"category": "Lịch thi", "docId": "legacy-1"},
        )
        decision = evaluate_document_security(merged, STUDENT)
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "metadata-missing-exam")
        self.assertEqual(merged["domain"], "exam")

    def test_chunk_metadata_overrides_document_metadata(self):
        merged = merge_chunk_and_document_metadata(
            {
                "domainMetadata": {"examType": "practice", "examStatus": "upcoming"},
                "publicationStatus": "public",
            },
            {
                "category": "Lịch thi",
                "domain": "exam",
                "publicationStatus": "internal",
            },
        )
        decision = evaluate_document_security(
            {**merged, "securityLevel": "public", "scopeType": "all"},
            STUDENT,
        )
        self.assertTrue(decision.allowed)

    def test_acl_insufficient_for_restricted(self):
        decision = evaluate_document_security(
            _meta(
                securityLevel="restricted",
                publicationStatus="internal",
                scopeType="role",
                accessRoleCodes=["GIANG_VIEN"],
            ),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "acl-insufficient")

    def test_filter_rows_logs_and_filters(self):
        rows = [
            {
                "documentId": "d1",
                "chunkId": "p1",
                "metadata": _meta(
                    domain="exam",
                    domainMetadata={"examType": "official", "examStatus": "upcoming"},
                    publicationStatus="internal",
                ),
            },
            {
                "documentId": "d2",
                "chunkId": "p2",
                "metadata": _meta(
                    domain="exam",
                    publicationStatus="public",
                    domainMetadata={"examType": "practice", "examStatus": "upcoming"},
                ),
            },
        ]
        with patch(
            "app.guardrails.document_security.persist_document_security_audit",
            new=AsyncMock(),
        ):
            allowed, blocked = filter_rows_by_document_security(
                rows,
                STUDENT,
                query="de thi thu cong khai",
            )
        self.assertEqual(len(allowed), 1)
        self.assertEqual(allowed[0]["chunkId"], "p2")
        self.assertEqual(len(blocked), 1)
        self.assertEqual(blocked[0][1].matched_rule_id, "exam-official-unpublished")


if __name__ == "__main__":
    unittest.main()
