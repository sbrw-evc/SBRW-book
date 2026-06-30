from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import AppSettings
from apps.users.models import User
from apps.core.encryption import hash_value


class PublicSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        keys = ['app_name', 'app_icon', 'default_locale', 'default_theme',
                'telegram_bot_token', 'telegram_enabled', 'require_auth']
        rows = AppSettings.objects.filter(key__in=keys)
        data = {r.key: r.value for r in rows}
        tg_enabled = data.get('telegram_enabled', 'true') != 'false'
        tg_token = bool((data.get('telegram_bot_token') or '').strip())
        return Response({
            'app_name': data.get('app_name', 'SBRW Books'),
            'app_icon': data.get('app_icon', 'BookOpen'),
            'default_locale': data.get('default_locale', 'ru'),
            'default_theme': data.get('default_theme', 'dark'),
            'telegram_configured': tg_enabled and tg_token,
            'require_auth': data.get('require_auth', 'false') == 'true',
        })


def is_setup_done():
    row = AppSettings.objects.filter(key='setup_completed').first()
    return row is not None and row.value == 'true'


class SetupStatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'completed': is_setup_done()})


class SetupCompleteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if is_setup_done():
            return Response({'detail': 'Setup already completed'}, status=400)

        username = request.data.get('admin_username', '').strip()
        email = request.data.get('admin_email', '').strip()
        password = request.data.get('admin_password', '')
        locale = request.data.get('locale', 'ru')
        theme = request.data.get('theme', 'light')

        if not username or not email or not password:
            return Response({'detail': 'admin_username, admin_email, admin_password are required'}, status=400)
        if len(password) < 8:
            return Response({'detail': 'Password must be at least 8 characters'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists'}, status=400)
        if User.objects.filter(email_hash=hash_value(email.lower())).exists():
            return Response({'detail': 'Email already exists'}, status=400)

        admin = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role='admin',
            locale=locale,
            theme=theme,
        )
        admin.email_verified = True
        admin.save(update_fields=['email_verified'])

        settings_map = {
            'setup_completed': 'true',
            'default_locale': locale,
            'default_theme': theme,
            'allow_registration': 'true',
            'app_name': 'SBRW Books',
            'site_url': request.build_absolute_uri('/').rstrip('/'),
        }

                                                   
        smtp = request.data.get('smtp') or {}
        if isinstance(smtp, dict) and smtp.get('host'):
            settings_map.update({
                'smtp_enabled': 'true' if smtp.get('enabled', True) else 'false',
                'smtp_host': str(smtp.get('host', '')),
                'smtp_port': str(smtp.get('port', 587)),
                'smtp_user': str(smtp.get('user', '')),
                'smtp_password': str(smtp.get('password', '')),
                'smtp_from': str(smtp.get('from_addr') or smtp.get('user', '')),
                'smtp_use_tls': 'true' if smtp.get('use_tls', True) else 'false',
                'smtp_use_ssl': 'true' if smtp.get('use_ssl', False) else 'false',
            })
        else:
            settings_map['smtp_enabled'] = 'false'

        for key, value in settings_map.items():
            AppSettings.objects.update_or_create(key=key, defaults={'value': value})

        return Response({'success': True, 'message': 'Setup completed'})
