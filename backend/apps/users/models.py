import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser
from .managers import UserManager
from apps.core.encryption import EncryptedCharField, EncryptedTextField, hash_value

ROLE_CHOICES = [
    ('admin', 'admin'),
    ('moderator', 'moderator'),
    ('user', 'user'),
]


class User(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=50, unique=True)

                                                                              
    email = EncryptedCharField()
    email_hash = models.CharField(max_length=64, unique=True, db_index=True, null=True, blank=True)

    email_verified = models.BooleanField(default=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    locale = models.CharField(max_length=10, default='ru')
    theme = models.CharField(max_length=20, default='light')
    is_active = models.BooleanField(default=True)
    avatar = models.CharField(max_length=500, null=True, blank=True)
    first_name = EncryptedCharField(blank=True, default='')
    last_name = EncryptedCharField(blank=True, default='')
    patronymic = EncryptedCharField(blank=True, default='')
    about = EncryptedTextField(blank=True, default='')
    reader_bg = models.CharField(max_length=50, null=True, blank=True)
    show_full_name = models.BooleanField(default=False)
    show_reading_activity = models.BooleanField(default=False)
    show_online_status = models.BooleanField(default=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    totp_secret = EncryptedCharField(null=True, blank=True)
    totp_enabled = models.BooleanField(default=False)
    telegram_2fa_enabled = models.BooleanField(default=False)
    telegram_newsletter_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    objects = UserManager()

    class Meta:
        db_table = 'users'

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if update_fields is None or 'email' in update_fields:
            if self.email:
                self.email_hash = hash_value(self.email.lower())
            else:
                self.email_hash = None
            if update_fields is not None:
                kwargs['update_fields'] = list(update_fields) + ['email_hash']
        super().save(*args, **kwargs)


class UserSession(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    refresh_jti  = models.CharField(max_length=36, unique=True, db_index=True)
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    user_agent   = models.TextField(blank=True, default='')
    device_os    = models.CharField(max_length=150, blank=True, default='')
    device_browser = models.CharField(max_length=150, blank=True, default='')
    country      = models.CharField(max_length=150, blank=True, default='')
    city         = models.CharField(max_length=150, blank=True, default='')
    is_active    = models.BooleanField(default=True, db_index=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_sessions'
        ordering = ['-created_at']


TOKEN_PURPOSES = [
    ('verify', 'verify'),
    ('reset', 'reset'),
]


class EmailToken(models.Model):
    """One-time tokens for email verification and password reset links.
    The token field stores HMAC-SHA256(raw_token) — never the raw token itself."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_tokens')
    purpose = models.CharField(max_length=20, choices=TOKEN_PURPOSES)
    token = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_tokens'
