"""
app/subscribers/entity_extractor.py
-----------------------------------
Listens for text.extracted events and runs NER to find entities.
"""

from app.core.event_bus import event_bus
from app.core.contracts import TextExtractedPayload, EntityExtractedPayload
from app.core.contracts import EntityType

async def handle_text_extracted(payload: TextExtractedPayload):
    """Extract entities from text using AI."""
    print(f"🔍 Extracting entities from document: {payload.document_id}")
    
    # Simulate NER extraction
    # In production, use spaCy: nlp = spacy.load("en_core_web_sm")
    sample_entities = [
        {"entity_type": EntityType.PERSON.value, "value": "Vikram Singh", "confidence_score": 0.96},
        {"entity_type": EntityType.PHONE.value, "value": "+91 98765 43210", "confidence_score": 0.92},
        {"entity_type": EntityType.VEHICLE.value, "value": "DL-03-CA-1234", "confidence_score": 0.89},
        {"entity_type": EntityType.LOCATION.value, "value": "Sector 22, Noida", "confidence_score": 0.94},
    ]
    
    await event_bus.publish(
        "entity.extracted",
        EntityExtractedPayload(
            document_id=payload.document_id,
            case_id="CASE-2026-0142",  # Should be retrieved from DB
            entities=sample_entities
        )
    )
    
    print(f"✅ Extracted {len(sample_entities)} entities from document: {payload.document_id}")