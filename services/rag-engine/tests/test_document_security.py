import sys
import unittest
from pathlib import Path

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

    def test_legacy_ai_metadata_no_longer_blocks_if_acl_allows(self):
        decision = evaluate_document_security(
            _meta(aiAccessPolicy="deny", publicationStatus="confidential"),
            STUDENT,
        )
        self.assertTrue(decision.allowed)

    def test_department_scope_allows_matching_department(self):
        decision = evaluate_document_security(
            _meta(
                scopeType="department",
                accessDepartmentCodes=["CNTT"],
            ),
            STUDENT,
        )
        self.assertTrue(decision.allowed)

    def test_role_scope_blocks_non_matching_role(self):
        decision = evaluate_document_security(
            _meta(
                securityLevel="restricted",
                scopeType="role",
                accessRoleCodes=["GIANG_VIEN"],
            ),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "acl-insufficient")

    def test_custom_scope_blocks_other_user(self):
        decision = evaluate_document_security(
            _meta(
                scopeType="custom",
                accessUserIds=["u-other"],
            ),
            STUDENT,
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.matched_rule_id, "acl-insufficient")

    def test_confidential_level_allows_privileged_admin(self):
        decision = evaluate_document_security(
            _meta(
                securityLevel="confidential",
                scopeType="role",
                accessRoleCodes=["ADMIN"],
            ),
            ADMIN,
        )
        self.assertTrue(decision.allowed)

    def test_chunk_metadata_overrides_document_metadata(self):
        merged = merge_chunk_and_document_metadata(
            {
                "scopeType": "custom",
                "accessUserIds": ["u-student"],
            },
            {
                "category": "Lịch thi",
                "securityLevel": "internal",
                "scopeType": "all",
            },
        )
        decision = evaluate_document_security(merged, STUDENT)
        self.assertTrue(decision.allowed)
        self.assertEqual(merged["domain"], "exam")
        self.assertEqual(merged["documentType"], "exam")

    def test_filter_rows_logs_and_filters_acl_only(self):
        rows = [
            {
                "documentId": "d1",
                "chunkId": "p1",
                "metadata": _meta(
                    securityLevel="internal",
                    scopeType="all",
                ),
            },
            {
                "documentId": "d2",
                "chunkId": "p2",
                "metadata": _meta(
                    securityLevel="restricted",
                    scopeType="role",
                    accessRoleCodes=["GIANG_VIEN"],
                ),
            },
        ]
        allowed, blocked = filter_rows_by_document_security(
            rows,
            STUDENT,
            query="tai lieu noi bo",
        )
        self.assertEqual(len(allowed), 1)
        self.assertEqual(allowed[0]["chunkId"], "p1")
        self.assertEqual(len(blocked), 1)
        self.assertEqual(blocked[0][1].matched_rule_id, "acl-insufficient")


if __name__ == "__main__":
    unittest.main()
