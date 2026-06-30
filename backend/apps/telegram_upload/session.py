"""Redis-backed conversation state for upload bot sessions (30 min TTL)."""
from django.core.cache import cache

_TTL    = 60 * 30
_PREFIX = 'tg_upload_sess:'


def get(chat_id: int) -> dict | None:
    return cache.get(f'{_PREFIX}{chat_id}')


def save(chat_id: int, data: dict):
    cache.set(f'{_PREFIX}{chat_id}', data, _TTL)


def delete(chat_id: int):
    cache.delete(f'{_PREFIX}{chat_id}')
