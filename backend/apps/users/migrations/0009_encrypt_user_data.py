"""
Data migration: encrypt existing User fields and compute email_hash.
Also invalidates all existing EmailTokens (they are short-lived; after this
migration token storage switches to HMAC hashing — old plaintext tokens
can no longer be verified).
"""
from django.db import migrations, models


def encrypt_users(apps, schema_editor):
    from django.conf import settings
    if not getattr(settings, 'FIELD_ENCRYPTION_KEY', ''):
        return  # skip silently when key is not configured (e.g. CI without secrets)

    from apps.core.encryption import encrypt, hash_value, is_encrypted

    User = apps.get_model('users', 'User')
    for user in User.objects.all():
        changed = []

        if user.email and not is_encrypted(user.email):
            user.email_hash = hash_value(user.email.lower())
            user.email = encrypt(user.email)
            changed += ['email', 'email_hash']
        elif user.email and not user.email_hash:
            # Already encrypted but hash missing (shouldn't happen, but handle it)
            from apps.core.encryption import decrypt
            try:
                plain = decrypt(user.email)
                user.email_hash = hash_value(plain.lower())
                changed.append('email_hash')
            except Exception:
                pass

        for field in ('first_name', 'last_name', 'patronymic', 'about'):
            val = getattr(user, field)
            if val and not is_encrypted(val):
                setattr(user, field, encrypt(val))
                changed.append(field)

        if user.totp_secret and not is_encrypted(user.totp_secret):
            user.totp_secret = encrypt(user.totp_secret)
            changed.append('totp_secret')

        if changed:
            user.save(update_fields=changed)


def invalidate_email_tokens(apps, schema_editor):
    """Mark all existing tokens as used — after this migration tokens are stored as HMAC hashes."""
    EmailToken = apps.get_model('users', 'EmailToken')
    EmailToken.objects.filter(used=False).update(used=True)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_encrypt_user_fields'),
    ]

    operations = [
        migrations.RunPython(encrypt_users, reverse_code=noop),
        migrations.RunPython(invalidate_email_tokens, reverse_code=noop),
        # After data is populated, make email_hash unique and non-nullable
        migrations.AlterField(
            model_name='user',
            name='email_hash',
            field=models.CharField(db_index=True, max_length=64, unique=True),
        ),
    ]
