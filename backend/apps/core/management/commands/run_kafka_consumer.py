"""
Django management command: python manage.py run_kafka_consumer

Runs a long-lived Kafka consumer loop that handles async events:

  sbrw.book.downloaded       → batch-updates download_count in DB
  sbrw.book.convert_request  → runs ebook-convert and stores the output file

Designed to run as a separate Docker service (kafka-worker) so it never blocks
the main web process.
"""
import json
import logging
import signal
import time
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)

                                                                               
DOWNLOAD_FLUSH_INTERVAL = 30
                                      
_running = True


def _handle_signal(sig, frame):
    global _running
    logger.info('Kafka consumer shutting down (signal %s)…', sig)
    _running = False


class Command(BaseCommand):
    help = 'Run the Kafka consumer loop for async book events'

    def handle(self, *args, **options):
        signal.signal(signal.SIGTERM, _handle_signal)
        signal.signal(signal.SIGINT, _handle_signal)

        try:
            from confluent_kafka import Consumer, KafkaException, KafkaError
        except ImportError:
            self.stderr.write('confluent-kafka is not installed.')
            return

        servers = settings.KAFKA_BOOTSTRAP_SERVERS
        topics = [
            'sbrw.book.downloaded',
            'sbrw.book.convert_request',
            'sbrw.book.llm_analyze',
        ]

        consumer = Consumer({
            'bootstrap.servers': servers,
            'group.id': 'sbrw-worker',
            'auto.offset.reset': 'earliest',
            'enable.auto.commit': True,
            'session.timeout.ms': 30000,
            'heartbeat.interval.ms': 10000,
        })

                                                                     
        connected = False
        for attempt in range(20):
            try:
                consumer.subscribe(topics)
                connected = True
                self.stdout.write(f'Kafka consumer subscribed to {topics}')
                break
            except KafkaException as exc:
                self.stdout.write(f'Waiting for Kafka… ({attempt+1}/20): {exc}')
                time.sleep(5)

        if not connected:
            self.stderr.write('Could not connect to Kafka after 20 attempts. Exiting.')
            return

                                                      
        download_pending: dict[str, int] = defaultdict(int)
        last_flush = time.monotonic()

        def flush_downloads():
            if not download_pending:
                return
            from apps.books.models import Book
            for book_id, count in list(download_pending.items()):
                try:
                    Book.objects.filter(id=book_id).update(
                        download_count=Book.objects.filter(id=book_id).values_list('download_count', flat=True).first() + count
                    )
                    del download_pending[book_id]
                except Exception as exc:
                    logger.warning('Failed to flush download count for %s: %s', book_id, exc)

        def handle_downloaded(payload):
            book_id = payload.get('book_id')
            if book_id:
                download_pending[book_id] += 1
                logger.debug('Queued download count +1 for book %s', book_id)

        def handle_convert_request(payload):
            book_id = payload.get('book_id')
            target_fmt = payload.get('target_format', '')
            if not book_id or not target_fmt:
                return
            try:
                from apps.books.models import Book, BookFile
                from apps.books.services import convert_book_file, CONVERT_OUTPUT_FORMATS
                book = Book.objects.prefetch_related('files').get(id=book_id)

                                    
                if book.files.filter(format=target_fmt).exists():
                    logger.info('Convert skip: %s already has %s', book_id, target_fmt)
                    return

                src = book.files.filter(format__in=CONVERT_OUTPUT_FORMATS).first()
                if not src:
                    logger.warning('Convert failed: no convertible source for %s', book_id)
                    return

                dst_path, dst_size = convert_book_file(src.file_path, str(book_id), target_fmt)
                BookFile.objects.get_or_create(
                    book=book, format=target_fmt,
                    defaults={'file_path': dst_path, 'file_size': dst_size}
                )
                logger.info('Async conversion done: %s → %s', book_id, target_fmt)
            except Exception as exc:
                logger.error('Async conversion error for %s: %s', book_id, exc)

        def handle_llm_analyze(payload):
            book_id   = payload.get('book_id')
            file_path = payload.get('file_path', '')
            title     = payload.get('title', '')
            authors   = payload.get('authors', [])
            if not book_id:
                return
            try:
                from apps.books.models import Book
                from apps.books.services import extract_book_text, get_file_format
                from apps.books.llm_client import call_llm_service

                                          
                import os
                abs_path = file_path
                if not os.path.isabs(abs_path):
                    abs_path = os.path.join('/app/uploads', abs_path.lstrip('/'))
                if not os.path.exists(abs_path):
                                                     
                    from django.conf import settings as dj_settings
                    abs_path = os.path.join(dj_settings.UPLOAD_DIR, file_path.lstrip('/'))

                if not os.path.exists(abs_path):
                    logger.warning('LLM analyze: file not found for book %s: %s', book_id, file_path)
                    Book.objects.filter(id=book_id).update(ai_review_status='error')
                    return

                fmt = get_file_format(abs_path)
                with open(abs_path, 'rb') as f:
                    file_data = f.read(10 * 1024 * 1024)

                book_text = extract_book_text(file_data, fmt)
                if not book_text:
                    logger.warning('LLM analyze: could not extract text for book %s', book_id)
                    Book.objects.filter(id=book_id).update(ai_review_status='error')
                    return

                result = call_llm_service(book_text, title, authors)
                review = result.get('review')
                if review:
                    Book.objects.filter(id=book_id).update(
                        ai_review=review, ai_review_status='done'
                    )
                    logger.info('LLM review saved for book %s', book_id)
                elif result.get('error'):
                    logger.warning('LLM error for book %s: %s', book_id, result['error'])
                    Book.objects.filter(id=book_id).update(ai_review_status='error')
                else:
                    Book.objects.filter(id=book_id).update(ai_review_status='error')
            except Exception as exc:
                logger.error('LLM analyze failed for book %s: %s', book_id, exc)
                try:
                    from apps.books.models import Book
                    Book.objects.filter(id=book_id).update(ai_review_status='error')
                except Exception:
                    pass

        handlers = {
            'sbrw.book.downloaded':      handle_downloaded,
            'sbrw.book.convert_request': handle_convert_request,
            'sbrw.book.llm_analyze':     handle_llm_analyze,
        }

        self.stdout.write('Kafka consumer running…')

        while _running:
            msg = consumer.poll(timeout=1.0)

            if msg is None:
                pass
            elif msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.error('Kafka error: %s', msg.error())
            else:
                topic = msg.topic()
                try:
                    payload = json.loads(msg.value().decode())
                    handler = handlers.get(topic)
                    if handler:
                        handler(payload)
                except Exception as exc:
                    logger.error('Message processing error [%s]: %s', topic, exc)

                                                      
            if time.monotonic() - last_flush >= DOWNLOAD_FLUSH_INTERVAL:
                flush_downloads()
                last_flush = time.monotonic()

                                 
        flush_downloads()
        consumer.close()
        self.stdout.write('Kafka consumer stopped.')
