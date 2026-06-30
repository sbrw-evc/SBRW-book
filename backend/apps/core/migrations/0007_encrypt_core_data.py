"""
Data migration: encrypt existing AppSettings values and TelegramChat.chat_id,
compute chat_id_hash for unique lookups.
"""
from django.db import migrations, models


def encrypt_app_settings(apps, schema_editor):
    from django.conf import settings
    if not getattr(settings, 'FIELD_ENCRYPTION_KEY', ''):
        return

    from apps.core.encryption import encrypt, is_encrypted

    AppSettings = apps.get_model('core', 'AppSettings')
    for row in AppSettings.objects.all():
        if row.value and not is_encrypted(row.value):
            row.value = encrypt(row.value)
            row.save(update_fields=['value'])


def encrypt_telegram_chats(apps, schema_editor):
    from django.conf import settings
    if not getattr(settings, 'FIELD_ENCRYPTION_KEY', ''):
        return

    from apps.core.encryption import encrypt, hash_value, is_encrypted

    TelegramChat = apps.get_model('core', 'TelegramChat')
    for chat in TelegramChat.objects.all():
        # chat_id is still a raw integer/string at this point in historical model
        raw = str(chat.chat_id)
        if not is_encrypted(raw):
            chat.chat_id_hash = hash_value(raw)
            chat.chat_id = encrypt(raw)
            chat.save(update_fields=['chat_id', 'chat_id_hash'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_encrypt_core_models'),
    ]

    operations = [
        migrations.RunPython(encrypt_app_settings, reverse_code=noop),
        migrations.RunPython(encrypt_telegram_chats, reverse_code=noop),
        # After data populated, make chat_id_hash unique and non-nullable
        migrations.AlterField(
            model_name='telegramchat',
            name='chat_id_hash',
            field=models.CharField(db_index=True, max_length=64, unique=True),
        ),
    ]
