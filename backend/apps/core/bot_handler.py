"""
Handler for the core notification/2FA bot (telegram_bot_token / sbrw_book_bot).

User flow
---------
Unlinked:
  /start → greeting + [🔗 Привязать аккаунт] inline button
  Click "Привязать" → Redis state linking_pending + instructions
  User sends code from profile page → validate → link → linked menu

Linked:
  /start → greeting with current settings + inline menu
  Buttons: toggle newsletter, toggle 2FA, unlink

The bot uses InlineKeyboard exclusively so no extra text is sent to the chat
when the user presses a button.  The user's /start command is deleted so the
conversation stays clean.
"""
import logging
import requests as _http
from django.core.cache import cache

logger = logging.getLogger(__name__)

_API = 'https://api.telegram.org/bot{token}/{method}'

                                                  
_LINK_TTL = 600



def _call(method: str, token: str, **payload) -> dict:
    try:
        r = _http.post(_API.format(token=token, method=method), json=payload, timeout=10)
        return r.json()
    except Exception as exc:
        logger.warning('Core bot %s failed: %s', method, exc)
        return {}


def _send(token: str, chat_id: int, text: str, reply_markup=None, **kw) -> dict:
    p = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}
    if reply_markup:
        p['reply_markup'] = reply_markup
    p.update(kw)
    return _call('sendMessage', token, **p)


def _edit(token: str, chat_id: int, message_id: int, text: str, reply_markup=None) -> dict:
    p = {'chat_id': chat_id, 'message_id': message_id, 'text': text, 'parse_mode': 'HTML'}
    if reply_markup:
        p['reply_markup'] = reply_markup
    return _call('editMessageText', token, **p)


def _delete(token: str, chat_id: int, message_id: int):
    _call('deleteMessage', token, chat_id=chat_id, message_id=message_id)


def _answer_cb(token: str, cq_id: str, text: str = '', alert: bool = False):
    _call('answerCallbackQuery', token,
          callback_query_id=cq_id, text=text, show_alert=alert)



def _get_linked_chat(chat_id: int):
    from apps.core.models import TelegramChat
    from apps.core.encryption import hash_value
    try:
        return TelegramChat.objects.select_related('user').get(
            chat_id_hash=hash_value(str(chat_id))
        )
    except TelegramChat.DoesNotExist:
        return None



def _kbd_unlinked() -> dict:
    return {
        'inline_keyboard': [
            [{'text': '🔗 Привязать аккаунт', 'callback_data': 'link_account'}],
        ]
    }


def _kbd_linked(user) -> dict:
    nl = getattr(user, 'telegram_newsletter_enabled', True)
    tfa = getattr(user, 'telegram_2fa_enabled', False)
    return {
        'inline_keyboard': [
            [{'text': '📨 Отписаться от рассылок' if nl else '📨 Подписаться на рассылки',
              'callback_data': 'toggle_newsletter'}],
            [{'text': '🔐 Отключить 2FA' if tfa else '🔐 Включить 2FA',
              'callback_data': 'toggle_2fa'}],
            [{'text': '🔓 Отвязать аккаунт', 'callback_data': 'unlink_confirm'}],
        ]
    }


def _kbd_unlink_confirm() -> dict:
    return {
        'inline_keyboard': [
            [
                {'text': '✅ Да, отвязать', 'callback_data': 'unlink_do'},
                {'text': '❌ Отмена', 'callback_data': 'unlink_cancel'},
            ]
        ]
    }



def _app_name() -> str:
    from apps.core.telegram import get_app_name
    return get_app_name()


def _handle_start(token: str, chat_id: int, msg_id: int):
    _delete(token, chat_id, msg_id)
    app = _app_name()
    tc = _get_linked_chat(chat_id)
    if tc:
        user = tc.user
        nl = '✅ включены' if getattr(user, 'telegram_newsletter_enabled', True) else '❌ выключены'
        tfa = '✅ включена' if getattr(user, 'telegram_2fa_enabled', False) else '❌ выключена'
        _send(token, chat_id,
              f'👋 Привет, <b>{user.username}</b>!\n\n'
              f'Ваш аккаунт <b>{app}</b> привязан.\n\n'
              f'📨 Рассылки: {nl}\n'
              f'🔐 2FA: {tfa}',
              reply_markup=_kbd_linked(user))
    else:
        _send(token, chat_id,
              f'👋 Привет! Я бот <b>{app}</b>.\n\n'
              f'Нажмите кнопку ниже, чтобы привязать ваш аккаунт и получать уведомления.',
              reply_markup=_kbd_unlinked())


def _handle_link_start(token: str, chat_id: int, cq_id: str, msg_id: int):
    _answer_cb(token, cq_id)
    app = _app_name()
    cache.set(f'tg:linking:core:{chat_id}', True, timeout=_LINK_TTL)
    _edit(token, chat_id, msg_id,
          f'🔗 <b>Привязка аккаунта</b>\n\n'
          f'1. Откройте сайт <b>{app}</b>\n'
          f'2. Перейдите в <b>Профиль → Telegram</b>\n'
          f'3. Нажмите «Получить код привязки»\n'
          f'4. Скопируйте код и отправьте его мне\n\n'
          f'⏳ Код действителен 10 минут.')


def _do_link(token: str, chat_id: int, tg_username: str, code: str, user_id: str):
    from apps.core.models import TelegramChat
    from apps.core.encryption import hash_value
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        _send(token, chat_id, '❌ Пользователь не найден. Попробуйте снова.')
        return

    TelegramChat.objects.filter(
        chat_id_hash=hash_value(str(chat_id))
    ).exclude(user=user).delete()
    TelegramChat.objects.update_or_create(
        user=user,
        defaults={'chat_id': chat_id, 'username': tg_username},
    )
    cache.delete(f'telegram_link:{code}')
    cache.delete(f'tg:linking:core:{chat_id}')

    app = _app_name()
    _send(token, chat_id,
          f'✅ <b>Аккаунт привязан!</b>\n\n'
          f'<b>{user.username}</b> — {app}\n\n'
          f'Теперь вы будете получать уведомления здесь.',
          reply_markup=_kbd_linked(user))


def _handle_unlink_confirm(token: str, chat_id: int, cq_id: str, msg_id: int):
    _answer_cb(token, cq_id)
    tc = _get_linked_chat(chat_id)
    if not tc:
        _edit(token, chat_id, msg_id,
              '❌ Аккаунт не привязан.', reply_markup=_kbd_unlinked())
        return
    _edit(token, chat_id, msg_id,
          f'Вы уверены, что хотите отвязать аккаунт <b>{tc.user.username}</b>?',
          reply_markup=_kbd_unlink_confirm())


def _handle_unlink_do(token: str, chat_id: int, cq_id: str, msg_id: int):
    tc = _get_linked_chat(chat_id)
    if not tc:
        _answer_cb(token, cq_id, 'Аккаунт уже не привязан', alert=True)
        return
    username = tc.user.username
    tc.delete()
    _answer_cb(token, cq_id)
    _edit(token, chat_id, msg_id,
          f'🔓 Аккаунт <b>{username}</b> отвязан.\n\n'
          f'Уведомления больше не будут приходить.',
          reply_markup=_kbd_unlinked())


def _handle_unlink_cancel(token: str, chat_id: int, cq_id: str, msg_id: int):
    _answer_cb(token, cq_id)
    tc = _get_linked_chat(chat_id)
    if tc:
        _edit(token, chat_id, msg_id,
              f'Управление аккаунтом <b>{tc.user.username}</b>:',
              reply_markup=_kbd_linked(tc.user))
    else:
        _edit(token, chat_id, msg_id,
              'Нажмите кнопку для настройки:', reply_markup=_kbd_unlinked())


def _handle_toggle_newsletter(token: str, chat_id: int, cq_id: str, msg_id: int):
    tc = _get_linked_chat(chat_id)
    if not tc:
        _answer_cb(token, cq_id, '❌ Аккаунт не привязан', alert=True)
        return
    user = tc.user
    new_val = not getattr(user, 'telegram_newsletter_enabled', True)
    user.telegram_newsletter_enabled = new_val
    user.save(update_fields=['telegram_newsletter_enabled'])
    status = 'включены ✅' if new_val else 'отключены ❌'
    _answer_cb(token, cq_id, f'Рассылки {status}')
    nl = '✅ включены' if new_val else '❌ выключены'
    tfa = '✅ включена' if getattr(user, 'telegram_2fa_enabled', False) else '❌ выключена'
    _edit(token, chat_id, msg_id,
          f'Настройки аккаунта <b>{user.username}</b>:\n\n'
          f'📨 Рассылки: {nl}\n'
          f'🔐 2FA: {tfa}',
          reply_markup=_kbd_linked(user))


def _handle_toggle_2fa(token: str, chat_id: int, cq_id: str, msg_id: int):
    tc = _get_linked_chat(chat_id)
    if not tc:
        _answer_cb(token, cq_id, '❌ Аккаунт не привязан', alert=True)
        return
    user = tc.user
    new_val = not getattr(user, 'telegram_2fa_enabled', False)
    user.telegram_2fa_enabled = new_val
    user.save(update_fields=['telegram_2fa_enabled'])
    status = 'включена ✅' if new_val else 'отключена ❌'
    _answer_cb(token, cq_id, f'2FA {status}')
    nl = '✅ включены' if getattr(user, 'telegram_newsletter_enabled', True) else '❌ выключены'
    tfa = '✅ включена' if new_val else '❌ выключена'
    _edit(token, chat_id, msg_id,
          f'Настройки аккаунта <b>{user.username}</b>:\n\n'
          f'📨 Рассылки: {nl}\n'
          f'🔐 2FA: {tfa}',
          reply_markup=_kbd_linked(user))



def handle_update(update: dict, token: str):
    cq = update.get('callback_query')
    if cq:
        cq_id = cq['id']
        msg   = cq.get('message') or {}
        from_d = cq.get('from', {})
        chat_id = msg.get('chat', {}).get('id') or from_d.get('id')
        msg_id  = msg.get('message_id')
        data    = cq.get('data', '')

        dispatch = {
            'link_account':    _handle_link_start,
            'unlink_confirm':  _handle_unlink_confirm,
            'unlink_do':       _handle_unlink_do,
            'unlink_cancel':   _handle_unlink_cancel,
            'toggle_newsletter': _handle_toggle_newsletter,
            'toggle_2fa':      _handle_toggle_2fa,
        }
        fn = dispatch.get(data)
        if fn:
            fn(token, chat_id, cq_id, msg_id)
        else:
            _answer_cb(token, cq_id)
        return

    msg = update.get('message') or {}
    if not msg:
        return

    from_d  = msg.get('from', {})
    chat_id = (msg.get('chat') or {}).get('id') or from_d.get('id')
    msg_id  = msg.get('message_id')
    if not chat_id:
        return

    text = (msg.get('text') or '').strip()

    if text.startswith('/start'):
        _handle_start(token, chat_id, msg_id)
        return

                                                                             
    if cache.get(f'tg:linking:core:{chat_id}'):
        user_id = cache.get(f'telegram_link:{text}')
        if user_id:
            _delete(token, chat_id, msg_id)
            _do_link(token, chat_id, from_d.get('username', ''), text, user_id)
        else:
            _send(token, chat_id,
                  '❌ Код не найден или истёк.\n\n'
                  'Получите новый код в настройках профиля на сайте.',
                  reply_markup=_kbd_unlinked())
        return

                               
    tc = _get_linked_chat(chat_id)
    if tc:
        _send(token, chat_id,
              f'Управление аккаунтом — нажмите /start',
              reply_markup=_kbd_linked(tc.user))
    else:
        _send(token, chat_id,
              'Нажмите /start для настройки.',
              reply_markup=_kbd_unlinked())
