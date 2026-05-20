import unittest

from openagents.utils.admin_auth import is_hardcoded_admin_user


class AdminAuthTests(unittest.TestCase):
    def test_hardcoded_admin_prefix_is_allowed(self):
        self.assertTrue(
            is_hardcoded_admin_user({"email": "yangshan.andy@bytedance.com"})
        )

    def test_other_bytedance_users_are_not_admin(self):
        self.assertFalse(
            is_hardcoded_admin_user({"email": "someone.else@bytedance.com"})
        )


if __name__ == "__main__":
    unittest.main()
