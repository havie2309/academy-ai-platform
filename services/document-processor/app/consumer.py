import json
import logging
import threading

import pika

from app.config import (
    INGEST_QUEUE,
    RABBITMQ_HOST,
    RABBITMQ_PASSWORD,
    RABBITMQ_PORT,
    RABBITMQ_USER,
)
from app.pipeline import process_document

logger = logging.getLogger(__name__)


def _on_message(ch, method, _properties, body):
    import asyncio

    try:
        job = json.loads(body.decode("utf-8"))
        logger.info("Processing ingest job documentId=%s", job.get("documentId"))
        asyncio.run(process_document(job))
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info("Completed ingest job documentId=%s", job.get("documentId"))
    except Exception:
        logger.exception("Ingest job failed")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_consumer() -> None:
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    params = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        credentials=credentials,
        heartbeat=600,
    )
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue=INGEST_QUEUE, durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=INGEST_QUEUE, on_message_callback=_on_message)
    logger.info("RabbitMQ consumer listening on queue=%s", INGEST_QUEUE)
    channel.start_consuming()


def run_consumer_in_background() -> threading.Thread:
    thread = threading.Thread(target=start_consumer, daemon=True, name="ingest-consumer")
    thread.start()
    return thread
