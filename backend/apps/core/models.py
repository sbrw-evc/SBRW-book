import uuid

from django.db import models
from django.conf import settings

from apps.core.encryption import EncryptedTextField, EncryptedBigIntegerField, hash_value


class AppSettings(models.Model):
    key = models.CharField(max_length=100, primary_key=True)
    value = EncryptedTextField(null=True, blank=True)

    class Meta:
        db_table = 'app_settings'


class Newsletter(models.Model):
    NL_TYPES = [
        ('new_book', 'Новая книга'),
        ('update', 'Обновление приложения'),
        ('custom', 'Произвольное'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    subject = models.CharField(max_length=255)
    body_html = models.TextField()
    body_text = models.TextField(blank=True)
    nl_type = models.CharField(max_length=50, choices=NL_TYPES, default='custom')
    created_by = models.ForeignKey(
        'users.User', null=True, on_delete=models.SET_NULL, related_name='newsletters'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'newsletters'
        ordering = ['-created_at']


class TelegramChat(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='telegram_chat',
    )
                                                                                              
    chat_id = EncryptedBigIntegerField()
    chat_id_hash = models.CharField(max_length=64, unique=True, db_index=True, null=True, blank=True)
    username = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'telegram_chats'

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if update_fields is None or 'chat_id' in update_fields:
            if self.chat_id is not None:
                self.chat_id_hash = hash_value(str(self.chat_id))
            else:
                self.chat_id_hash = None
            if update_fields is not None:
                kwargs['update_fields'] = list(update_fields) + ['chat_id_hash']
        super().save(*args, **kwargs)


class VpnConfig(models.Model):
    """Multiple VPN configurations with latency tracking for auto-selection."""
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=100)
    config_text  = EncryptedTextField()
    is_active    = models.BooleanField(default=False, db_index=True)
    last_latency_ms = models.FloatField(null=True, blank=True)
    last_checked = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'vpn_configs'
        ordering = ['created_at']


class SiteVisit(models.Model):
    date = models.DateField(db_index=True)
    ip_hash = models.CharField(max_length=16, db_index=True)
    is_authenticated = models.BooleanField(default=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='site_visits',
    )

    class Meta:
        db_table = 'site_visits'
        unique_together = [('date', 'ip_hash')]
