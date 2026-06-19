import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.sql_resolve import resolve_scope_user  # noqa: E402


class SqlResolveTests(unittest.IsolatedAsyncioTestCase):
    async def test_resolve_scope_user_enriches_student_scope(self):
        user = {"roles": ["HOC_VIEN"], "username": "student-user", "userId": "USR001"}
        with patch(
            "app.sql_resolve.resolve_student_ma_hv",
            AsyncMock(return_value="666106"),
        ):
            enriched = await resolve_scope_user(user)

        self.assertEqual(enriched["scopeMaHv"], "666106")
        self.assertEqual(user.get("scopeMaHv"), None)

    async def test_resolve_scope_user_enriches_lecturer_scope(self):
        user = {"roles": ["GIANG_VIEN"], "username": "lecturer-user", "userId": "USR055"}
        with patch(
            "app.sql_resolve.resolve_lecturer_ma_gv",
            AsyncMock(return_value="GV5976"),
        ):
            enriched = await resolve_scope_user(user)

        self.assertEqual(enriched["scopeMaGv"], "GV5976")


if __name__ == "__main__":
    unittest.main()
