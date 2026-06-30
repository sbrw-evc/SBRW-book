#!/bin/bash
set -e

# Create /dev/net/tun if not present (requires 'tun' kernel module loaded on host)
if [ ! -c /dev/net/tun ]; then
    mkdir -p /dev/net
    mknod /dev/net/tun c 10 200
    chmod 0666 /dev/net/tun
fi

echo "Applying database migrations..."
python manage.py migrate --no-input

echo "Applying WireGuard config (if configured)..."
# If admin requested a full latency test + auto-select, run test_vpn_configs instead
RUN_TEST=$(python -c "
from django.core.cache import cache
v = cache.get('sbrw:vpn:run_test_configs')
print('1' if v else '0')
" 2>/dev/null || echo "0")

if [ "$RUN_TEST" = "1" ]; then
    echo "Running VPN config latency test (admin requested auto-select)..."
    python manage.py test_vpn_configs || echo "VPN test failed, continuing without VPN."
else
    python manage.py apply_wireguard || echo "WireGuard not configured, continuing without VPN."
fi

echo "Starting core Telegram bot (long polling)..."
python manage.py run_core_bot &
CORE_PID=$!

echo "Starting Telegram upload bot (long polling)..."
python manage.py run_upload_bot &
UPLOAD_PID=$!

# Forward SIGTERM/SIGINT to both children
_shutdown() {
    echo "Shutting down bots..."
    kill "$CORE_PID" "$UPLOAD_PID" 2>/dev/null
    wait "$CORE_PID" "$UPLOAD_PID" 2>/dev/null
    exit 0
}
trap _shutdown SIGTERM SIGINT

# Exit if either bot dies unexpectedly
wait -n 2>/dev/null || {
    # wait -n not supported (older bash) — just wait for both
    wait "$CORE_PID" "$UPLOAD_PID"
    exit 0
}

echo "A bot process exited unexpectedly — stopping container."
kill "$CORE_PID" "$UPLOAD_PID" 2>/dev/null
exit 1
