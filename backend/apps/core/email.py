"""
Email service.  SMTP credentials live in AppSettings (configured during
initial setup or in the admin panel), not in environment variables, so the
admin can change them at runtime.

All sends happen in background daemon threads — a broken SMTP server must
never block or fail an API request.
"""
import logging
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from .models import AppSettings

DEFAULT_TEMPLATES = {
    'verify': {
        'subject': '{{app_name}} — подтверждение регистрации',
        'body_html': (
            '<p>Здравствуйте, <b>{{user_name}}</b>!</p>'
            '<p>Вы зарегистрировались в {{app_name}}. '
            'Подтвердите свой email, нажав на кнопку ниже:</p>'
            '{{action_button}}'
            '<p style="color:#6b7280;font-size:13px;">Ссылка действительна 48 часов. '
            'Если вы не регистрировались — просто проигнорируйте это письмо.</p>'
        ),
    },
    'reset': {
        'subject': '{{app_name}} — сброс пароля',
        'body_html': (
            '<p>Здравствуйте, <b>{{user_name}}</b>!</p>'
            '<p>Мы получили запрос на сброс пароля для вашего аккаунта. '
            'Чтобы задать новый пароль, нажмите на кнопку:</p>'
            '{{action_button}}'
            '<p style="color:#6b7280;font-size:13px;">Ссылка действительна 2 часа. '
            'Если вы не запрашивали сброс — проигнорируйте это письмо, пароль не изменится.</p>'
        ),
    },
    'series': {
        'subject': '{{app_name}} — новая книга в серии «{{series_name}}»',
        'body_html': (
            '<p>Здравствуйте, <b>{{user_name}}</b>!</p>'
            '<p>В серии «<b>{{series_name}}</b>», на которую вы подписаны, появилась новая книга:</p>'
            '<p style="font-size:16px;margin:16px 0;"><b>{{book_title}}</b><br>'
            '<span style="color:#6b7280;">{{book_authors}}</span></p>'
            '{{action_button}}'
        ),
    },
    'newsletter': {
        'subject': '{{app_name}} — новости библиотеки',
        'body_html': (
            '<p>Привет, <b>{{user_name}}</b>!</p>'
            '<p>Новости от команды <b>{{app_name}}</b>.</p>'
        ),
    },
}


def _get_tpl(event: str) -> tuple:
    """Return (subject, body_html) — custom DB value if set, else built-in default."""
    keys = [f'email_tpl_{event}_subject', f'email_tpl_{event}_body']
    rows = {r.key: r.value for r in AppSettings.objects.filter(key__in=keys)}
    defaults = DEFAULT_TEMPLATES.get(event, {})
    subject = rows.get(f'email_tpl_{event}_subject') or defaults.get('subject', '')
    body_html = rows.get(f'email_tpl_{event}_body') or defaults.get('body_html', '')
    return subject, body_html


def _render(template: str, **ctx) -> str:
    for k, v in ctx.items():
        template = template.replace('{{' + k + '}}', str(v or ''))
    return template

logger = logging.getLogger(__name__)

SMTP_SETTING_KEYS = [
    'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user',
    'smtp_password', 'smtp_from', 'smtp_use_tls', 'smtp_use_ssl',
]

EMAIL_NOTIFY_KEYS = [
    'email_notify_verify',
    'email_notify_reset',
    'email_notify_series',
    'email_notify_newsletter',
]


def _notify_enabled(key: str) -> bool:
    row = AppSettings.objects.filter(key=key).first()
    return row is None or (row.value or 'true') == 'true'


def get_smtp_config() -> dict:
    rows = {s.key: (s.value or '') for s in AppSettings.objects.filter(key__in=SMTP_SETTING_KEYS)}
    return {
        'enabled': rows.get('smtp_enabled') == 'true',
        'host': rows.get('smtp_host', ''),
        'port': int(rows.get('smtp_port') or 587),
        'user': rows.get('smtp_user', ''),
        'password': rows.get('smtp_password', ''),
        'from_addr': rows.get('smtp_from') or rows.get('smtp_user', ''),
        'use_tls': rows.get('smtp_use_tls', 'true') == 'true',
        'use_ssl': rows.get('smtp_use_ssl') == 'true',
    }


def smtp_is_configured() -> bool:
    cfg = get_smtp_config()
    return cfg['enabled'] and bool(cfg['host'])


def get_site_url(request=None) -> str:
    row = AppSettings.objects.filter(key='site_url').first()
    if row and row.value:
        return row.value.rstrip('/')
    if request is not None:
        return request.build_absolute_uri('/').rstrip('/')
    return 'http://localhost'


def get_app_name() -> str:
    row = AppSettings.objects.filter(key='app_name').first()
    return (row.value if row and row.value else 'SBRW Books')


def _send_now(to: str, subject: str, html: str, text: str = '') -> None:
    cfg = get_smtp_config()
    if not (cfg['enabled'] and cfg['host']):
        logger.info('SMTP disabled — skipping email "%s" to %s', subject, to)
        return

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = formataddr((get_app_name(), cfg['from_addr']))
    msg['To'] = to
    msg.attach(MIMEText(text or 'HTML email', 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))

    if cfg['use_ssl']:
        server = smtplib.SMTP_SSL(cfg['host'], cfg['port'], timeout=15)
    else:
        server = smtplib.SMTP(cfg['host'], cfg['port'], timeout=15)
    try:
        if cfg['use_tls'] and not cfg['use_ssl']:
            server.starttls()
        if cfg['user']:
            server.login(cfg['user'], cfg['password'])
        server.sendmail(cfg['from_addr'], [to], msg.as_string())
    finally:
        server.quit()


def send_email(to: str, subject: str, html: str, text: str = '') -> None:
    """Fire-and-forget send in a background thread."""
    def worker():
        try:
            _send_now(to, subject, html, text)
        except Exception as exc:
            logger.warning('Email "%s" to %s failed: %s', subject, to, exc)

    threading.Thread(target=worker, daemon=True).start()


def send_email_sync(to: str, subject: str, html: str, text: str = '') -> None:
    """Synchronous send that raises on failure — used by the admin test button."""
    _send_now(to, subject, html, text)



def _layout(title: str, body_html: str, footer: str = '') -> str:
    app = get_app_name()
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#4f46e5;padding:20px 28px;">
      <span style="color:#ffffff;font-size:18px;font-weight:bold;">📚 {app}</span>
    </div>
    <div style="padding:28px;color:#111827;">
      <h2 style="margin:0 0 16px;font-size:20px;">{title}</h2>
      {body_html}
    </div>
    <div style="padding:16px 28px;background:#f9fafb;color:#9ca3af;font-size:12px;">
      {footer or f'Это автоматическое письмо от {app}. Отвечать на него не нужно.'}
    </div>
  </div>
</body></html>"""


def _button(url: str, label: str) -> str:
    return (
        f'<p style="margin:24px 0;"><a href="{url}" '
        f'style="background:#4f46e5;color:#ffffff;text-decoration:none;'
        f'padding:12px 28px;border-radius:12px;font-weight:bold;display:inline-block;">{label}</a></p>'
        f'<p style="color:#6b7280;font-size:13px;">Или скопируйте ссылку в браузер:<br>'
        f'<a href="{url}" style="color:#4f46e5;word-break:break-all;">{url}</a></p>'
    )


def send_newsletter(subject: str, body_html: str, body_text: str = '') -> int:
    """Send a newsletter to all active users with an email address. Returns sent count."""
    if not smtp_is_configured():
        return 0
    if not _notify_enabled('email_notify_newsletter'):
        return 0
    from apps.users.models import User
    recipients = [
        u.email for u in User.objects.filter(is_active=True, email_hash__isnull=False).only('email')
    ]
    app = get_app_name()
    html = _layout(subject, body_html)
    for to in recipients:
        send_email(to, f'{app} — {subject}', html, body_text or subject)
    return len(recipients)


def send_verification_email(user, token: str, site_url: str) -> None:
    if not _notify_enabled('email_notify_verify'):
        return
    url = f'{site_url}/verify-email?token={token}'
    tpl_subject, tpl_body = _get_tpl('verify')
    action_btn = _button(url, 'Подтвердить email')
    ctx = dict(user_name=user.username, app_name=get_app_name(), verify_url=url, action_button=action_btn)
    subject = _render(tpl_subject, **ctx)
    body_html = _render(tpl_body, **ctx)
    html = _layout('Подтверждение регистрации', body_html)
    send_email(user.email, subject, html, f'Подтвердите email: {url}')


def send_password_reset_email(user, token: str, site_url: str) -> None:
    if not _notify_enabled('email_notify_reset'):
        return
    url = f'{site_url}/reset-password?token={token}'
    tpl_subject, tpl_body = _get_tpl('reset')
    action_btn = _button(url, 'Сбросить пароль')
    ctx = dict(user_name=user.username, app_name=get_app_name(), reset_url=url, action_button=action_btn)
    subject = _render(tpl_subject, **ctx)
    body_html = _render(tpl_body, **ctx)
    html = _layout('Сброс пароля', body_html)
    send_email(user.email, subject, html, f'Сброс пароля: {url}')


def send_new_book_in_series_email(user, book, series, site_url: str) -> None:
    if not _notify_enabled('email_notify_series'):
        return
    url = f'{site_url}/books/{book.id}'
    authors = ', '.join(a.name for a in book.authors.all()) or '—'
    tpl_subject, tpl_body = _get_tpl('series')
    action_btn = _button(url, 'Открыть книгу')
    ctx = dict(
        user_name=user.username, app_name=get_app_name(),
        series_name=series.name, book_title=book.title,
        book_authors=authors, book_url=url, action_button=action_btn,
    )
    subject = _render(tpl_subject, **ctx)
    body_html = _render(tpl_body, **ctx)
    footer = (f'Вы получили это письмо, потому что подписаны на серию «{series.name}». '
              f'Отписаться можно на странице серии.')
    html = _layout('Новая книга в серии', body_html, footer=footer)
    send_email(user.email, subject, html, f'Новая книга в серии {series.name}: {book.title} — {url}')
