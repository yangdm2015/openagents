import tempfile
import unittest
from pathlib import Path

from openagents.sdk.workspace_manager import WorkspaceManager


def bytecloud_profile(username: str):
    return {"username": username, "email": f"{username}@bytedance.com"}


class UserWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.workspace = WorkspaceManager(Path(self.tmp.name))
        self.assertTrue(self.workspace.initialize_workspace())

    def tearDown(self):
        self.tmp.cleanup()

    def test_bytecloud_user_upsert_and_logout_session(self):
        user = self.workspace.upsert_sso_user(
            provider="bytedance",
            external_id="yangshan.andy",
            profile={
                "username": "yangshan.andy",
                "email": "yangshan.andy@bytedance.com",
                "display_name": "Andy Yang",
                "organization": "Data",
                "employee_id": 123,
            },
        )

        self.assertEqual(user["email"], "yangshan.andy@bytedance.com")
        self.assertEqual(user["display_name"], "Andy Yang")
        self.assertEqual(user["auth_provider"], "bytedance")
        self.assertEqual(user["external_id"], "yangshan.andy")
        self.assertEqual(user["username"], "yangshan.andy")
        self.assertEqual(user.get("password_hash"), "")
        self.assertFalse(
            self.workspace.verify_user_password(
                "yangshan.andy@bytedance.com", "correct horse battery staple"
            )
        )

        updated = self.workspace.upsert_sso_user(
            provider="bytedance",
            external_id="yangshan.andy",
            profile={
                "username": "yangshan.andy",
                "email": "yangshan.andy@bytedance.com",
                "display_name": "Andy Updated",
            },
        )
        self.assertEqual(updated["id"], user["id"])
        self.assertEqual(updated["display_name"], "Andy Updated")

        session = self.workspace.create_user_session(user["id"], ttl_seconds=60)
        session_user = self.workspace.get_user_by_session(session["token"])
        self.assertEqual(session_user["id"], user["id"])

        self.assertTrue(self.workspace.revoke_user_session(session["token"]))
        self.assertIsNone(self.workspace.get_user_by_session(session["token"]))

    def test_expired_session_is_rejected(self):
        user = self.workspace.upsert_sso_user(
            "bytedance",
            "late",
            bytecloud_profile("late"),
        )
        session = self.workspace.create_user_session(user["id"], ttl_seconds=-1)

        self.assertIsNone(self.workspace.get_user_by_session(session["token"]))

    def test_agent_connect_token_is_single_use_and_agent_scoped(self):
        user = self.workspace.upsert_sso_user(
            "bytedance",
            "owner",
            bytecloud_profile("owner"),
        )
        self.workspace.save_user_agent(
            user["id"],
            agent_id="coco-one",
            agent_type="coco",
            config={"display_name": "Coco One"},
        )
        token = self.workspace.create_user_agent_connect_token(
            user["id"], "coco-one", ttl_seconds=60
        )

        self.assertIsNone(
            self.workspace.consume_user_agent_connect_token(token["token"], "other-agent")
        )
        owner = self.workspace.consume_user_agent_connect_token(token["token"], "coco-one")
        self.assertEqual(owner["user_id"], user["id"])
        self.assertEqual(owner["agent_id"], "coco-one")
        self.assertIsNone(
            self.workspace.consume_user_agent_connect_token(token["token"], "coco-one")
        )

    def test_expired_connect_token_is_rejected(self):
        user = self.workspace.upsert_sso_user(
            "bytedance",
            "owner",
            bytecloud_profile("owner"),
        )
        self.workspace.save_user_agent(user["id"], "coco-one", "coco", {})
        token = self.workspace.create_user_agent_connect_token(
            user["id"], "coco-one", ttl_seconds=-1
        )

        self.assertIsNone(
            self.workspace.consume_user_agent_connect_token(token["token"], "coco-one")
        )

    def test_private_channels_are_user_scoped_and_bindable(self):
        user_a = self.workspace.upsert_sso_user(
            "bytedance",
            "a",
            bytecloud_profile("a"),
        )
        user_b = self.workspace.upsert_sso_user(
            "bytedance",
            "b",
            bytecloud_profile("b"),
        )
        agent = self.workspace.save_user_agent(user_a["id"], "coco-one", "coco", {})
        alpha = self.workspace.create_user_channel(user_a["id"], "alpha", "A only")
        beta = self.workspace.create_user_channel(user_b["id"], "alpha", "B only")

        self.assertNotEqual(alpha["channel_name"], beta["channel_name"])
        self.assertTrue(alpha["channel_name"].startswith("u_"))
        self.assertEqual(
            [c["name"] for c in self.workspace.list_user_channels(user_a["id"])],
            ["alpha"],
        )
        self.assertEqual(
            [c["name"] for c in self.workspace.list_user_channels(user_b["id"])],
            ["alpha"],
        )

        self.assertTrue(
            self.workspace.bind_user_agent_channel(
                user_a["id"], agent["agent_id"], alpha["id"]
            )
        )
        self.assertTrue(
            self.workspace.is_user_agent_bound_to_channel(
                user_a["id"], agent["agent_id"], alpha["channel_name"]
            )
        )
        self.assertFalse(
            self.workspace.is_user_agent_bound_to_channel(
                user_b["id"], agent["agent_id"], beta["channel_name"]
            )
        )

    def test_channel_participants_primary_and_claims_are_user_scoped(self):
        user = self.workspace.upsert_sso_user(
            "bytedance",
            "owner",
            bytecloud_profile("owner"),
        )
        other = self.workspace.upsert_sso_user(
            "bytedance",
            "other",
            bytecloud_profile("other"),
        )
        self.workspace.save_user_agent(user["id"], "codex-one", "codex", {})
        self.workspace.save_user_agent(user["id"], "coco-one", "coco", {})
        self.workspace.save_user_agent(other["id"], "other-agent", "coco", {})

        channel = self.workspace.create_user_channel(
            user["id"],
            "alpha",
            "A only",
            agent_ids=["codex-one", "coco-one", "other-agent"],
            primary_agent_id="coco-one",
        )

        self.assertEqual(channel["primary_agent_id"], "coco-one")
        self.assertEqual(channel["agents"], ["codex-one", "coco-one"])
        listed = self.workspace.list_user_channels(user["id"])
        self.assertEqual(listed[0]["primary_agent_id"], "coco-one")
        self.assertEqual(listed[0]["agents"], ["codex-one", "coco-one"])

        first_claim = self.workspace.claim_user_channel_message(
            user["id"],
            channel["channel_name"],
            "message-1",
            active_agent_ids={"codex-one"},
        )
        self.assertEqual(first_claim["claimed_agent_id"], "codex-one")

        repeated_claim = self.workspace.claim_user_channel_message(
            user["id"],
            channel["channel_name"],
            "message-1",
            active_agent_ids={"coco-one"},
        )
        self.assertEqual(repeated_claim["claimed_agent_id"], "codex-one")


if __name__ == "__main__":
    unittest.main()
