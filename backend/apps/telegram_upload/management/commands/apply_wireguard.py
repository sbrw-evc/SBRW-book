"""Apply WireGuard VPN config stored in AppSettings."""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand


def _strip_empty_awg2_params(config: str) -> str:
    """Remove I1-I5 lines with empty values.

    AmneziaWG 2.0 exports may include lines like 'I2 = ' with no value,
    meaning 'no obfuscation for this packet type'.  awg setconf rejects
    these because its get_value() returns NULL when linelen == keylen.
    Dropping them is semantically equivalent: amneziawg-go treats a missing
    I-param the same as an empty one (no obfuscation chain applied).
    """
    return re.sub(r'^\s*I[1-5]\s*=\s*$', '', config, flags=re.MULTILINE)


def _adapt_dns_for_docker(config: str) -> str:
    """
    wg-quick sets DNS via `resolvconf`, which is absent in slim containers.
    Replace `DNS = ...` with PostUp/PreDown that write /etc/resolv.conf directly.
    """
    match = re.search(r'^\s*DNS\s*=\s*(.+)$', config, re.MULTILINE)
    if not match:
        return config

    servers = [s.strip() for s in match.group(1).split(',') if s.strip()]
    if not servers:
        return config

                                                                               
                                                                        
                                                                                           
    ns_lines = '\\n'.join(['nameserver 127.0.0.11'] + [f'nameserver {s}' for s in servers])
    post_up = (
        'PostUp = cp /etc/resolv.conf /tmp/wg-resolv.bak && '
        f'printf "{ns_lines}\\n" > /etc/resolv.conf'
    )
    pre_down = 'PreDown = cp /tmp/wg-resolv.bak /etc/resolv.conf 2>/dev/null || true'

                     
    config = re.sub(r'^\s*DNS\s*=.*\n?', '', config, flags=re.MULTILINE)

                                                         
    lines = config.splitlines(keepends=True)
    result = []
    injected = False
    for line in lines:
        result.append(line)
        if not injected and line.strip() == '[Interface]':
            result.append(post_up + '\n')
            result.append(pre_down + '\n')
            injected = True

    return ''.join(result)


def _write_vpn_status(success: bool, error: str = '') -> None:
    try:
        from django.core.cache import cache
        cache.set('sbrw:vpn_status', json.dumps({
            'applied_at': datetime.now(dt_timezone.utc).isoformat(),
            'success': success,
            'error': error,
        }), timeout=None)
    except Exception:
        pass


class Command(BaseCommand):
    help = 'Apply WireGuard VPN config from AppSettings (run at container startup)'

    def handle(self, *args, **options):
        from apps.core.models import AppSettings, VpnConfig

                                                        
        active_cfg = VpnConfig.objects.filter(is_active=True).first()
        if active_cfg:
            config_text = active_cfg.config_text or ''
        else:
                                                           
            enabled_row = AppSettings.objects.filter(key='wireguard_enabled').first()
            if not enabled_row or enabled_row.value != 'true':
                self.stdout.write('WireGuard not enabled, skipping.')
                return
            config_row = AppSettings.objects.filter(key='wireguard_config').first()
            config_text = (config_row.value or '').strip() if config_row else ''

        if not config_text:
            self.stdout.write('No active VPN config found, skipping.')
            return

        _apply_config(config_text, self.stdout, self.stderr)


def _apply_config(config_text: str, stdout=None, stderr=None) -> bool:
    """Apply the given config text. Returns True on success."""
    config_path = '/tmp/awg0.conf'
    adapted = _strip_empty_awg2_params(config_text)
    adapted = _adapt_dns_for_docker(adapted)
    with open(config_path, 'w') as f:
        f.write(adapted)
    os.chmod(config_path, 0o600)

    subprocess.run(['awg-quick', 'down', config_path], capture_output=True)

    result = subprocess.run(['awg-quick', 'up', config_path], capture_output=True, text=True)
    if result.returncode != 0:
        _write_vpn_status(False, result.stderr.strip())
        if stderr:
            stderr.write(f'AmneziaWG error: {result.stderr}')
        return False

    _write_vpn_status(True)
    if stdout:
        stdout.write('AmneziaWG VPN connected.')
    return True
