"""
Privacy & Encryption Compatibility Module (Section 9 of Master Specification).
Supports the pitch deck's AES-GCM-256 + PBKDF2-SHA256 architecture:
- Client-side browser WebCrypto AES-GCM-256 ciphertexts (12-byte IV + ciphertext+tag)
- Server-side validation of ciphertext & IV byte lengths
- Server-side envelope encryption helper for plaintext fallback requests
  (ensuring private content is NEVER persisted in plaintext in Cloud SQL)
"""
from __future__ import annotations

import base64
import hashlib
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


@dataclass
class EncryptedPayload:
    ciphertext: bytes
    iv: bytes

    def to_base64(self) -> tuple[str, str]:
        return (
            base64.b64encode(self.ciphertext).decode("ascii"),
            base64.b64encode(self.iv).decode("ascii"),
        )


def derive_key_pbkdf2(passphrase: str, salt: bytes, iterations: int = 100_000) -> bytes:
    """Derive a 256-bit (32-byte) AES key using PBKDF2-HMAC-SHA256 (WebCrypto compatible)."""
    return hashlib.pbkdf2_hmac("sha256", passphrase.encode("utf-8"), salt, iterations, dklen=32)


def encrypt_aes_gcm_256(plaintext: str, key: bytes, iv: bytes | None = None) -> EncryptedPayload:
    """Encrypt UTF-8 string with AES-GCM-256 (12-byte IV, 16-byte auth tag appended)."""
    if len(key) != 32:
        raise ValueError("AES-GCM-256 requires a 32-byte (256-bit) key.")
    nonce = iv if iv is not None else os.urandom(12)
    if len(nonce) != 12:
        raise ValueError("AES-GCM standard IV must be 12 bytes (96 bits).")
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)
    return EncryptedPayload(ciphertext=ct, iv=nonce)


def decrypt_aes_gcm_256(ciphertext: bytes, iv: bytes, key: bytes) -> str:
    """Decrypt AES-GCM-256 ciphertext+tag back to UTF-8 string."""
    if len(key) != 32:
        raise ValueError("AES-GCM-256 requires a 32-byte (256-bit) key.")
    if len(iv) != 12:
        raise ValueError("AES-GCM standard IV must be 12 bytes (96 bits).")
    aesgcm = AESGCM(key)
    pt = aesgcm.decrypt(iv, ciphertext, associated_data=None)
    return pt.decode("utf-8")


def decode_client_ciphertext(ciphertext_b64: str, iv_b64: str) -> EncryptedPayload:
    """
    Validate and decode base64-encoded AES-GCM-256 ciphertext and IV supplied by the client.
    Raises ValueError if base64 is malformed or IV/ciphertext lengths are invalid.
    """
    try:
        ct = base64.b64decode(ciphertext_b64, validate=True)
        iv = base64.b64decode(iv_b64, validate=True)
    except Exception as exc:
        raise ValueError(f"Invalid base64 encoding for ciphertext or IV: {exc}") from exc

    if len(iv) < 12 or len(iv) > 16:
        raise ValueError("AES-GCM IV must be between 12 and 16 bytes.")
    if len(ct) < 16:
        raise ValueError("AES-GCM ciphertext must include at least the 16-byte authentication tag.")
    return EncryptedPayload(ciphertext=ct, iv=iv)

