"""
Kafka producer singleton.

All produce calls are fire-and-forget: exceptions are caught and logged so that
Kafka being unavailable never blocks an HTTP response.

Topics created automatically (KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE=true):
  sbrw.book.downloaded       — book file was served to a user
  sbrw.book.convert_request  — user requested format conversion
"""
import json
import logging
import threading
from django.conf import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_producer = None


def _get_producer():
    global _producer
    if _producer is not None:
        return _producer
    with _lock:
        if _producer is not None:
            return _producer
        try:
            from confluent_kafka import Producer
            _producer = Producer({
                'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
                'socket.timeout.ms': 3000,
                'message.timeout.ms': 5000,
                'delivery.timeout.ms': 6000,
            })
            logger.info('Kafka producer connected to %s', settings.KAFKA_BOOTSTRAP_SERVERS)
        except Exception as exc:
            logger.warning('Kafka producer unavailable: %s', exc)
            _producer = None
    return _producer


def _delivery_cb(err, msg):
    if err:
        logger.warning('Kafka delivery failed [%s]: %s', msg.topic(), err)


def produce(topic: str, payload: dict, key: str | None = None):
    """Produce a JSON message; silently no-ops if Kafka is unavailable."""
    producer = _get_producer()
    if producer is None:
        return
    try:
        producer.produce(
            topic,
            value=json.dumps(payload).encode(),
            key=key.encode() if key else None,
            on_delivery=_delivery_cb,
        )
        producer.poll(0)                                               
    except Exception as exc:
        logger.warning('Kafka produce error on %s: %s', topic, exc)



TOPIC_DOWNLOADED      = 'sbrw.book.downloaded'
TOPIC_CONVERT_REQUEST = 'sbrw.book.convert_request'
TOPIC_LLM_ANALYZE     = 'sbrw.book.llm_analyze'


def emit_book_downloaded(book_id: str, fmt: str, user_id: str | None = None):
    produce(TOPIC_DOWNLOADED, {
        'book_id': str(book_id),
        'format': fmt,
        'user_id': str(user_id) if user_id else None,
    }, key=str(book_id))


def emit_convert_request(book_id: str, target_format: str, user_id: str | None = None):
    produce(TOPIC_CONVERT_REQUEST, {
        'book_id': str(book_id),
        'target_format': target_format,
        'user_id': str(user_id) if user_id else None,
    }, key=str(book_id))
