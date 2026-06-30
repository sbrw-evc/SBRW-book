"""Long-polling runner for the Telegram upload bot."""
import json
import logging
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand

from apps.telegram_upload.bot import get_token
from apps.telegram_upload.handlers import handle_update

logger = logging.getLogger(__name__)


def _write_heartbeat(telegram_ok: bool = False) -> None:
    try:
        wg = subprocess.run(['awg', 'show', 'awg0'], capture_output=True, text=True)
        vpn_up = wg.returncode == 0
        from django.core.cache import cache
        cache.set('sbrw:bot_heartbeat', json.dumps({
            'last_seen': datetime.now(dt_timezone.utc).isoformat(),
            'vpn_up': vpn_up,
            'vpn_peers': wg.stdout.count('peer:') if vpn_up else 0,
            'telegram_ok': telegram_ok,
        }), timeout=120)
    except Exception:
        pass


class Command(BaseCommand):
    help = 'Run the Telegram upload bot via long polling (for bot container use)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout', type=int, default=30,
            help='Long poll timeout in seconds (default: 30)',
        )

    def handle(self, *args, **options):
        poll_timeout = options['timeout']

        self.stdout.write('Starting Telegram upload bot (long polling)...')

        import requests

        offset = 0
        running = True
        webhook_cleared = False

        def _shutdown(*_):
            nonlocal running
            self.stdout.write('\nShutting down...')
            running = False

        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        self.stdout.write(f'Bot running. Long-poll timeout={poll_timeout}s')

        last_token = None
        while running:
            try:
                                                                           
                current_token = get_token()
                if not current_token:
                    self.stderr.write(
                        '[bot] Token not configured — set telegram_bot_token (or '
                        'telegram_upload_bot_token) in admin settings. Waiting 30s...'
                    )
                    last_token = None
                    webhook_cleared = False
                    _write_heartbeat(telegram_ok=False)
                    time.sleep(30)
                    continue

                if current_token != last_token:
                    self.stdout.write(f'[bot] Token found (ends ...{current_token[-6:]})')
                    webhook_cleared = False
                    last_token = current_token

                                                                                    
                if not webhook_cleared:
                    try:
                        r = requests.post(
                            f'https://api.telegram.org/bot{current_token}/deleteWebhook',
                            json={'drop_pending_updates': False},
                            timeout=10,
                        )
                        self.stdout.write(f'Webhook cleared: {r.json().get("description", "ok")}')
                    except Exception as exc:
                        self.stderr.write(f'Warning: could not delete webhook: {exc}')
                    webhook_cleared = True

                resp = requests.post(
                    f'https://api.telegram.org/bot{current_token}/getUpdates',
                    json={
                        'offset': offset,
                        'timeout': poll_timeout,
                        'allowed_updates': ['message', 'callback_query'],
                    },
                    timeout=poll_timeout + 5,
                )
                data = resp.json()

                if not data.get('ok'):
                    logger.error('getUpdates error: %s', data)
                    time.sleep(5)
                    continue

                for update in data.get('result', []):
                    try:
                        handle_update(update)
                    except Exception as exc:
                        import traceback as _tb
                        self.stderr.write(
                            f'[bot] ERROR processing update {update.get("update_id")}: {exc}\n'
                            + _tb.format_exc()
                        )
                    offset = update['update_id'] + 1

                _write_heartbeat(telegram_ok=True)

            except requests.exceptions.Timeout:
                _write_heartbeat(telegram_ok=False)
                continue
            except Exception as exc:
                import traceback as _tb
                self.stderr.write(f'[bot] Polling error: {exc}\n' + _tb.format_exc())
                _write_heartbeat(telegram_ok=False)
                time.sleep(5)

        self.stdout.write('Bot stopped.')
