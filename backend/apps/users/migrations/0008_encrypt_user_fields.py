"""
Schema migration: convert sensitive User fields to encrypted TextField storage
and add email_hash for indexed lookups.
"""
from django.db import migrations, models
import apps.core.encryption


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_user_2fa_fields'),
    ]

    operations = [
        # Add email_hash (nullable until data migration fills it)
        migrations.AddField(
            model_name='user',
            name='email_hash',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
        # Convert email from EmailField(unique=True) to EncryptedCharField (TextField)
        migrations.AlterField(
            model_name='user',
            name='email',
            field=apps.core.encryption.EncryptedCharField(),
        ),
        # Convert name/bio fields to encrypted
        migrations.AlterField(
            model_name='user',
            name='first_name',
            field=apps.core.encryption.EncryptedCharField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='user',
            name='last_name',
            field=apps.core.encryption.EncryptedCharField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='user',
            name='patronymic',
            field=apps.core.encryption.EncryptedCharField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='user',
            name='about',
            field=apps.core.encryption.EncryptedTextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='user',
            name='totp_secret',
            field=apps.core.encryption.EncryptedCharField(blank=True, null=True),
        ),
    ]
