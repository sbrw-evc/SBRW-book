"""
Telegram Bot API wrapper for the upload bot.

Token stored in AppSettings as 'telegram_upload_bot_token'.
Unlike core/telegram.py this bot uses inline keyboards and file downloads,
so it has its own wrapper rather than sharing the 2FA bot.
"""
import logging

import requests as _http

logger = logging.getLogger(__name__)

_API  = 'https://api.telegram.org/bot{token}/{method}'
_FILE = 'https://api.telegram.org/file/bot{token}/{path}'



def get_token() -> str | None:
    from apps.core.models import AppSettings
    for key in ('telegram_upload_bot_token', 'telegram_bot_token'):
        row = AppSettings.objects.filter(key=key).first()
        val = (row.value or '').strip() if row else ''
        if val:
            return val
    return None


def get_bot_username() -> str | None:
    from apps.core.models import AppSettings
    for key in ('telegram_upload_bot_username', 'telegram_bot_username'):
        row = AppSettings.objects.filter(key=key).first()
        val = (row.value or '').strip() if row else ''
        if val:
            return val
    return None


def is_configured() -> bool:
    return bool(get_token())



def _call(method: str, token: str, timeout: int = 15, **payload) -> dict:
    url = _API.format(token=token, method=method)
    resp = _http.post(url, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()



def send_message(token: str, chat_id: int, text: str, reply_markup=None, **kw) -> dict:
    payload = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}
    if reply_markup:
        payload['reply_markup'] = reply_markup
    payload.update(kw)
    return _call('sendMessage', token, **payload)


def edit_message(token: str, chat_id: int, message_id: int, text: str, reply_markup=None, **kw) -> dict:
    payload = {
        'chat_id':    chat_id,
        'message_id': message_id,
        'text':       text,
        'parse_mode': 'HTML',
    }
    if reply_markup:
        payload['reply_markup'] = reply_markup
    payload.update(kw)
    return _call('editMessageText', token, **payload)


def answer_callback(token: str, callback_query_id: str, text: str = '',
                    alert: bool = False) -> dict:
    return _call('answerCallbackQuery', token,
                 callback_query_id=callback_query_id, text=text, show_alert=alert)


def get_file_info(token: str, file_id: str) -> dict:
    return _call('getFile', token, file_id=file_id)


def download_file(token: str, tg_file_path: str) -> bytes:
    url  = _FILE.format(token=token, path=tg_file_path)
    resp = _http.get(url, timeout=180, stream=True)
    resp.raise_for_status()
    return resp.content


def set_webhook(token: str, url: str) -> dict:
    return _call('setWebhook', token, url=url)


def delete_webhook(token: str) -> dict:
    return _call('deleteWebhook', token)


def get_webhook_info(token: str) -> dict:
    return _call('getWebhookInfo', token)


def get_my_commands(token: str) -> list:
    result = _call('getMyCommands', token)
    return result.get('result', [])


def set_my_commands(token: str, commands: list) -> dict:
    return _call('setMyCommands', token, commands=commands)


def get_my_description(token: str) -> str:
    result = _call('getMyDescription', token)
    return result.get('result', {}).get('description', '')


def set_my_description(token: str, description: str) -> dict:
    return _call('setMyDescription', token, description=description)


def get_my_short_description(token: str) -> str:
    result = _call('getMyShortDescription', token)
    return result.get('result', {}).get('short_description', '')


def set_my_short_description(token: str, short_description: str) -> dict:
    return _call('setMyShortDescription', token, short_description=short_description)
