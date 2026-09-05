from app.core.blockchain import blockchain
from app.core.contracts import DocumentUploadedPayload
from app.core.database import AsyncSessionLocal
from app.models.document import Document


async def handle_document_uploaded(payload: DocumentUploadedPayload):
    print(f"🔗 Adding blockchain block for: {payload.document_id}")

    block = blockchain.add_block(
        action="UPLOAD",
        document_id=payload.document_id,
        document_hash=payload.sha256_hash,
        user_id=payload.uploaded_by,
        metadata={
            "case_id": payload.case_id,
            "file_name": payload.file_name,
        },
    )

    async with AsyncSessionLocal() as db:
        document = await db.get(Document, payload.document_id)

        if document is None:
            raise RuntimeError(
                f"Document {payload.document_id} not found while "
                "recording blockchain block."
            )

        document.blockchain_block_id = block["index"]

        await db.commit()

    print(
        f"✅ Block added: #{block['index']} "
        f"for {payload.document_id}"
    )