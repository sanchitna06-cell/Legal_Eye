"""
Normalization helpers for deterministic entity extraction.

Normalization converts extracted values into stable representations
that can be used for deduplication, comparison, and later reconciliation.
"""

from __future__ import annotations

import ipaddress
import re


def normalize_whitespace(value: str) -> str:
    """Collapse repeated whitespace and trim the value."""
    return re.sub(r"\s+", " ", value).strip()


def normalize_email(value: str) -> str:
    """Normalize an email address."""
    return normalize_whitespace(value).lower()


def normalize_phone(value: str) -> str:
    """
    Normalize an Indian phone number.

    Supported forms include:
        9876543210
        98765 43210
        +91 9876543210
        +91-9876543210
        919876543210
    """
    digits = re.sub(r"\D", "", value)

    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]

    if len(digits) == 10:
        return f"+91{digits}"

    return f"+{digits}"


def normalize_aadhaar(value: str) -> str:
    """Return Aadhaar as its 12-digit representation."""
    return re.sub(r"\D", "", value)


def normalize_ip(value: str) -> str:
    """Normalize an IPv4 or IPv6 address using Python's ipaddress module."""
    return str(ipaddress.ip_address(value.strip()))


def normalize_vehicle(value: str) -> str:
    """
    Normalize an Indian vehicle registration number.

    Example:
        DL 01 AB 1234
        DL-01-AB-1234
        dl01ab1234

    becomes:

        DL01AB1234
    """
    return re.sub(r"[\s-]+", "", value).upper()


def normalize_date(year: int, month: int, day: int) -> str:
    """Return a date in ISO format."""
    return f"{year:04d}-{month:02d}-{day:02d}"


def normalize_bank_account(value: str) -> str:
    """Normalize a bank account number to digits only."""
    return re.sub(r"\D", "", value)


def normalize_generic(value: str) -> str:
    """Generic normalization for future deterministic extractors."""
    return normalize_whitespace(value)