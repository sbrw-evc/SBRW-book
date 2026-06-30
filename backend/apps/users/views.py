import io
import os
import secrets
import uuid
from datetime import timedelta

from django.contrib.auth import authenticate
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User, EmailToken, UserSession
from .serializers import (
    LoginSerializer, UserOutSerializer, UserCreateSerializer,
    UserUpdateSerializer, UserAdminUpdateSerializer, PublicUserSerializer,
)
from .permissions import IsAdmin, IsModerator
from .session_utils import parse_user_agent, get_ip_location
from apps.core.encryption import hash_value


def _issue_email_token(user, purpose: str, ttl_hours: int) -> str:
    """Invalidate previous tokens of this purpose and issue a fresh one.
    Stores HMAC hash of the token — never the raw token."""
    EmailToken.objects.filter(user=user, purpose=purpose, used=False).update(used=True)
    token = secrets.token_urlsafe(32)
    EmailToken.objects.create(
        user=user,
        purpose=purpose,
        token=hash_value(token),
        expires_at=timezone.now() + timedelta(hours=ttl_hours),
    )
    return token


def _consume_email_token(token: str, purpose: str):
    """Return the token's user and mark it used, or None if invalid/expired."""
    try:
        et = EmailToken.objects.select_related('user').get(
            token=hash_value(token), purpose=purpose, used=False
        )
    except EmailToken.DoesNotExist:
        return None
    if et.expires_at < timezone.now():
        return None
    et.used = True
    et.save(update_fields=['used'])
    return et.user


def _get_client_ip(request) -> str:
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def _create_login_session(user, request) -> tuple:
    """Create a UserSession and return (refresh_token, session_id).

    Geo lookup and Telegram notification run in a background thread so login
    latency is not affected.
    """
    import threading

    ua  = request.META.get('HTTP_USER_AGENT', '')
    ip  = _get_client_ip(request)
    os_str, browser_str = parse_user_agent(ua) if ua else ('', '')

    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    refresh_jti = str(refresh.payload['jti'])

    session = UserSession.objects.create(
        user=user,
        refresh_jti=refresh_jti,
        ip_address=ip or None,
        user_agent=ua,
        device_os=os_str,
        device_browser=browser_str,
    )

    session_id = str(session.id)
    refresh['sid'] = session_id

    def _background():
        country, city = get_ip_location(ip)
        if country or city:
            UserSession.objects.filter(id=session.id).update(country=country, city=city)
        try:
            tg = user.telegram_chat
            from apps.core.telegram import notify_new_login
            from apps.core.email import get_site_url
            sessions_url = get_site_url().rstrip('/') + '/profile'
            notify_new_login(
                chat_id=tg.chat_id,
                created_at=session.created_at,
                os_str=os_str,
                browser_str=browser_str,
                country=country,
                city=city,
                ip=ip,
                sessions_url=sessions_url,
            )
        except Exception:
            pass

    threading.Thread(target=_background, daemon=True).start()
    return refresh, session_id


def get_tokens_for_user(user, refresh=None, session_id=None):
    if refresh is None:
        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
    if session_id:
        refresh['sid'] = str(session_id)
    access = refresh.access_token
    access['role'] = user.role
    if session_id:
        access['sid'] = str(session_id)
    return {
        'access_token': str(access),
        'refresh_token': str(refresh),
    }


def _revoke_session(session):
    """Mark session inactive and blacklist it in Redis for the access token lifetime."""
    session.is_active = False
    session.save(update_fields=['is_active'])
    cache.set(f'blacklist:session:{session.id}', 1, 7200)                               



class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        user = authenticate(request, username=username, password=password)
        if not user:
            try:
                u = User.objects.get(email_hash=hash_value(username.lower()))
                user = authenticate(request, username=u.username, password=password)
            except User.DoesNotExist:
                pass

        if not user:
            return Response({'detail': 'Incorrect username or password'}, status=401)
        if not user.is_active:
            return Response({'detail': 'Account is inactive'}, status=401)

                   
        if user.totp_enabled or user.telegram_2fa_enabled:
            pending_id = str(uuid.uuid4())
            methods = []
            if user.totp_enabled:
                methods.append('totp')
            if user.telegram_2fa_enabled:
                methods.append('telegram')

                                                                             
            cache.set(f'2fa_pending:{pending_id}', str(user.id), 300)
            cache.set(f'2fa_meta:{pending_id}', {
                'ua':  request.META.get('HTTP_USER_AGENT', ''),
                'ip':  _get_client_ip(request),
            }, 300)

            if user.telegram_2fa_enabled:
                try:
                    tg = user.telegram_chat
                    otp = str(secrets.randbelow(1000000)).zfill(6)
                    cache.set(f'2fa_otp:{pending_id}', otp, 300)
                    from apps.core.telegram import send_2fa_code
                    send_2fa_code(tg.chat_id, otp)
                except Exception as exc:
                    import logging
                    logging.getLogger(__name__).error(
                        '2FA Telegram send failed for user %s: %s', user.username, exc
                    )

            return Response({
                'requires_2fa': True,
                'session_id': pending_id,
                'methods': methods,
            })

        refresh, session_id = _create_login_session(user, request)
        return Response(get_tokens_for_user(user, refresh=refresh, session_id=session_id))


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token_str = request.data.get('refresh_token')
        if not refresh_token_str:
            return Response({'detail': 'refresh_token required'}, status=400)
        try:
            refresh = RefreshToken(refresh_token_str)
            user_id = refresh.payload.get('user_id')
            user = User.objects.get(id=user_id)
            if not user.is_active:
                return Response({'detail': 'User inactive'}, status=401)

                                                                          
            refresh_jti = refresh.payload.get('jti')
            if refresh_jti:
                session = UserSession.objects.filter(refresh_jti=refresh_jti).first()
                if session and not session.is_active:
                    return Response({'detail': 'Session has been revoked'}, status=401)

                                                                                 
            sid = refresh.payload.get('sid')
            access = refresh.access_token
            access['role'] = user.role
            if sid:
                access['sid'] = sid
            return Response({
                'access_token': str(access),
                'refresh_token': refresh_token_str,
            })
        except (TokenError, User.DoesNotExist, Exception):
            return Response({'detail': 'Invalid refresh token'}, status=401)


class MeView(APIView):
    def get(self, request):
        return Response(UserOutSerializer(request.user).data)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from apps.core.models import AppSettings
        setting = AppSettings.objects.filter(key='allow_registration').first()
        if setting and setting.value == 'false':
            return Response({'detail': 'Registration is disabled'}, status=403)

        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        if User.objects.filter(username=d['username']).exists():
            return Response({'detail': 'Username already taken'}, status=400)
        if User.objects.filter(email_hash=hash_value(d['email'].lower())).exists():
            return Response({'detail': 'Email already registered'}, status=400)

        user = User.objects.create_user(
            username=d['username'],
            email=d['email'],
            password=d['password'],
            role='user',
            locale=d.get('locale', 'ru'),
            theme=d.get('theme', 'light'),
        )

        from apps.core.email import smtp_is_configured, send_verification_email, get_site_url
        verification_sent = False
        if smtp_is_configured():
            token = _issue_email_token(user, 'verify', ttl_hours=48)
            send_verification_email(user, token, get_site_url(request))
            verification_sent = True

                                                        
        require_2fa_row = AppSettings.objects.filter(key='require_2fa').first()
        requires_2fa_setup = (require_2fa_row and require_2fa_row.value == 'true')

        data = UserOutSerializer(user).data
        data['verification_sent'] = verification_sent
        data['requires_2fa_setup'] = requires_2fa_setup
        return Response(data, status=201)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({'detail': 'token required'}, status=400)
        user = _consume_email_token(token, 'verify')
        if not user:
            return Response({'detail': 'Invalid or expired token'}, status=400)
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        return Response({'success': True})


class ResendVerificationView(APIView):
    def post(self, request):
        from apps.core.email import smtp_is_configured, send_verification_email, get_site_url
        user = request.user
        if user.email_verified:
            return Response({'detail': 'Email already verified'}, status=400)
        if not smtp_is_configured():
            return Response({'detail': 'SMTP is not configured'}, status=400)
        token = _issue_email_token(user, 'verify', ttl_hours=48)
        send_verification_email(user, token, get_site_url(request))
        return Response({'success': True})


class RequestPasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from apps.core.email import smtp_is_configured, send_password_reset_email, get_site_url
        email = (request.data.get('email') or '').strip()
        if not email:
            return Response({'detail': 'email required'}, status=400)
        if not smtp_is_configured():
            return Response({'detail': 'SMTP is not configured'}, status=400)
        try:
            user = User.objects.get(email_hash=hash_value(email.lower()), is_active=True)
        except User.DoesNotExist:
            return Response({'success': True})
        token = _issue_email_token(user, 'reset', ttl_hours=2)
        send_password_reset_email(user, token, get_site_url(request))
        return Response({'success': True})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        password = request.data.get('password') or ''
        if not token or not password:
            return Response({'detail': 'token and password required'}, status=400)
        if len(password) < 8:
            return Response({'detail': 'Password must be at least 8 characters'}, status=400)
        user = _consume_email_token(token, 'reset')
        if not user:
            return Response({'detail': 'Invalid or expired token'}, status=400)
        user.set_password(password)
        user.email_verified = True
        user.save(update_fields=['password', 'email_verified'])
        return Response({'success': True})



class Verify2FAView(APIView):
    """Second step of login when 2FA is required."""
    permission_classes = [AllowAny]

    def post(self, request):
        session_id = (request.data.get('session_id') or '').strip()
        code = (request.data.get('code') or '').strip()
        method = (request.data.get('method') or '').strip()

        if not session_id or not code or not method:
            return Response({'detail': 'session_id, code and method required'}, status=400)

        user_id = cache.get(f'2fa_pending:{session_id}')
        if not user_id:
            return Response({'detail': 'Session expired. Please log in again.'}, status=400)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=404)

        if method == 'totp':
            import pyotp
            if not user.totp_enabled or not user.totp_secret:
                return Response({'detail': 'TOTP not enabled for this account'}, status=400)
            if not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
                return Response({'detail': 'Invalid code'}, status=400)

        elif method == 'telegram':
            stored = cache.get(f'2fa_otp:{session_id}')
            if not stored or code != stored:
                return Response({'detail': 'Invalid or expired code'}, status=400)
            cache.delete(f'2fa_otp:{session_id}')

        else:
            return Response({'detail': 'Unknown 2FA method'}, status=400)

        cache.delete(f'2fa_pending:{session_id}')

                                                                                    
        meta = cache.get(f'2fa_meta:{session_id}') or {}
        cache.delete(f'2fa_meta:{session_id}')

        class _FakeRequest:
            META = {
                'HTTP_USER_AGENT': meta.get('ua', ''),
                'REMOTE_ADDR': meta.get('ip', ''),
            }

        refresh, login_session_id = _create_login_session(user, _FakeRequest())
        return Response(get_tokens_for_user(user, refresh=refresh, session_id=login_session_id))


class Resend2FAView(APIView):
    """Re-send Telegram OTP for an active 2FA session."""
    permission_classes = [AllowAny]

    def post(self, request):
        session_id = (request.data.get('session_id') or '').strip()
        if not session_id:
            return Response({'detail': 'session_id required'}, status=400)

        user_id = cache.get(f'2fa_pending:{session_id}')
        if not user_id:
            return Response({'detail': 'Session expired. Please log in again.'}, status=400)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=404)

        if not user.telegram_2fa_enabled:
            return Response({'detail': 'Telegram 2FA not enabled'}, status=400)

        try:
            tg = user.telegram_chat
        except Exception:
            return Response({'detail': 'Telegram not linked'}, status=400)

        otp = str(secrets.randbelow(1000000)).zfill(6)
        cache.set(f'2fa_otp:{session_id}', otp, 300)
        from apps.core.telegram import send_2fa_code
        send_2fa_code(tg.chat_id, otp)
        return Response({'success': True})



class TOTPSetupView(APIView):
    """Generate a new TOTP secret and QR code for the current user."""

    def post(self, request):
        import pyotp
        import qrcode
        import base64
        from apps.core.email import get_app_name

        secret = pyotp.random_base32()
        app_name = get_app_name()
        provisioning_uri = pyotp.TOTP(secret).provisioning_uri(
            name=request.user.email,
            issuer_name=app_name,
        )

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

        cache.set(f'totp_setup:{request.user.id}', secret, 600)

        return Response({
            'secret': secret,
            'qr_code': f'data:image/png;base64,{qr_b64}',
            'provisioning_uri': provisioning_uri,
        })


class TOTPEnableView(APIView):
    """Verify TOTP code and activate TOTP for the current user."""

    def post(self, request):
        import pyotp
        code = (request.data.get('code') or '').strip()
        if not code:
            return Response({'detail': 'code required'}, status=400)

        secret = cache.get(f'totp_setup:{request.user.id}')
        if not secret:
            return Response({'detail': 'Setup session expired. Start again.'}, status=400)

        if not pyotp.TOTP(secret).verify(code, valid_window=1):
            return Response({'detail': 'Invalid code'}, status=400)

        request.user.totp_secret = secret
        request.user.totp_enabled = True
        request.user.save(update_fields=['totp_secret', 'totp_enabled'])
        cache.delete(f'totp_setup:{request.user.id}')
        return Response(UserOutSerializer(request.user).data)


class TOTPDisableView(APIView):
    """Disable TOTP after confirming with a valid code."""

    def post(self, request):
        import pyotp
        code = (request.data.get('code') or '').strip()
        if not code:
            return Response({'detail': 'code required'}, status=400)

        if not request.user.totp_enabled or not request.user.totp_secret:
            return Response({'detail': 'TOTP is not enabled'}, status=400)

        if not pyotp.TOTP(request.user.totp_secret).verify(code, valid_window=1):
            return Response({'detail': 'Invalid code'}, status=400)

        request.user.totp_secret = None
        request.user.totp_enabled = False
        request.user.save(update_fields=['totp_secret', 'totp_enabled'])
        return Response(UserOutSerializer(request.user).data)



class TelegramLinkInitView(APIView):
    """Generate a one-time linking code.

    Returns the code for the user to copy and send to the bot themselves.
    Both bots (core + upload) validate any valid code from Redis, so the
    same code works for either bot.
    """

    def post(self, request):
        from apps.core.telegram import get_bot_username as core_bot_username
        from apps.telegram_upload.bot import (
            get_bot_username as upload_bot_username,
            get_token as upload_bot_token,
        )

        core_username   = core_bot_username()
        upload_username = upload_bot_username() if upload_bot_token() else None

        if not core_username and not upload_username:
            return Response({'detail': 'Bot username not configured'}, status=400)

        code = secrets.token_urlsafe(8)
        cache.set(f'telegram_link:{code}', str(request.user.id), 600)
        return Response({
            'code': code,
            'core_bot_url':   f'https://t.me/{core_username}' if core_username else None,
            'upload_bot_url': f'https://t.me/{upload_username}' if upload_username else None,
        })


class TelegramStatusView(APIView):
    """Check Telegram link status and toggle 2FA."""

    def get(self, request):
        from apps.core.models import TelegramChat
        try:
            chat = request.user.telegram_chat
            return Response({
                'linked': True,
                'username': chat.username,
                'telegram_2fa_enabled': request.user.telegram_2fa_enabled,
            })
        except TelegramChat.DoesNotExist:
            return Response({'linked': False, 'telegram_2fa_enabled': False})

    def delete(self, request):
        from apps.core.models import TelegramChat
        try:
            request.user.telegram_chat.delete()
        except TelegramChat.DoesNotExist:
            pass
        if request.user.telegram_2fa_enabled:
            request.user.telegram_2fa_enabled = False
            request.user.save(update_fields=['telegram_2fa_enabled'])
        return Response({'success': True})


class TelegramToggle2FAView(APIView):
    """Enable or disable Telegram 2FA (requires linked account)."""

    def post(self, request):
        from apps.core.models import TelegramChat
        enable = request.data.get('enable', True)
        try:
            _ = request.user.telegram_chat
        except TelegramChat.DoesNotExist:
            return Response({'detail': 'Telegram account not linked'}, status=400)
        request.user.telegram_2fa_enabled = bool(enable)
        request.user.save(update_fields=['telegram_2fa_enabled'])
        return Response(UserOutSerializer(request.user).data)



class TelegramWebhookView(APIView):
    """Receives updates from Telegram Bot API (webhook mode)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data
        message = data.get('message') or data.get('edited_message') or {}
        if not message:
            return Response({'ok': True})

        text = (message.get('text') or '').strip()
        from_data = message.get('from', {})
        chat_id = (message.get('chat') or {}).get('id') or from_data.get('id')
        tg_username = from_data.get('username', '')

        if not chat_id:
            return Response({'ok': True})

        if text.startswith('/start'):
            parts = text.split(maxsplit=1)
            code = parts[1].strip() if len(parts) > 1 else ''
            if code:
                self._handle_link(chat_id, tg_username, code)
            else:
                from apps.core.telegram import send_message, get_app_name
                app = get_app_name()
                send_message(chat_id, (
                    f'👋 Привет! Я бот <b>{app}</b>.\n\n'
                    f'Чтобы привязать аккаунт, перейдите в настройки профиля '
                    f'и нажмите «Привязать Telegram».'
                ))

        return Response({'ok': True})

    @staticmethod
    def _handle_link(chat_id: int, tg_username: str, code: str):
        from apps.core.models import TelegramChat
        from apps.core.telegram import send_message, get_app_name

        app = get_app_name()
        user_id = cache.get(f'telegram_link:{code}')
        if not user_id:
            send_message(chat_id, (
                '❌ Код не найден или истёк.\n\n'
                'Получите новый в настройках профиля.'
            ))
            return

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return

                                                   
        TelegramChat.objects.filter(chat_id_hash=hash_value(str(chat_id))).exclude(user=user).delete()
        TelegramChat.objects.update_or_create(
            user=user,
            defaults={'chat_id': chat_id, 'username': tg_username},
        )
        cache.delete(f'telegram_link:{code}')

        from apps.core.telegram import notify_account_linked
        notify_account_linked(chat_id, user.username)



class UserListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        search = request.query_params.get('search')
        from django.db.models import Q
        qs = User.objects.all()
        if search:
            qs = qs.filter(username__icontains=search)
        offset = (page - 1) * page_size
        return Response(UserOutSerializer(qs[offset:offset + page_size], many=True).data)

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''
        role = request.data.get('role', 'user')

        if not username or not email or not password:
            return Response({'detail': 'username, email and password are required'}, status=400)
        if len(password) < 8:
            return Response({'detail': 'Password must be at least 8 characters'}, status=400)
        if role not in ('user', 'moderator', 'admin'):
            return Response({'detail': 'Invalid role'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already taken'}, status=400)
        if User.objects.filter(email_hash=hash_value(email.lower())).exists():
            return Response({'detail': 'Email already registered'}, status=400)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            locale='ru',
            theme='dark',
        )
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        return Response(UserOutSerializer(user).data, status=201)


class UserDetailView(APIView):
    def get(self, request, user_id):
        if str(request.user.id) != str(user_id) and request.user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(UserOutSerializer(user).data)

    def delete(self, request, user_id):
        if request.user.role != 'admin':
            return Response({'detail': 'Forbidden'}, status=403)
        if str(request.user.id) == str(user_id):
            return Response({'detail': 'Cannot delete yourself'}, status=400)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        user.delete()
        return Response({'success': True})


class UpdateMeView(APIView):
    def put(self, request):
        serializer = UserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        user = request.user
        for field in (
            'email', 'locale', 'theme', 'avatar', 'first_name', 'last_name',
            'patronymic', 'about', 'reader_bg', 'show_full_name',
            'show_reading_activity', 'show_online_status',
        ):
            if field in d:
                setattr(user, field, d[field])
        if 'password' in d:
            user.set_password(d['password'])
        user.save()
        return Response(UserOutSerializer(user).data)


class AvatarUploadView(APIView):
    from rest_framework.parsers import MultiPartParser, FormParser
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from django.conf import settings
        from PIL import Image

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file'}, status=400)
        try:
            import time
            from PIL import Image as PILImage
            data = file_obj.read()
            img = PILImage.open(io.BytesIO(data))
            img = img.convert('RGB')
            img = img.resize((512, 512), PILImage.LANCZOS)
            avatars_dir = os.path.join(settings.MEDIA_ROOT, 'avatars')
            os.makedirs(avatars_dir, exist_ok=True)
            path = os.path.join(avatars_dir, f'{request.user.id}.jpg')
            img.save(path, 'JPEG', quality=90)
                                                                                 
            v = int(time.time())
            url = f'/uploads/avatars/{request.user.id}.jpg?v={v}'
            request.user.avatar = url
            request.user.save(update_fields=['avatar'])
            return Response({'avatar': url})
        except Exception as exc:
            return Response({'detail': f'Invalid image: {exc}'}, status=400)


class UpdateUserRoleView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        serializer = UserAdminUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        if 'role' in d:
            user.role = d['role']
        if 'is_active' in d:
            user.is_active = d['is_active']
        user.save()
        return Response(UserOutSerializer(user).data)


class MyLibraryView(APIView):
    """Books the current user has reading progress for, sorted by last read."""

    def get(self, request):
        from apps.books.models import ReadingProgress, UserRating
        from apps.books.serializers import BookShortSerializer

        progresses = (
            ReadingProgress.objects
            .filter(user=request.user)
            .select_related('book')
            .prefetch_related('book__authors', 'book__files', 'book__series', 'book__tags')
            .order_by('-last_read')
        )
        result = []
        seen_ids = set()
        for p in progresses:
            if str(p.book_id) in seen_ids:
                continue
            seen_ids.add(str(p.book_id))
            result.append({
                'book': BookShortSerializer(p.book).data,
                'percentage': p.percentage,
                'cfi_position': p.cfi_position,
                'last_read': p.last_read.isoformat() if p.last_read else None,
            })

                                                                              
        rated_ids = (
            UserRating.objects
            .filter(user=request.user)
            .exclude(book_id__in=seen_ids)
            .values_list('book_id', flat=True)
        )
        from apps.books.models import Book
        for book in Book.objects.filter(id__in=rated_ids).prefetch_related(
            'authors', 'files', 'series', 'tags'
        ):
            result.append({
                'book': BookShortSerializer(book).data,
                'percentage': 0,
                'cfi_position': None,
                'last_read': None,
            })

        return Response(result)


class UserSearchView(APIView):
    """Search users by username (for adding members to chat rooms)."""

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response([])
        users = (
            User.objects
            .filter(username__icontains=q, is_active=True)
            .exclude(id=request.user.id)[:20]
        )
        return Response(PublicUserSerializer(users, many=True).data)


class PublicProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        data = PublicUserSerializer(user).data

        if user.show_reading_activity:
            from apps.books.models import ReadingProgress, Book
            from apps.books.serializers import BookShortSerializer
            progresses = (
                ReadingProgress.objects
                .filter(user=user)
                .select_related('book')
                .prefetch_related('book__authors', 'book__files', 'book__series', 'book__tags')
                .order_by('-last_read')[:20]
            )
            reading_now = []
            finished = []
            for p in progresses:
                entry = {
                    'book': BookShortSerializer(p.book).data,
                    'percentage': p.percentage,
                    'last_read': p.last_read.isoformat(),
                }
                if p.percentage >= 95:
                    finished.append(entry)
                else:
                    reading_now.append(entry)
            data['reading_now'] = reading_now
            data['finished'] = finished
        else:
            data['reading_now'] = None
            data['finished'] = None

        from apps.books.models import UserRating
        from apps.books.serializers import BookShortSerializer
        ratings = (
            UserRating.objects
            .filter(user=user)
            .select_related('book')
            .prefetch_related('book__authors', 'book__files', 'book__series', 'book__tags')
            .order_by('-created_at')[:50]
        )
        reviews_data = []
        for r in ratings:
            reviews_data.append({
                'id': str(r.id),
                'rating': r.rating,
                'review': r.review,
                'created_at': r.created_at.isoformat(),
                'book': BookShortSerializer(r.book).data,
            })
        data['reviews'] = reviews_data

        from apps.books.models import BookComment
        comments = (
            BookComment.objects
            .filter(user=user)
            .select_related('book')
            .prefetch_related('book__authors', 'book__files', 'book__series', 'book__tags')
            .order_by('-created_at')[:50]
        )
        discussions_data = []
        for c in comments:
            discussions_data.append({
                'id': str(c.id),
                'text': c.text,
                'created_at': c.created_at.isoformat(),
                'book': BookShortSerializer(c.book).data,
            })
        data['discussions'] = discussions_data

        return Response(data)



class SessionListView(APIView):
    """GET: list active sessions. DELETE: revoke all except current."""

    def get(self, request):
        current_sid = getattr(request, 'current_session_id', None)
        sessions = request.user.sessions.filter(is_active=True)
        return Response([
            {
                'id':             str(s.id),
                'ip_address':     s.ip_address,
                'device_os':      s.device_os,
                'device_browser': s.device_browser,
                'country':        s.country,
                'city':           s.city,
                'created_at':     s.created_at.isoformat(),
                'last_seen_at':   s.last_seen_at.isoformat(),
                'is_current':     str(s.id) == current_sid,
            }
            for s in sessions
        ])

    def delete(self, request):
        current_sid = getattr(request, 'current_session_id', None)
        qs = request.user.sessions.filter(is_active=True)
        if current_sid:
            qs = qs.exclude(id=current_sid)
        for s in qs:
            _revoke_session(s)
        return Response({'success': True})


class SessionRevokeView(APIView):
    """DELETE: revoke a specific session by ID."""

    def delete(self, request, session_id):
        try:
            session = request.user.sessions.get(id=session_id, is_active=True)
        except (UserSession.DoesNotExist, Exception):
            return Response({'detail': 'Session not found'}, status=404)
        _revoke_session(session)
        return Response({'success': True})
