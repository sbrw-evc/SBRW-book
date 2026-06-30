"""
Field-level encryption for sensitive database columns.

Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography library.
Requires FIELD_ENCRYPTION_KEY in settings (base64url-encoded 32-byte key).

Encrypted values always start with 'gAAAAA' (Fernet magic bytes in base64).
This prefix is used to detect already-encrypted values in data migrations.
"""
import hashlib
import hmac as _hmac

from django.conf import settings
from django.db import models


def _fernet():
    from cryptography.fernet import Fernet
    key = getattr(settings, 'FIELD_ENCRYPTION_KEY', '')
    if not key:
        raise RuntimeError(
            'FIELD_ENCRYPTION_KEY is not set. '
            'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(value: str) -> str:
    """Encrypt a string value using Fernet. Returns base64url ciphertext."""
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """Decrypt a Fernet ciphertext. Raises InvalidToken if the value is not valid ciphertext."""
    return _fernet().decrypt(value.encode()).decode()


def is_encrypted(value: str) -> bool:
    """Return True if the value looks like Fernet ciphertext (quick heuristic)."""
    return bool(value) and value.startswith('gAAAAA')


def hash_value(value: str) -> str:
    """Deterministic HMAC-SHA256 hex digest — used for indexed/unique lookups on encrypted fields."""
    key = getattr(settings, 'FIELD_ENCRYPTION_KEY', '')
    if not key:
        raise RuntimeError('FIELD_ENCRYPTION_KEY is not set.')
    key_bytes = key.encode() if isinstance(key, str) else key
    return _hmac.new(key_bytes, value.encode(), hashlib.sha256).hexdigest()


class EncryptedMixin:
    """Mixin that transparently encrypts on write and decrypts on read."""

    def from_db_value(self, value, expression, connection):
        if not value:
            return value
        if not is_encrypted(value):
            return value                                                             
        try:
            return decrypt(value)
        except Exception:
            return value                                                   

    def get_prep_value(self, value):
        if not value:
            return value
        if is_encrypted(value):
            return value                                                      
        return encrypt(value)


class EncryptedCharField(EncryptedMixin, models.TextField):
    """Stores short string data encrypted (replaces CharField for sensitive fields)."""


class EncryptedTextField(EncryptedMixin, models.TextField):
    """Stores long text data encrypted."""


class EncryptedBigIntegerField(EncryptedMixin, models.TextField):
    """Stores a BigInteger as an encrypted string; returns int on read."""

    def from_db_value(self, value, expression, connection):
        raw = super().from_db_value(value, expression, connection)
        if raw is None:
            return raw
        try:
            return int(raw)
        except (ValueError, TypeError):
            return raw

    def get_prep_value(self, value):
        if value is None:
            return value
        return super().get_prep_value(str(value))
