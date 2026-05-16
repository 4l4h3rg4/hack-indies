import logging

from nacl.secret import SecretBox
from nacl.utils import random as nacl_random

from .config import settings

logger = logging.getLogger(__name__)


def _get_secret_box() -> SecretBox | None:
    key_hex = settings.encryption_key
    if not key_hex:
        logger.warning("ENCRYPTION_KEY not configured")
        return None
    try:
        key_bytes = bytes.fromhex(key_hex)
        if len(key_bytes) != SecretBox.KEY_SIZE:
            logger.error(f"ENCRYPTION_KEY must be {SecretBox.KEY_SIZE * 2} hex chars ({SecretBox.KEY_SIZE} bytes)")
            return None
        return SecretBox(key_bytes)
    except ValueError:
        logger.error("ENCRYPTION_KEY is not valid hex")
        return None


def encrypt_credentials(data: bytes) -> dict | None:
    box = _get_secret_box()
    if not box:
        return None
    nonce = nacl_random(SecretBox.NONCE_SIZE)
    encrypted = box.encrypt(data, nonce)
    return {
        "encrypted": encrypted.ciphertext.hex(),
        "nonce": nonce.hex(),
    }


def decrypt_credentials(encrypted_hex: str, nonce_hex: str) -> bytes | None:
    box = _get_secret_box()
    if not box:
        return None
    try:
        encrypted = bytes.fromhex(encrypted_hex)
        nonce = bytes.fromhex(nonce_hex)
        return box.decrypt(encrypted, nonce)
    except Exception as e:
        logger.error(f"Failed to decrypt credentials: {e}")
        return None


def generate_encryption_key() -> str:
    return nacl_random(SecretBox.KEY_SIZE).hex()
