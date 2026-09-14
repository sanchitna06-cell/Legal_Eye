from app.core.contracts import EntityType
from app.services.entity_extraction.deterministic import (
    extract_page_entities,
)


def test_extract_email():
    text = "Contact officer at Test.User@Example.COM for further details."

    entities = extract_page_entities(text)

    assert len(entities) == 1
    assert entities[0].entity_type == EntityType.EMAIL
    assert entities[0].value == "Test.User@Example.COM"
    assert entities[0].normalized_value == "test.user@example.com"


def test_extract_phone():
    text = "The contact number is +91-98765-43210."

    entities = extract_page_entities(text)

    assert len(entities) == 1
    assert entities[0].entity_type == EntityType.PHONE
    assert entities[0].normalized_value == "+919876543210"


def test_extract_invalid_ip_is_ignored():
    text = "Server address is 999.999.999.999."

    entities = extract_page_entities(text)

    assert not any(
        entity.entity_type == EntityType.IP_ADDRESS
        for entity in entities
    )


def test_extract_vehicle():
    text = "Vehicle registration: DL 01 AB 1234."

    entities = extract_page_entities(text)

    vehicle_entities = [
        entity
        for entity in entities
        if entity.entity_type == EntityType.VEHICLE
    ]

    assert len(vehicle_entities) == 1
    assert vehicle_entities[0].normalized_value == "DL01AB1234"


def test_extract_date():
    text = "The incident occurred on 15/08/2025."

    entities = extract_page_entities(text)

    date_entities = [
        entity
        for entity in entities
        if entity.entity_type == EntityType.DATE
    ]

    assert len(date_entities) == 1
    assert date_entities[0].normalized_value == "2025-08-15"


def test_extract_bank_account_with_context():
    text = "Bank Account Number: 1234567890123456."

    entities = extract_page_entities(text)

    bank_entities = [
        entity
        for entity in entities
        if entity.entity_type == EntityType.BANK_ACCOUNT
    ]

    assert len(bank_entities) == 1
    assert bank_entities[0].normalized_value == "1234567890123456"


def test_duplicate_entities_are_removed():
    text = """
    Email: person@example.com
    Please contact person@example.com again.
    """

    entities = extract_page_entities(text)

    email_entities = [
        entity
        for entity in entities
        if entity.entity_type == EntityType.EMAIL
    ]

    assert len(email_entities) == 1
def test_extract_email_with_trailing_punctuation():
    text = "Contact: test@example.com. Please contact us."

    entities = extract_page_entities(text)

    email_entities = [
        entity
        for entity in entities
        if entity.entity_type == EntityType.EMAIL
    ]

    assert len(email_entities) == 1
    assert email_entities[0].value == "test@example.com"
    assert email_entities[0].normalized_value == "test@example.com"