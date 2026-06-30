"""Test all VPN configs, measure latency to api.telegram.org, activate the best one."""
import socket
import subprocess
import time

from django.core.management.base import BaseCommand
from django.utils import timezone


TARGET_HOST = 'api.telegram.org'
TARGET_PORT = 443
ATTEMPTS    = 3
TIMEOUT_S   = 5


def _measure_latency() -> float | None:
    """Return average TCP connect latency (ms) to Telegram API, or None on failure."""
    latencies = []
    for _ in range(ATTEMPTS):
        try:
            t0 = time.monotonic()
            s  = socket.create_connection((TARGET_HOST, TARGET_PORT), timeout=TIMEOUT_S)
            s.close()
            latencies.append((time.monotonic() - t0) * 1000)
        except Exception:
            pass
    return sum(latencies) / len(latencies) if latencies else None


class Command(BaseCommand):
    help = 'Test all VPN configs, measure latency to Telegram, activate the best one'

    def handle(self, *args, **options):
        from apps.core.models import VpnConfig
        from apps.telegram_upload.management.commands.apply_wireguard import _apply_config

        configs = list(VpnConfig.objects.all())
        if not configs:
            self.stdout.write('No VPN configs found, skipping test.')
            return

        results = []                                

        for cfg in configs:
            self.stdout.write(f'Testing config "{cfg.name}"...')
            ok = _apply_config(cfg.config_text or '', self.stdout, self.stderr)
            if not ok:
                self.stdout.write(f'  → Config "{cfg.name}" failed to apply, skipping.')
                results.append((None, cfg))
                continue

                                            
            time.sleep(2)
            latency = _measure_latency()

                                           
            subprocess.run(['awg-quick', 'down', '/tmp/awg0.conf'], capture_output=True)

            if latency is not None:
                self.stdout.write(f'  → Latency: {latency:.1f} ms')
            else:
                self.stdout.write(f'  → Unreachable')

            now = timezone.now()
            cfg.last_latency_ms = latency
            cfg.last_checked    = now
            cfg.save(update_fields=['last_latency_ms', 'last_checked'])
            results.append((latency, cfg))

                                                            
        reachable = [(lat, cfg) for lat, cfg in results if lat is not None]
        if not reachable:
            self.stderr.write('All configs unreachable — no VPN applied.')
            return

        best_latency, best_cfg = min(reachable, key=lambda x: x[0])
        self.stdout.write(f'Best config: "{best_cfg.name}" ({best_latency:.1f} ms)')

                                    
        VpnConfig.objects.update(is_active=False)
        best_cfg.is_active = True
        best_cfg.save(update_fields=['is_active'])

        _apply_config(best_cfg.config_text or '', self.stdout, self.stderr)

                                     
        try:
            from django.core.cache import cache
            cache.delete('sbrw:vpn:run_test_configs')
        except Exception:
            pass
