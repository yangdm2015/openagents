import unittest

from openagents.mods.workspace.messaging.mod import ThreadMessagingNetworkMod


class FakeEventGateway:
    def __init__(self):
        self.channels = {}

    def create_channel(self, name):
        self.channels.setdefault(name, set())

    def get_channel_members(self, name):
        return set(self.channels.get(name, set()))

    def add_channel_member(self, name, agent_id):
        self.channels.setdefault(name, set()).add(agent_id)


class FakeNetwork:
    def __init__(self):
        self.event_gateway = FakeEventGateway()


class PrivateChannelAccessTests(unittest.TestCase):
    def test_local_agents_only_join_bound_private_channels(self):
        mod = ThreadMessagingNetworkMod()
        mod._network = FakeNetwork()
        mod._create_channel("general", "General")
        mod._create_channel(
            "u_owner_alpha",
            "Alpha",
            visibility="private",
            owner_user_id="owner-1",
        )

        mod.agent_metadata["web-session"] = {
            "owner_user_id": "owner-1",
            "platform": "web",
        }
        mod.agent_metadata["bound-agent"] = {
            "owner_user_id": "owner-1",
            "platform": "local-connector",
            "private_channels": ["u_owner_alpha"],
        }
        mod.agent_metadata["unbound-agent"] = {
            "owner_user_id": "owner-1",
            "platform": "local-connector",
            "private_channels": [],
        }

        self.assertTrue(mod._source_can_access_channel("web-session", "u_owner_alpha"))
        self.assertTrue(mod._source_can_access_channel("bound-agent", "u_owner_alpha"))
        self.assertFalse(mod._source_can_access_channel("unbound-agent", "u_owner_alpha"))

        for agent_id in ["web-session", "bound-agent", "unbound-agent"]:
            mod._add_agent_to_allowed_channels(agent_id)

        self.assertIn("web-session", mod.network.event_gateway.get_channel_members("u_owner_alpha"))
        self.assertIn("bound-agent", mod.network.event_gateway.get_channel_members("u_owner_alpha"))
        self.assertNotIn("unbound-agent", mod.network.event_gateway.get_channel_members("u_owner_alpha"))
        self.assertIn("unbound-agent", mod.network.event_gateway.get_channel_members("general"))


if __name__ == "__main__":
    unittest.main()
