#!/bin/bash
set -e

echo "Applying database migrations..."
python manage.py migrate --no-input

# If a custom command was passed (e.g. from docker-compose command:), run it instead of gunicorn
if [ "$#" -gt 0 ]; then
    echo "Running: $*"
    exec "$@"
fi

echo "Starting daphne (ASGI + WebSocket)..."
exec daphne -b 0.0.0.0 -p 8000 \
    --proxy-headers \
    config.asgi:application
