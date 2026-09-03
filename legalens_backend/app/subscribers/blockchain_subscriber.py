"""
app/subscribers/blockchain_subscriber.py
---------------------------------------
Listens for document.uploaded events and adds a blockchain block.
"""

from app.core.blockchain import blockchain
from app.core.contracts import DocumentUploadedPayload

async def handle_document_uploaded(payload: DocumentUploadedPayload):
    """Add a block to the blockchain when a document is uploaded."""
    print(f"🔗 Adding blockchain block for: {payload.document_id}")
    
    block = blockchain.add_block(
        action="UPLOAD",
        document_id=payload.document_id,
        document_hash=payload.sha256_hash,
        user_id=payload.uploaded_by,
        metadata={"case_id": payload.case_id, "file_name": payload.file_name}
    )
    
    print(f"✅ Block added: #{block['index']} for {payload.document_id}")