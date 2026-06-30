"""
Handler for the admin upload bot (telegram_upload_bot_token / sbrw_book_upload_bot).

User flow
---------
Unlinked / non-admin:
  /start → warning (admin only) + [🔑 Авторизоваться] button
  Click "Авторизоваться" → Redis linking_pending + instructions
  User sends code from admin panel → validate + check admin role → link or reject

Linked admin:
  /start → greeting + [🔓 Отвязать аккаунт] button; bot awaits book files

Book upload (linked admin only):
  document → download → metadata preview + inline edit/confirm/skip/cancel keyboard
"""
import logging
import os
import shutil
import tarfile
import tempfile
import traceback
import zipfile

from . import bot, session as sess

logger = logging.getLogger(__name__)

BOOK_EXTS    = {'.epub', '.pdf', '.fb2', '.mobi', '.djvu', '.doc', '.docx', '.txt', '.rtf'}
ARCHIVE_EXTS = {'.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2'}

FIELD_LABELS = {
    'title':         'Название',
    'author':        'Автор',
    'series':        'Серия',
    'series_number': '№ в серии',
    'year':          'Год',
    'language':      'Язык',
    'description':   'Описание',
}
EDITABLE_FIELDS = list(FIELD_LABELS)

                                     
_LINK_TTL = 600



def _get_linked_admin(chat_id: int):
    """Return TelegramChat for this chat_id only if the linked user is admin."""
    from apps.core.models import TelegramChat
    from apps.core.encryption import hash_value
    try:
        tc = TelegramChat.objects.select_related('user').get(
            chat_id_hash=hash_value(str(chat_id))
        )
        return tc if tc.user.role == 'admin' else None
    except TelegramChat.DoesNotExist:
        return None


def _get_linked_chat(chat_id: int):
    """Return any TelegramChat for this chat_id (role-agnostic lookup)."""
    from apps.core.models import TelegramChat
    from apps.core.encryption import hash_value
    try:
        return TelegramChat.objects.select_related('user').get(
            chat_id_hash=hash_value(str(chat_id))
        )
    except TelegramChat.DoesNotExist:
        return None



def _kbd_unauthorized() -> dict:
    return {
        'inline_keyboard': [
            [{'text': '🔑 Авторизоваться', 'callback_data': 'authorize'}],
        ]
    }


def _kbd_linked_admin() -> dict:
    return {
        'inline_keyboard': [
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



def _delete(token: str, chat_id: int, msg_id: int):
    try:
        import requests as _http
        _http.post(
            f'https://api.telegram.org/bot{token}/deleteMessage',
            json={'chat_id': chat_id, 'message_id': msg_id}, timeout=5,
        )
    except Exception:
        pass



def _handle_start(token: str, chat_id: int, msg_id: int):
    _delete(token, chat_id, msg_id)
    tc = _get_linked_admin(chat_id)
    if tc:
        bot.send_message(token, chat_id,
            f'👋 Привет, <b>{tc.user.username}</b>!\n\n'
            f'📚 Я готов принимать файлы книг для загрузки.\n'
            f'Просто отправьте мне файл или архив.',
            reply_markup=_kbd_linked_admin())
    else:
        bot.send_message(token, chat_id,
            '⚠️ <b>Бот для загрузки книг</b>\n\n'
            'Этот бот доступен только пользователям с правами администратора.\n\n'
            'Если у вас есть административный доступ — нажмите кнопку ниже '
            'для авторизации.',
            reply_markup=_kbd_unauthorized())



def _handle_authorize(token: str, chat_id: int, cq_id: str, msg_id: int):
    from django.core.cache import cache
    bot.answer_callback(token, cq_id)
    cache.set(f'tg:linking:upload:{chat_id}', True, timeout=_LINK_TTL)
    bot.edit_message(token, chat_id, msg_id,
        '🔑 <b>Авторизация</b>\n\n'
        '1. Войдите в <b>административный интерфейс</b> сайта\n'
        '2. Перейдите в раздел <b>Профиль → Telegram</b>\n'
        '3. Нажмите «Получить код привязки»\n'
        '4. Скопируйте код и отправьте его мне\n\n'
        '⏳ Код действителен 10 минут.')


def _do_link_admin(token: str, chat_id: int, tg_username: str, code: str, user_id: str):
    from django.core.cache import cache
    from apps.core.models import TelegramChat
    from apps.core.encryption import hash_value
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        bot.send_message(token, chat_id, '❌ Пользователь не найден. Попробуйте снова.')
        return

    if user.role != 'admin':
        cache.delete(f'telegram_link:{code}')
        cache.delete(f'tg:linking:upload:{chat_id}')
        bot.send_message(token, chat_id,
            '⛔ <b>Доступ запрещён</b>\n\n'
            'Этот бот доступен только администраторам.\n'
            f'Аккаунт <b>{user.username}</b> не имеет нужных прав.',
            reply_markup=_kbd_unauthorized())
        return

    TelegramChat.objects.filter(
        chat_id_hash=hash_value(str(chat_id))
    ).exclude(user=user).delete()
    TelegramChat.objects.update_or_create(
        user=user,
        defaults={'chat_id': chat_id, 'username': tg_username},
    )
    cache.delete(f'telegram_link:{code}')
    cache.delete(f'tg:linking:upload:{chat_id}')

    bot.send_message(token, chat_id,
        f'✅ <b>Авторизация прошла успешно!</b>\n\n'
        f'Администратор <b>{user.username}</b> авторизован.\n\n'
        f'📚 Отправляйте файлы книг для загрузки.\n'
        f'Поддерживаемые форматы: EPUB, PDF, FB2, MOBI, DJVU, DOC, DOCX, TXT, RTF\n'
        f'Архивы: ZIP, TAR.GZ, TGZ, TAR.BZ2',
        reply_markup=_kbd_linked_admin())



def _handle_unlink_confirm(token: str, chat_id: int, cq_id: str, msg_id: int):
    bot.answer_callback(token, cq_id)
    tc = _get_linked_chat(chat_id)
    if not tc:
        bot.edit_message(token, chat_id, msg_id,
            '❌ Аккаунт не привязан.', reply_markup=_kbd_unauthorized())
        return
    bot.edit_message(token, chat_id, msg_id,
        f'Отвязать аккаунт <b>{tc.user.username}</b>?',
        reply_markup=_kbd_unlink_confirm())


def _handle_unlink_do(token: str, chat_id: int, cq_id: str, msg_id: int):
    tc = _get_linked_chat(chat_id)
    if not tc:
        bot.answer_callback(token, cq_id, 'Аккаунт уже не привязан', alert=True)
        return
    username = tc.user.username
    tc.delete()
    bot.answer_callback(token, cq_id)
    bot.edit_message(token, chat_id, msg_id,
        f'🔓 Аккаунт <b>{username}</b> отвязан.\n\n'
        f'Для повторной авторизации нажмите кнопку.',
        reply_markup=_kbd_unauthorized())


def _handle_unlink_cancel(token: str, chat_id: int, cq_id: str, msg_id: int):
    bot.answer_callback(token, cq_id)
    tc = _get_linked_admin(chat_id)
    if tc:
        bot.edit_message(token, chat_id, msg_id,
            f'📚 Готов принимать книги, <b>{tc.user.username}</b>.',
            reply_markup=_kbd_linked_admin())
    else:
        bot.edit_message(token, chat_id, msg_id,
            'Нажмите кнопку для авторизации.',
            reply_markup=_kbd_unauthorized())



def _tmp_dir(chat_id: int) -> str:
    path = os.path.join(tempfile.gettempdir(), 'tg_upload', str(chat_id))
    os.makedirs(path, exist_ok=True)
    return path


def _cleanup(chat_id: int):
    path = os.path.join(tempfile.gettempdir(), 'tg_upload', str(chat_id))
    shutil.rmtree(path, ignore_errors=True)
    sess.delete(chat_id)



def _parse_meta(file_path: str) -> dict:
    from apps.books.services import extract_metadata, get_file_format
    ext = os.path.splitext(file_path.lower())[1].lstrip('.')
    fmt = get_file_format(os.path.basename(file_path)) or ext
    with open(file_path, 'rb') as fh:
        raw = extract_metadata(fh.read(), fmt)

    authors = raw.get('authors') or []
    return {
        'title':         raw.get('title', '') or '',
        'author':        ', '.join(authors) if authors else '',
        'series':        raw.get('series', '') or '',
        'series_number': str(raw.get('series_index') or '') or '',
        'year':          str(raw.get('published_year') or '') or '',
        'language':      raw.get('language', '') or '',
        'description':   raw.get('description', '') or '',
        'isbn':          raw.get('isbn', '') or '',
    }


def _fallback_title(file_path: str, meta: dict):
    if meta['title']:
        return
    base = os.path.splitext(os.path.basename(file_path))[0]
    if ' - ' in base:
        parts = base.split(' - ', 1)
        if not meta['author']:
            meta['author'] = parts[0].strip()
        meta['title'] = parts[1].strip()
    else:
        meta['title'] = base.replace('_', ' ').strip()



def _is_archive(name: str) -> bool:
    n = name.lower()
    return any(n.endswith(e) for e in ARCHIVE_EXTS)


def _is_book(name: str) -> bool:
    return os.path.splitext(name.lower())[1] in BOOK_EXTS


def _extract_books(archive_path: str, dest: str) -> list[str]:
    try:
        name = archive_path.lower()
        if name.endswith('.zip'):
            with zipfile.ZipFile(archive_path) as z:
                z.extractall(dest)
        else:
            with tarfile.open(archive_path) as t:
                t.extractall(dest)
    except Exception as exc:
        logger.error('Archive extraction failed: %s', exc)
        return []
    found = []
    for dirpath, _, files in os.walk(dest):
        for fn in files:
            if _is_book(fn):
                found.append(os.path.join(dirpath, fn))
    return sorted(found)



def _preview_text(meta: dict, fmt: str, size: int, idx: int, total: int) -> str:
    hdr = '📚 <b>Предпросмотр</b>'
    if total > 1:
        hdr += f' ({idx + 1} / {total})'
    mb   = size / (1024 * 1024)
    desc = meta.get('description') or '—'
    if len(desc) > 250:
        desc = desc[:250] + '…'
    return (
        f'{hdr}\n'
        f'📄 <b>Формат:</b> {fmt.upper()} · {mb:.1f} МБ\n\n'
        f'📖 <b>Название:</b>   {meta.get("title") or "—"}\n'
        f'✍️ <b>Автор:</b>       {meta.get("author") or "—"}\n'
        f'📚 <b>Серия:</b>       {meta.get("series") or "—"}\n'
        f'🔢 <b>№ в серии:</b>  {meta.get("series_number") or "—"}\n'
        f'📅 <b>Год:</b>          {meta.get("year") or "—"}\n'
        f'🌍 <b>Язык:</b>         {meta.get("language") or "—"}\n'
        f'📝 <b>Описание:</b>   {desc}'
    )


def _book_keyboard(total: int) -> dict:
    pairs = list(FIELD_LABELS.items())
    rows  = []
    for i in range(0, len(pairs), 2):
        rows.append([
            {'text': f'✏️ {lbl}', 'callback_data': f'edit:{key}'}
            for key, lbl in pairs[i:i + 2]
        ])
    rows.append([{'text': '✅ Загрузить книгу', 'callback_data': 'confirm'}])
    bottom = []
    if total > 1:
        bottom.append({'text': '⏭ Пропустить', 'callback_data': 'skip'})
    bottom.append({'text': '❌ Отменить всё', 'callback_data': 'cancel'})
    rows.append(bottom)
    return {'inline_keyboard': rows}



def _show_preview(token: str, chat_id: int, sd: dict, edit_id: int | None = None):
    idx   = sd['current']
    book  = sd['books'][idx]
    total = len(sd['books'])
    text  = _preview_text(book['meta'], book['fmt'], book['size'], idx, total)
    kbd   = _book_keyboard(total)

    new_id = edit_id
    if edit_id:
        try:
            res    = bot.edit_message(token, chat_id, edit_id, text, reply_markup=kbd)
            new_id = (res.get('result') or {}).get('message_id') or edit_id
        except Exception:
            res    = bot.send_message(token, chat_id, text, reply_markup=kbd)
            new_id = (res.get('result') or {}).get('message_id')
    else:
        res    = bot.send_message(token, chat_id, text, reply_markup=kbd)
        new_id = (res.get('result') or {}).get('message_id')

    sd['msg_id'] = new_id
    sess.save(chat_id, sd)



def _next_or_done(token: str, chat_id: int, sd: dict):
    idx   = sd['current']
    total = len(sd['books'])
    if idx + 1 >= total:
        _cleanup(chat_id)
        bot.send_message(token, chat_id,
            '✅ Все файлы из очереди обработаны.',
            reply_markup=_kbd_linked_admin())
    else:
        sd['current'] = idx + 1
        sess.save(chat_id, sd)
        _show_preview(token, chat_id, sd)



def _create_book(chat_id: int, book_entry: dict):
    from apps.books.models import Book, BookFile, Author, Series, BookSeries
    from apps.books.services import (
        extract_metadata, get_file_format,
        save_book_file, save_cover,
    )
    from apps.core import cache as book_cache
    from apps.core.models import TelegramChat
    from apps.core.encryption import hash_value

    tc       = TelegramChat.objects.select_related('user').get(
        chat_id_hash=hash_value(str(chat_id))
    )
    uploader = tc.user
    meta     = book_entry['meta']
    fmt      = book_entry['fmt']
    path     = book_entry['path']

    with open(path, 'rb') as fh:
        file_data = fh.read()

    raw = extract_metadata(file_data, fmt)

    def _int(v):
        try:
            return int(v) if v else None
        except (TypeError, ValueError):
            return None

    title = meta.get('title') or 'Без названия'

    db_book = Book.objects.create(
        title=title,
        sort_title=title.lower(),
        description=(meta.get('description') or '').strip() or None,
        language=(meta.get('language') or 'ru').strip(),
        publisher=(raw.get('publisher') or '').strip() or None,
        isbn=(meta.get('isbn') or '').strip() or None,
        page_count=raw.get('page_count'),
        published_year=_int(meta.get('year')),
        uploaded_by=uploader,
    )

    file_path, file_size = save_book_file(file_data, str(db_book.id), fmt)
    BookFile.objects.create(
        book=db_book, format=fmt,
        file_path=file_path, file_size=file_size,
    )

    cover_data = raw.get('cover_data')
    if cover_data:
        if save_cover(cover_data, str(db_book.id)):
            db_book.cover_path = f'/uploads/covers/{db_book.id}.jpg'
            db_book.save(update_fields=['cover_path'])

    for name in [a.strip() for a in meta.get('author', '').split(',') if a.strip()]:
        author_obj, _ = Author.objects.get_or_create(
            name=name, defaults={'sort_name': name}
        )
        db_book.authors.add(author_obj)

    series_name = (meta.get('series') or '').strip()
    if series_name:
        s_obj, _ = Series.objects.get_or_create(name=series_name)
        series_index = None
        try:
            v = meta.get('series_number', '')
            if v:
                series_index = float(v)
        except (TypeError, ValueError):
            pass
        BookSeries.objects.create(
            book=db_book, series=s_obj, series_index=series_index
        )

    book_cache.invalidate_lists()
    book_cache.invalidate_tags()

    return db_book



def _handle_document(token: str, chat_id: int, document: dict):
    filename  = document.get('file_name', 'unknown')
    file_id   = document.get('file_id')
    file_size = document.get('file_size', 0)

    is_arch = _is_archive(filename)
    is_book = _is_book(filename)

    if not is_arch and not is_book:
        bot.send_message(token, chat_id,
            '⚠️ Неподдерживаемый формат.\n\n'
            '<b>Книги:</b> epub, pdf, fb2, mobi, djvu, doc, docx, txt, rtf\n'
            '<b>Архивы:</b> zip, tar.gz, tgz, tar.bz2')
        return

    status    = bot.send_message(token, chat_id, '⏳ Скачиваю файл…')
    status_id = (status.get('result') or {}).get('message_id')

    try:
        info    = bot.get_file_info(token, file_id)
        tg_path = (info.get('result') or {}).get('file_path')
        if not tg_path:
            raise ValueError('Telegram не вернул путь к файлу (файл > 20 МБ?)')
        data = bot.download_file(token, tg_path)
    except Exception as exc:
        bot.send_message(token, chat_id, f'❌ Ошибка загрузки файла: {exc}')
        return

    tmp       = _tmp_dir(chat_id)
    safe_name = os.path.basename(filename)
    saved     = os.path.join(tmp, safe_name)
    with open(saved, 'wb') as fh:
        fh.write(data)

    if is_arch:
        try:
            bot.edit_message(token, chat_id, status_id, '⏳ Распаковываю архив…')
        except Exception:
            pass
        paths = _extract_books(saved, tmp)
        if not paths:
            bot.send_message(token, chat_id,
                '⚠️ В архиве не найдено поддерживаемых файлов книг.')
            return
    else:
        paths = [saved]

    try:
        bot.edit_message(token, chat_id, status_id,
            f'⏳ Анализирую метаданные ({len(paths)} файл(ов))…')
    except Exception:
        pass

    books = []
    for p in paths:
        meta = _parse_meta(p)
        _fallback_title(p, meta)
        books.append({
            'path': p,
            'fmt':  os.path.splitext(p.lower())[1].lstrip('.') or 'unknown',
            'size': os.path.getsize(p),
            'meta': meta,
        })

    sd = {
        'state':         'waiting_confirm',
        'editing_field': None,
        'books':         books,
        'current':       0,
        'msg_id':        status_id,
    }
    sess.save(chat_id, sd)
    _show_preview(token, chat_id, sd, edit_id=status_id)



def _handle_book_callback(token: str, cq: dict):
    cq_id   = cq.get('id')
    from_d  = cq.get('from', {})
    msg     = cq.get('message') or {}
    chat_id = msg.get('chat', {}).get('id') or from_d.get('id')
    data    = cq.get('data', '')

    bot.answer_callback(token, cq_id)

    sd = sess.get(chat_id)
    if not sd:
        bot.send_message(token, chat_id,
            '⏳ Сессия истекла. Отправьте файл заново.',
            reply_markup=_kbd_linked_admin())
        return

    if data == 'cancel':
        _cleanup(chat_id)
        bot.send_message(token, chat_id, '❌ Загрузка отменена.',
            reply_markup=_kbd_linked_admin())
        return

    if data == 'skip':
        bot.send_message(token, chat_id, '⏭ Книга пропущена.')
        _next_or_done(token, chat_id, sd)
        return

    if data == 'confirm':
        _do_upload(token, chat_id, sd)
        return

    if data.startswith('edit:'):
        field = data[5:]
        if field not in EDITABLE_FIELDS:
            return
        sd['state']         = 'editing_field'
        sd['editing_field'] = field
        sess.save(chat_id, sd)
        label   = FIELD_LABELS[field]
        current = sd['books'][sd['current']]['meta'].get(field) or '—'
        bot.send_message(token, chat_id,
            f'✏️ <b>Редактирование: {label}</b>\n\n'
            f'Текущее значение: <code>{current}</code>\n\n'
            f'Введите новое значение или /cancel для отмены.')


def _handle_field_input(token: str, chat_id: int, text: str, sd: dict):
    field = sd.get('editing_field')
    if not field:
        return
    sd['books'][sd['current']]['meta'][field] = text.strip()
    sd['state']         = 'waiting_confirm'
    sd['editing_field'] = None
    sess.save(chat_id, sd)
    bot.send_message(token, chat_id, f'✅ <b>{FIELD_LABELS.get(field, field)}</b> обновлён.')
    _show_preview(token, chat_id, sd, edit_id=sd.get('msg_id'))


def _do_upload(token: str, chat_id: int, sd: dict):
    bot.send_message(token, chat_id, '⏳ Сохраняю книгу…')
    book_entry = sd['books'][sd['current']]
    try:
        db_book = _create_book(chat_id, book_entry)
    except Exception as exc:
        logger.error('Book creation error for chat %s:\n%s', chat_id, traceback.format_exc())
        bot.send_message(token, chat_id, f'❌ Ошибка при сохранении: {exc}')
        return

    title = book_entry['meta'].get('title') or db_book.title
    bot.send_message(token, chat_id,
        f'✅ <b>Книга сохранена!</b>\n\n'
        f'📖 {title}\n'
        f'🆔 <code>{db_book.id}</code>')
    _next_or_done(token, chat_id, sd)



def handle_update(update: dict):
    token = bot.get_token()
    if not token:
        return

    from django.core.cache import cache

    cq = update.get('callback_query')
    if cq:
        cq_id  = cq.get('id')
        from_d = cq.get('from', {})
        msg    = cq.get('message') or {}
        chat_id = msg.get('chat', {}).get('id') or from_d.get('id')
        msg_id  = msg.get('message_id')
        data    = cq.get('data', '')

                                      
        if data == 'authorize':
            _handle_authorize(token, chat_id, cq_id, msg_id)
            return
        if data == 'unlink_confirm':
            _handle_unlink_confirm(token, chat_id, cq_id, msg_id)
            return
        if data == 'unlink_do':
            _handle_unlink_do(token, chat_id, cq_id, msg_id)
            return
        if data == 'unlink_cancel':
            _handle_unlink_cancel(token, chat_id, cq_id, msg_id)
            return

                                            
        if _get_linked_admin(chat_id):
            _handle_book_callback(token, cq)
        else:
            bot.answer_callback(token, cq_id, '⛔ Доступ запрещён', alert=True)
        return

    msg = update.get('message') or {}
    if not msg:
        return

    from_d  = msg.get('from', {})
    chat_id = (msg.get('chat') or {}).get('id') or from_d.get('id')
    msg_id  = msg.get('message_id')
    if not chat_id:
        return

    text     = (msg.get('text') or '').strip()
    document = msg.get('document')

    if text.startswith('/start'):
        _handle_start(token, chat_id, msg_id)
        return

                                                                           
    if cache.get(f'tg:linking:upload:{chat_id}'):
        user_id = cache.get(f'telegram_link:{text}')
        if user_id:
            _delete(token, chat_id, msg_id)
            _do_link_admin(token, chat_id, from_d.get('username', ''), text, user_id)
        else:
            bot.send_message(token, chat_id,
                '❌ Код не найден или истёк.\n\n'
                'Получите новый код в административном интерфейсе.',
                reply_markup=_kbd_unauthorized())
        return

                                               
    tc = _get_linked_admin(chat_id)
    if not tc:
        bot.send_message(token, chat_id,
            '⛔ Доступ запрещён. Нажмите кнопку для авторизации.',
            reply_markup=_kbd_unauthorized())
        return

    if text in ('/cancel', '/отмена'):
        _cleanup(chat_id)
        bot.send_message(token, chat_id, '❌ Загрузка отменена.',
            reply_markup=_kbd_linked_admin())
        return

    sd = sess.get(chat_id)

    if sd and sd.get('state') == 'editing_field' and text:
        _handle_field_input(token, chat_id, text, sd)
        return

    if document:
        _handle_document(token, chat_id, document)
        return

    if sd and sd.get('state') == 'waiting_confirm':
        bot.send_message(token, chat_id,
            'Используйте кнопки под предпросмотром или /cancel для отмены.')
        return

    bot.send_message(token, chat_id,
        '📚 Отправьте файл книги или архив с книгами.',
        reply_markup=_kbd_linked_admin())
