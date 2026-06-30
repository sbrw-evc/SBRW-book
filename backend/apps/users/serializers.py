from django.utils import timezone
from rest_framework import serializers
from .models import User


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class TokenSerializer(serializers.Serializer):
    access_token = serializers.CharField()
    refresh_token = serializers.CharField()


class UserOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'email_verified', 'role', 'locale', 'theme',
            'is_active', 'avatar', 'first_name', 'last_name', 'patronymic', 'about',
            'reader_bg', 'show_full_name', 'show_reading_activity', 'show_online_status',
            'last_seen', 'totp_enabled', 'telegram_2fa_enabled', 'created_at', 'updated_at',
        ]


_ONLINE_SECONDS = 300
_AWAY_SECONDS = 1800


def compute_online_status(user):
    """Return 'online', 'away', or None based on last_seen and privacy."""
    if not getattr(user, 'show_online_status', True) or not user.last_seen:
        return None
    diff = (timezone.now() - user.last_seen).total_seconds()
    if diff < _ONLINE_SECONDS:
        return 'online'
    if diff < _AWAY_SECONDS:
        return 'away'
    return None


class PublicUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    online_status = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'about', 'full_name', 'created_at', 'online_status', 'last_seen']

    def get_full_name(self, obj):
        if not obj.show_full_name:
            return None
        parts = [obj.first_name, obj.patronymic, obj.last_name]
        return ' '.join(p for p in parts if p).strip() or None

    def get_online_status(self, obj):
        return compute_online_status(obj)

    def get_last_seen(self, obj):
        if not obj.show_online_status:
            return None
        return obj.last_seen


class UserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8)
    locale = serializers.CharField(max_length=10, default='ru')
    theme = serializers.CharField(max_length=20, default='light')


class UserUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    locale = serializers.CharField(max_length=10, required=False)
    theme = serializers.CharField(max_length=20, required=False)
    avatar = serializers.CharField(max_length=500, required=False, allow_null=True)
    password = serializers.CharField(min_length=8, required=False)
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    patronymic = serializers.CharField(max_length=100, required=False, allow_blank=True)
    about = serializers.CharField(required=False, allow_blank=True)
    reader_bg = serializers.CharField(max_length=50, required=False, allow_null=True, allow_blank=True)
    show_full_name = serializers.BooleanField(required=False)
    show_reading_activity = serializers.BooleanField(required=False)
    show_online_status = serializers.BooleanField(required=False)


class UserAdminUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['admin', 'moderator', 'user'], required=False)
    is_active = serializers.BooleanField(required=False)
