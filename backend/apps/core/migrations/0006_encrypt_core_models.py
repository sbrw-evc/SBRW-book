"""
Schema migration: encrypt AppSettings.value and TelegramChat.chat_id,
add chat_id_hash for indexed lookups.
"""
from django.db import migrations, models
import apps.core.encryption


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_alter_telegramchat_id'),
    ]

    operations = [
        # AppSettings: convert value to encrypted TextField
        migrations.AlterField(
            model_name='appsettings',
            name='value',
            field=apps.core.encryption.EncryptedTextField(blank=True, null=True),
        ),
        # TelegramChat: add chat_id_hash (nullable until data migration)
        migrations.AddField(
            model_name='telegramchat',
            name='chat_id_hash',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
        # Convert chat_id from BigIntegerField(unique=True) to EncryptedBigIntegerField
        migrations.AlterField(
            model_name='telegramchat',
            name='chat_id',
            field=apps.core.encryption.EncryptedBigIntegerField(),
        ),
    ]
