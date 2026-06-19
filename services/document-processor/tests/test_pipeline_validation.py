import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.pipeline import _validate_job  # noqa: E402


class PipelineValidationTests(unittest.TestCase):
    def test_validate_job_requires_role_codes_for_role_scope(self):
        with self.assertRaisesRegex(ValueError, "accessRoleCodes"):
            _validate_job(
                {
                    "documentId": "doc-1",
                    "storagePath": "file.pdf",
                    "scopeType": "role",
                    "securityLevel": "internal",
                }
            )

    def test_validate_job_requires_known_security_level(self):
        with self.assertRaisesRegex(ValueError, "Mức mật"):
            _validate_job(
                {
                    "documentId": "doc-1",
                    "storagePath": "file.pdf",
                    "securityLevel": "top-secret",
                }
            )

    def test_validate_job_normalizes_scope_lists(self):
        job = _validate_job(
            {
                "documentId": " doc-2 ",
                "storagePath": " file.pdf ",
                "title": "  Bảng điểm  ",
                "securityLevel": "RESTRICTED",
                "scopeType": "department",
                "accessDepartmentCodes": ["P2", "P2", " ", "P3"],
                "accessRoleCodes": ["ADMIN"],
                "accessUserIds": ["u1"],
            }
        )
        self.assertEqual(job["documentId"], "doc-2")
        self.assertEqual(job["storagePath"], "file.pdf")
        self.assertEqual(job["title"], "Bảng điểm")
        self.assertEqual(job["securityLevel"], "restricted")
        self.assertEqual(job["scopeType"], "department")
        self.assertEqual(job["accessDepartmentCodes"], ["P2", "P3"])
        self.assertEqual(job["accessRoleCodes"], [])
        self.assertEqual(job["accessUserIds"], [])


if __name__ == "__main__":
    unittest.main()
