"""Long-polling runner for the core notification/2FA bot (telegram_bot_token)."""
import json
import signal
import time
import threading

import requests

from django.core.management.base import BaseCommand

from apps.core.bot_handler import handle_update
from apps.core.telegram import get_bot_token, _OUTBOX_KEY


class Command(BaseCommand):
    help = 'Run the core Telegram bot (notifications, 2FA, account linking) via long polling'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout', type=int, default=30,
            help='Long poll timeout in seconds (default: 30)',
        )

    def _start_outbox_worker(self):
        """Background thread: drain the Redis outbox and send via core bot token."""
        def worker():
            from django_redis import get_redis_connection
            redis = get_redis_connection('default')
            self.stdout.write('[core bot] Outbox worker started')
            while True:
                try:
                    raw = redis.lpop(_OUTBOX_KEY)
                    if not raw:
                        time.sleep(1)
                        continue
                    msg     = json.loads(raw)
                    chat_id = msg['chat_id']
                    text    = msg['text']
                    token   = get_bot_token()
                    if not token:
                        redis.rpush(_OUTBOX_KEY, raw)
                        time.sleep(5)
                        continue
                    try:
                        requests.post(
                            f'https://api.telegram.org/bot{token}/sendMessage',
                            json={'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'},
                            timeout=10,
                        ).raise_for_status()
                        self.stdout.write(f'[outbox] sent to {chat_id}')
                    except Exception as exc:
                        self.stderr.write(f'[outbox] send failed to {chat_id}: {exc}')
                except Exception as exc:
                    self.stderr.write(f'[outbox] error: {exc}')
                    time.sleep(2)

        t = threading.Thread(target=worker, daemon=True)
        t.start()

    def handle(self, *args, **options):
        poll_timeout = options['timeout']
        self.stdout.write('Starting core Telegram bot (long polling)...')
        self._start_outbox_worker()

        offset = 0
        running = True
        webhook_cleared = False
        last_token = None

        def _shutdown(*_):
            nonlocal running
            self.stdout.write('\n[core bot] Shutting down...')
            running = False

        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        while running:
            try:
                token = get_bot_token()
                if not token:
                    self.stderr.write(
                        '[core bot] telegram_bot_token not configured — waiting 30s...'
                    )
                    time.sleep(30)
                    continue

                if token != last_token:
                    self.stdout.write(f'[core bot] Token found (ends ...{token[-6:]})')
                    webhook_cleared = False
                    last_token = token

                if not webhook_cleared:
                    try:
                        r = requests.post(
                            f'https://api.telegram.org/bot{token}/deleteWebhook',
                            json={'drop_pending_updates': False},
                            timeout=10,
                        )
                        self.stdout.write(
                            f'[core bot] Webhook cleared: {r.json().get("description", "ok")}'
                        )
                    except Exception as exc:
                        self.stderr.write(f'[core bot] Warning: could not delete webhook: {exc}')
                    webhook_cleared = True

                resp = requests.post(
                    f'https://api.telegram.org/bot{token}/getUpdates',
                    json={
                        'offset': offset,
                        'timeout': poll_timeout,
                        'allowed_updates': ['message', 'callback_query'],
                    },
                    timeout=poll_timeout + 5,
                )
                data = resp.json()

                if not data.get('ok'):
                    self.stderr.write(f'[core bot] getUpdates error: {data}')
                    time.sleep(5)
                    continue

                for update in data.get('result', []):
                    try:
                        handle_update(update, token)
                    except Exception as exc:
                        import traceback as _tb
                        self.stderr.write(
                            f'[core bot] ERROR update {update.get("update_id")}: {exc}\n'
                            + _tb.format_exc()
                        )
                    offset = update['update_id'] + 1

            except requests.exceptions.Timeout:
                continue
            except Exception as exc:
                import traceback as _tb
                self.stderr.write(f'[core bot] Polling error: {exc}\n' + _tb.format_exc())
                time.sleep(5)

        self.stdout.write('[core bot] Stopped.')
