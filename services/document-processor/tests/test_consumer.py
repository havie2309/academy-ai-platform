import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.consumer as consumer  # noqa: E402


class _FakeChannel:
    def __init__(self):
        self.acks: list[str] = []
        self.nacks: list[tuple[str, bool]] = []

    def basic_ack(self, delivery_tag):
        self.acks.append(delivery_tag)

    def basic_nack(self, delivery_tag, requeue=False):
        self.nacks.append((delivery_tag, requeue))


class _FakeMethod:
    delivery_tag = "tag-1"


class _FakeTopologyChannel:
    def __init__(self, *, raise_not_found: bool = False):
        self.raise_not_found = raise_not_found
        self.calls: list[tuple[str, dict]] = []
        self.qos: list[int] = []
        self.reopened: "_FakeTopologyChannel | None" = None
        self.connection = self

    def queue_declare(self, **kwargs):
        self.calls.append(("queue_declare", kwargs))
        if kwargs.get("passive") and self.raise_not_found:
            raise consumer.pika.exceptions.ChannelClosedByBroker(404, "NOT_FOUND")

    def basic_qos(self, prefetch_count: int):
        self.qos.append(prefetch_count)

    def channel(self):
        self.reopened = _FakeTopologyChannel()
        return self.reopened


class ConsumerTests(unittest.TestCase):
    def test_on_message_acks_success(self):
        channel = _FakeChannel()
        body = json.dumps({"documentId": "doc-1", "storagePath": "file.pdf"}).encode(
            "utf-8"
        )

        async def _ok(_job):
            return {"status": "completed"}

        with patch.object(consumer, "process_document", new=_ok):
            consumer._on_message(channel, _FakeMethod(), None, body)

        self.assertEqual(channel.acks, ["tag-1"])
        self.assertEqual(channel.nacks, [])

    def test_on_message_requeues_before_dlq(self):
        channel = _FakeChannel()
        body = json.dumps({"documentId": "doc-2", "storagePath": "file.pdf"}).encode(
            "utf-8"
        )
        published: list[tuple[str, dict]] = []

        async def _fail(_job):
            raise RuntimeError("temporary failure")

        def _capture_publish(_channel, queue_name: str, job: dict):
            published.append((queue_name, job))

        with (
            patch.object(consumer, "process_document", new=_fail),
            patch.object(consumer, "_publish_json", new=_capture_publish),
            patch.object(consumer, "INGEST_MAX_RETRIES", 3),
        ):
            consumer._on_message(channel, _FakeMethod(), None, body)

        self.assertEqual(channel.acks, ["tag-1"])
        self.assertEqual(channel.nacks, [])
        self.assertEqual(len(published), 1)
        self.assertEqual(published[0][0], consumer.INGEST_QUEUE)
        self.assertEqual(published[0][1]["retryCount"], 1)
        self.assertEqual(published[0][1]["lastError"], "temporary failure")

    def test_on_message_dead_letters_after_max_retries(self):
        channel = _FakeChannel()
        body = json.dumps(
            {
                "documentId": "doc-3",
                "storagePath": "file.pdf",
                "retryCount": 3,
            }
        ).encode("utf-8")
        published: list[tuple[str, dict]] = []

        async def _fail(_job):
            raise RuntimeError("still failing")

        def _capture_publish(_channel, queue_name: str, job: dict):
            published.append((queue_name, job))

        with (
            patch.object(consumer, "process_document", new=_fail),
            patch.object(consumer, "_publish_json", new=_capture_publish),
            patch.object(consumer, "INGEST_MAX_RETRIES", 3),
        ):
            consumer._on_message(channel, _FakeMethod(), None, body)

        self.assertEqual(channel.acks, ["tag-1"])
        self.assertEqual(channel.nacks, [])
        self.assertEqual(len(published), 1)
        self.assertEqual(published[0][0], consumer.INGEST_DLQ)
        self.assertEqual(published[0][1]["retryCount"], 3)
        self.assertEqual(published[0][1]["lastError"], "still failing")
        self.assertIn("deadLetteredAt", published[0][1])

    def test_on_message_nacks_when_retry_publish_fails(self):
        channel = _FakeChannel()
        body = json.dumps({"documentId": "doc-4", "storagePath": "file.pdf"}).encode(
            "utf-8"
        )

        async def _fail(_job):
            raise RuntimeError("broken")

        def _raise_publish(_channel, _queue_name: str, _job: dict):
            raise RuntimeError("publish failed")

        with (
            patch.object(consumer, "process_document", new=_fail),
            patch.object(consumer, "_publish_json", new=_raise_publish),
            patch.object(consumer, "INGEST_MAX_RETRIES", 2),
        ):
            consumer._on_message(channel, _FakeMethod(), None, body)

        self.assertEqual(channel.acks, [])
        self.assertEqual(channel.nacks, [("tag-1", False)])

    def test_start_consumer_retries_after_connection_error(self):
        attempts = {"count": 0}

        def _fail_connect(*_args, **_kwargs):
            attempts["count"] += 1
            raise RuntimeError("rabbit unavailable")

        def _stop_sleep(_seconds):
            raise StopIteration

        with (
            patch.object(consumer.pika, "BlockingConnection", side_effect=_fail_connect),
            patch.object(consumer.time, "sleep", side_effect=_stop_sleep),
        ):
            with self.assertRaises(StopIteration):
                consumer.start_consumer()

        self.assertEqual(attempts["count"], 1)

    def test_declare_topology_reopens_channel_when_queue_missing(self):
        channel = _FakeTopologyChannel(raise_not_found=True)

        returned = consumer._declare_topology(channel)

        self.assertIsNot(returned, channel)
        self.assertIs(returned, channel.reopened)
        self.assertEqual(returned.qos, [1])
        self.assertTrue(
            any(
                call[1].get("arguments", {}).get("x-dead-letter-routing-key")
                == consumer.INGEST_DLQ
                for call in returned.calls
            )
        )


if __name__ == "__main__":
    unittest.main()
