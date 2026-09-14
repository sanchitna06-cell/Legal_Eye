"""
Deterministic entity extraction.

This module performs local, rule-based extraction from page-level text.

It deliberately does NOT:
- call n8n
- call an AI model
- modify processing jobs
- publish events
- access the database

The subscriber layer is responsible for persistence and event handling.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import ipaddress
import re

from app.core.contracts import EntityType

from .normalization import (
    normalize_aadhaar,
    normalize_bank_account,
    normalize_date,
    normalize_email,
    normalize_ip,
    normalize_phone,
    normalize_vehicle,
)


@dataclass(frozen=True)
class DeterministicEntityCandidate:
    """A deterministic entity found in a single page."""

    entity_type: EntityType
    value: str
    confidence: float
    normalized_value: str
    context_snippet: str


# ---------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------

EMAIL_PATTERN = re.compile(
    r"(?<![\w.+-])"
    r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+"
    r"@"
    r"[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+"
    r"(?![\w-])"
)

PHONE_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?:\+91[\s.-]?)?"
    r"(?:[6-9]\d{4}[\s.-]?\d{5})"
    r"(?!\d)"
)

AADHAAR_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?:\d{4}[\s-]?){2}\d{4}"
    r"(?!\d)"
)

IP_PATTERN = re.compile(
    r"(?<![\w.])"
    r"(?:"
    r"(?:\d{1,3}\.){3}\d{1,3}"
    r"|"
    r"(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}"
    r")"
    r"(?![\w.])"
)

VEHICLE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])"
    r"[A-Za-z]{2}"
    r"[\s-]*"
    r"\d{1,2}"
    r"[\s-]*"
    r"[A-Za-z]{1,3}"
    r"[\s-]*"
    r"\d{4}"
    r"(?![A-Za-z0-9])"
)

DATE_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?P<day>\d{1,2})"
    r"(?P<separator>[./-])"
    r"(?P<month>\d{1,2})"
    r"(?P=separator)"
    r"(?P<year>\d{4})"
    r"(?!\d)"
)

BANK_ACCOUNT_PATTERN = re.compile(
    r"(?i)"
    r"(?:"
    r"(?:account|a/c|acct)"
    r"(?:\s*(?:number|no\.?|#))?"
    r"\s*[:=-]?\s*"
    r")"
    r"(?P<number>\d{9,18})"
)


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def _context_snippet(
    text: str,
    start: int,
    end: int,
    radius: int = 90,
    maximum: int = 200,
) -> str:
    """Return bounded text surrounding an extracted entity."""
    context_start = max(0, start - radius)
    context_end = min(len(text), end + radius)

    snippet = text[context_start:context_end]
    snippet = re.sub(r"\s+", " ", snippet).strip()

    if len(snippet) <= maximum:
        return snippet

    relative_start = start - context_start
    half = maximum // 2

    left = max(0, relative_start - half)
    right = min(len(snippet), relative_start + half)

    snippet = snippet[left:right].strip()

    if left > 0:
        snippet = "..." + snippet

    if right < len(text):
        snippet = snippet + "..."

    return snippet[:maximum]


def _valid_aadhaar(number: str) -> bool:
    """
    Validate an Aadhaar candidate using the Verhoeff checksum.

    This does not establish that an Aadhaar number actually belongs
    to a person. It only validates the mathematical checksum.
    """
    digits = [int(digit) for digit in number]

    multiplication_table = (
        (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
        (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
        (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
        (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
        (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
        (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
        (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
        (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
        (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
        (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
    )

    permutation_table = (
        (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
        (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
        (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
        (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
        (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
        (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
        (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
        (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
    )

    checksum = 0

    for position, digit in enumerate(reversed(digits)):
        permutation = permutation_table[position % 8][digit]
        checksum = multiplication_table[checksum][permutation]

    return checksum == 0


def _add_candidate(
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
    *,
    entity_type: EntityType,
    value: str,
    confidence: float,
    normalized_value: str,
    context_snippet: str,
) -> None:
    """Add a candidate unless the normalized entity already exists."""
    key = (entity_type, normalized_value)

    if key in seen:
        return

    seen.add(key)

    candidates.append(
        DeterministicEntityCandidate(
            entity_type=entity_type,
            value=value,
            confidence=confidence,
            normalized_value=normalized_value,
            context_snippet=context_snippet,
        )
    )


# ---------------------------------------------------------------------
# Extractors
# ---------------------------------------------------------------------

def _extract_emails(
    text: str,
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
) -> None:
    for match in EMAIL_PATTERN.finditer(text):
        value = match.group(0)
        normalized = normalize_email(value)

        _add_candidate(
            candidates,
            seen,
            entity_type=EntityType.EMAIL,
            value=value,
            confidence=0.98,
            normalized_value=normalized,
            context_snippet=_context_snippet(
                text,
                match.start(),
                match.end(),
            ),
        )


def _extract_phones(
    text: str,
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
) -> None:
    for match in PHONE_PATTERN.finditer(text):
        value = match.group(0)
        normalized = normalize_phone(value)

        digits = re.sub(r"\D", "", value)

        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]

        if len(digits) != 10 or digits[0] not in "6789":
            continue

        _add_candidate(
            candidates,
            seen,
            entity_type=EntityType.PHONE,
            value=value,
            confidence=0.96,
            normalized_value=normalized,
            context_snippet=_context_snippet(
                text,
                match.start(),
                match.end(),
            ),
        )


def _extract_aadhaars(
    text: str,
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
) -> None:
    for match in AADHAAR_PATTERN.finditer(text):
        value = match.group(0)
        normalized = normalize_aadhaar(value)

        if len(normalized) != 12:
            continue

        if not _valid_aadhaar(normalized):
            continue

        _add_candidate(
            candidates,
            seen,
            entity_type=EntityType.AADHAAR,
            value=value,
            confidence=0.99,
            normalized_value=normalized,
            context_snippet=_context_snippet(
                text,
                match.start(),
                match.end(),
            ),
        )


def _extract_ips(
    text: str,
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
) -> None:
    for match in IP_PATTERN.finditer(text):
        value = match.group(0)

        try:
            normalized = normalize_ip(value)
        except ValueError:
            continue

        _add_candidate(
            candidates,
            seen,
            entity_type=EntityType.IP_ADDRESS,
            value=value,
            confidence=0.99,
            normalized_value=normalized,
            context_snippet=_context_snippet(
                text,
                match.start(),
                match.end(),
            ),
        )


def _extract_vehicles(
    text: str,
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
) -> None:
    for match in VEHICLE_PATTERN.finditer(text):
        value = match.group(0)
        normalized = normalize_vehicle(value)

        # Basic sanity checks.
        if len(normalized) < 9 or len(normalized) > 12:
            continue

        _add_candidate(
            candidates,
            seen,
            entity_type=EntityType.VEHICLE,
            value=value,
            confidence=0.95,
            normalized_value=normalized,
            context_snippet=_context_snippet(
                text,
                match.start(),
                match.end(),
            ),
        )


def _extract_dates(
    text: str,
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
) -> None:
    for match in DATE_PATTERN.finditer(text):
        day = int(match.group("day"))
        month = int(match.group("month"))
        year = int(match.group("year"))

        try:
            datetime(year, month, day)
        except ValueError:
            continue

        value = match.group(0)
        normalized = normalize_date(year, month, day)

        _add_candidate(
            candidates,
            seen,
            entity_type=EntityType.DATE,
            value=value,
            confidence=0.94,
            normalized_value=normalized,
            context_snippet=_context_snippet(
                text,
                match.start(),
                match.end(),
            ),
        )


def _extract_bank_accounts(
    text: str,
    candidates: list[DeterministicEntityCandidate],
    seen: set[tuple[EntityType, str]],
) -> None:
    for match in BANK_ACCOUNT_PATTERN.finditer(text):
        number = match.group("number")
        normalized = normalize_bank_account(number)

        # Avoid classifying Aadhaar-like values as bank accounts.
        if len(normalized) == 12:
            continue

        _add_candidate(
            candidates,
            seen,
            entity_type=EntityType.BANK_ACCOUNT,
            value=number,
            confidence=0.88,
            normalized_value=normalized,
            context_snippet=_context_snippet(
                text,
                match.start(),
                match.end(),
            ),
        )


# ---------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------

def extract_page_entities(
    text: str,
) -> list[DeterministicEntityCandidate]:
    """
    Extract deterministic entities from one page.

    The caller is responsible for supplying exactly one page of text.
    """
    if not text or not text.strip():
        return []

    candidates: list[DeterministicEntityCandidate] = []
    seen: set[tuple[EntityType, str]] = set()

    _extract_emails(text, candidates, seen)
    _extract_phones(text, candidates, seen)
    _extract_aadhaars(text, candidates, seen)
    _extract_ips(text, candidates, seen)
    _extract_vehicles(text, candidates, seen)
    _extract_dates(text, candidates, seen)
    _extract_bank_accounts(text, candidates, seen)

    return candidates