"""
Telegram Bot API helper.

Credentials live in AppSettings (telegram_bot_token, telegram_bot_username).
All sends are fire-and-forget background threads, same pattern as email.py.
"""
import logging
import threading

import requests as _http

from .models import AppSettings

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org/bot{token}/{method}'

SETTING_KEYS = ['telegram_bot_token', 'telegram_bot_username', 'telegram_enabled']


def get_bot_token() -> str | None:
    row = AppSettings.objects.filter(key='telegram_bot_token').first()
    return (row.value or '').strip() or None if row else None


def get_bot_username() -> str | None:
    row = AppSettings.objects.filter(key='telegram_bot_username').first()
    return (row.value or '').strip() or None if row else None


def telegram_is_configured() -> bool:
    row = AppSettings.objects.filter(key='telegram_enabled').first()
    if row and row.value == 'false':
        return False
    return bool(get_bot_token())


def get_app_name() -> str:
    row = AppSettings.objects.filter(key='app_name').first()
    return (row.value if row and row.value else 'SBRW Books')


def _call(method: str, token: str, **payload) -> dict:
    url = TELEGRAM_API.format(token=token, method=method)
    resp = _http.post(url, json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if not data.get('ok'):
        raise RuntimeError(
            f'Telegram {method} error {data.get("error_code")}: {data.get("description")}'
        )
    return data


_OUTBOX_KEY = 'tg:outbox'


def _enqueue(chat_id: int, text: str) -> None:
    """Push a message into the Redis outbox queue for the bots container to deliver."""
    import json
    from django_redis import get_redis_connection
    payload = json.dumps({'chat_id': chat_id, 'text': text})
    get_redis_connection('default').rpush(_OUTBOX_KEY, payload)


def send_message(chat_id: int, text: str) -> None:
    """Enqueue message for delivery via the bots container (which has VPN/Telegram access)."""
    try:
        _enqueue(chat_id, text)
    except Exception as exc:
        logger.error('Failed to enqueue Telegram message to %s: %s', chat_id, exc)


def send_message_sync(chat_id: int, text: str) -> dict:
    """Synchronous enqueue — for the test button. Raises on failure."""
    _enqueue(chat_id, text)
    return {'ok': True, 'queued': True}


def set_webhook(webhook_url: str) -> dict:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    return _call('setWebhook', token, url=webhook_url)


def delete_webhook() -> dict:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    return _call('deleteWebhook', token)


def get_webhook_info() -> dict:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    return _call('getWebhookInfo', token)


def get_my_commands() -> list:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    result = _call('getMyCommands', token)
    return result.get('result', [])


def set_my_commands(commands: list) -> dict:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    return _call('setMyCommands', token, commands=commands)


def get_my_description() -> str:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    result = _call('getMyDescription', token)
    return result.get('result', {}).get('description', '')


def set_my_description(description: str) -> dict:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    return _call('setMyDescription', token, description=description)


def get_my_short_description() -> str:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    result = _call('getMyShortDescription', token)
    return result.get('result', {}).get('short_description', '')


def set_my_short_description(short_description: str) -> dict:
    token = get_bot_token()
    if not token:
        raise ValueError('Telegram bot token not configured')
    return _call('setMyShortDescription', token, short_description=short_description)



def notify_account_linked(chat_id: int, username: str) -> None:
    app = get_app_name()
    send_message(chat_id, (
        f'✅ Аккаунт <b>{username}</b> успешно привязан к <b>{app}</b>!\n\n'
        f'Теперь вы будете получать уведомления здесь.'
    ))


def send_2fa_code(chat_id: int, code: str) -> None:
    app = get_app_name()
    send_message(chat_id, (
        f'🔐 <b>{app}</b>\n\n'
        f'Код подтверждения входа:\n\n<code>{code}</code>\n\n'
        f'Код действителен 5 минут. Никому его не передавайте.'
    ))


def notify_new_login(
    chat_id: int,
    created_at,
    os_str: str,
    browser_str: str,
    country: str,
    city: str,
    ip: str,
    sessions_url: str,
) -> None:
    from datetime import timezone as _tz
    dt = created_at.astimezone(_tz.utc)
    dt_str = dt.strftime('%d.%m.%Y %H:%M:%S UTC')

    device = ', '.join(filter(None, [os_str, browser_str])) or 'Неизвестное устройство'

    location_parts = ', '.join(filter(None, [country, city]))
    if location_parts and ip:
        location = f'{location_parts} (IP = {ip})'
    elif ip:
        location = ip
    else:
        location = 'Неизвестно'

    manage_link = (
        f'<a href="{sessions_url}">панель управления</a>'
        if sessions_url else 'настройки профиля'
    )

    send_message(chat_id, (
        f'Новый вход в аккаунт 🔑\n\n'
        f'Дата и время: {dt_str}\n'
        f'Устройство: {device}\n'
        f'Местоположение: {location}\n\n'
        f'C этого устройства можно будет управлять аккаунтом без ограничений\n\n'
        f'Если это были не вы, пожалуйста, перейдите в {manage_link} и завершите эту сессию'
    ))


def notify_new_book_in_series(chat_id: int, series_name: str, book_title: str, book_url: str) -> None:
    app = get_app_name()
    send_message(chat_id, (
        f'📚 <b>{app}</b>\n\n'
        f'В серии «{series_name}» появилась новая книга:\n\n'
        f'<b>{book_title}</b>\n\n'
        f'<a href="{book_url}">Открыть книгу →</a>'
    ))
