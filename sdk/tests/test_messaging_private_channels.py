import unittest

from openagents.models.event import Event
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
        self.processed_events = []

    async def process_event(self, event):
        self.processed_events.append(event)


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

    def test_channel_message_is_dispatched_to_single_claimed_primary_agent(self):
        async def run():
            mod = ThreadMessagingNetworkMod()
            mod._network = FakeNetwork()
            mod._create_channel(
                "u_owner_alpha",
                "Alpha",
                visibility="private",
                owner_user_id="owner-1",
            )
            mod.channels["u_owner_alpha"]["participant_agent_ids"] = ["codex-one", "coco-one"]
            mod.channels["u_owner_alpha"]["primary_agent_id"] = "coco-one"
            mod.active_agents.update({"codex-one", "coco-one"})
            mod.agent_metadata["web-session"] = {
                "owner_user_id": "owner-1",
                "platform": "web",
            }
            mod.agent_metadata["codex-one"] = {
                "owner_user_id": "owner-1",
                "platform": "local-connector",
                "private_channels": ["u_owner_alpha"],
            }
            mod.agent_metadata["coco-one"] = {
                "owner_user_id": "owner-1",
                "platform": "local-connector",
                "private_channels": ["u_owner_alpha"],
            }

            message = Event(
                event_name="thread.channel_message.post",
                event_id="message-1",
                source_id="web-session",
                destination_id="channel:u_owner_alpha",
                payload={
                    "channel": "u_owner_alpha",
                    "content": {"text": "hello"},
                    "message_type": "channel_message",
                },
            )
            await mod._broadcast_channel_message(message)

            self.assertEqual(len(mod.network.processed_events), 1)
            self.assertEqual(mod.network.processed_events[0].destination_id, "coco-one")

        import asyncio

        asyncio.run(run())

    def test_agent_channel_message_does_not_trigger_other_agents(self):
        async def run():
            mod = ThreadMessagingNetworkMod()
            mod._network = FakeNetwork()
            mod._create_channel(
                "u_owner_alpha",
                "Alpha",
                visibility="private",
                owner_user_id="owner-1",
            )
            mod.channels["u_owner_alpha"]["participant_agent_ids"] = ["codex-one", "coco-one"]
            mod.channels["u_owner_alpha"]["primary_agent_id"] = "coco-one"
            mod.active_agents.update({"codex-one", "coco-one"})
            mod.agent_metadata["codex-one"] = {
                "owner_user_id": "owner-1",
                "platform": "local-connector",
                "private_channels": ["u_owner_alpha"],
            }
            mod.agent_metadata["coco-one"] = {
                "owner_user_id": "owner-1",
                "platform": "local-connector",
                "private_channels": ["u_owner_alpha"],
            }

            message = Event(
                event_name="thread.channel_message.post",
                event_id="agent-message-1",
                source_id="codex-one",
                destination_id="channel:u_owner_alpha",
                payload={
                    "channel": "u_owner_alpha",
                    "content": {"text": "agent reply"},
                    "message_type": "channel_message",
                },
            )
            await mod._broadcast_channel_message(message)

            self.assertEqual(mod.network.processed_events, [])

        import asyncio

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
