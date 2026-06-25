from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone

import pika

from app.config import (
    INGEST_DLQ,
    INGEST_MAX_RETRIES,
    INGEST_QUEUE,
    RABBITMQ_HOST,
    RABBITMQ_PASSWORD,
    RABBITMQ_PORT,
    RABBITMQ_USER,
)
from app.pipeline import process_document

logger = logging.getLogger(__name__)
CONSUMER_RETRY_DELAY_SEC = 5


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connection_params() -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    return pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        credentials=credentials,
        heartbeat=600,
    )


def _declare_topology(channel):
    channel.queue_declare(queue=INGEST_DLQ, durable=True)
    try:
        channel.queue_declare(queue=INGEST_QUEUE, durable=True, passive=True)
    except pika.exceptions.ChannelClosedByBroker as exc:
        if exc.reply_code != 404:
            raise
        channel = channel.connection.channel()
        channel.queue_declare(queue=INGEST_DLQ, durable=True)
        channel.queue_declare(
            queue=INGEST_QUEUE,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": INGEST_DLQ,
            },
        )
    channel.basic_qos(prefetch_count=1)
    return channel


def _publish_json(channel, queue_name: str, job: dict) -> None:
    channel.basic_publish(
        exchange="",
        routing_key=queue_name,
        body=json.dumps(job, ensure_ascii=False).encode("utf-8"),
        properties=pika.BasicProperties(
            delivery_mode=2,
            content_type="application/json",
        ),
    )


def enqueue_job(job: dict) -> None:
    connection = pika.BlockingConnection(_connection_params())
    try:
        channel = connection.channel()
        channel = _declare_topology(channel)
        _publish_json(channel, INGEST_QUEUE, {**job, "queuedAt": _utcnow_iso()})
    finally:
        connection.close()


def _retry_count(job: dict) -> int:
    try:
        return max(0, int(job.get("retryCount", 0)))
    except Exception:
        return 0


def _on_message(ch, method, _properties, body):
    import asyncio

    job: dict | None = None
    try:
        job = json.loads(body.decode("utf-8"))
        logger.info(
            "Processing ingest job documentId=%s retry=%s",
            job.get("documentId"),
            _retry_count(job),
        )
        asyncio.run(process_document(job))
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info("Completed ingest job documentId=%s", job.get("documentId"))
    except Exception as exc:
        logger.exception("Ingest job failed")
        try:
            if job is None:
                raise
            retries = _retry_count(job)
            if retries < INGEST_MAX_RETRIES:
                retry_job = {
                    **job,
                    "retryCount": retries + 1,
                    "lastError": str(exc)[:500],
                    "retriedAt": _utcnow_iso(),
                }
                _publish_json(ch, INGEST_QUEUE, retry_job)
                ch.basic_ack(delivery_tag=method.delivery_tag)
                logger.warning(
                    "Requeued ingest job documentId=%s retry=%s/%s",
                    job.get("documentId"),
                    retries + 1,
                    INGEST_MAX_RETRIES,
                )
                return

            dlq_job = {
                **job,
                "retryCount": retries,
                "lastError": str(exc)[:500],
                "deadLetteredAt": _utcnow_iso(),
            }
            _publish_json(ch, INGEST_DLQ, dlq_job)
            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.error(
                "Dead-lettered ingest job documentId=%s after %s retries",
                job.get("documentId"),
                retries,
            )
        except Exception:
            logger.exception("Failed to retry/dead-letter ingest job")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_consumer() -> None:
    while True:
        connection = None
        try:
            connection = pika.BlockingConnection(_connection_params())
            channel = connection.channel()
            channel = _declare_topology(channel)
            channel.basic_consume(queue=INGEST_QUEUE, on_message_callback=_on_message)
            logger.info(
                "RabbitMQ consumer listening on queue=%s dlq=%s",
                INGEST_QUEUE,
                INGEST_DLQ,
            )
            channel.start_consuming()
            logger.warning(
                "RabbitMQ consumer stopped unexpectedly; reconnecting in %ss",
                CONSUMER_RETRY_DELAY_SEC,
            )
        except Exception:
            logger.exception(
                "RabbitMQ consumer crashed; retrying in %ss",
                CONSUMER_RETRY_DELAY_SEC,
            )
        finally:
            if connection and connection.is_open:
                try:
                    connection.close()
                except Exception:
                    logger.exception("Failed to close RabbitMQ connection cleanly")
        time.sleep(CONSUMER_RETRY_DELAY_SEC)


def run_consumer_in_background() -> threading.Thread:
    thread = threading.Thread(target=start_consumer, daemon=True, name="ingest-consumer")
    thread.start()
    return thread
