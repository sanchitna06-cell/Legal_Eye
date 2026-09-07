from app.models.document_integrity import DocumentIntegrity
from app.models.blockchain_block import BlockchainBlock


print("DocumentIntegrity mapper:")
print(DocumentIntegrity.__mapper__)

print("\nBlockchainBlock mapper:")
print(BlockchainBlock.__mapper__)

print("\nRelationships:")
for relationship in DocumentIntegrity.__mapper__.relationships:
    print(
        f"{relationship.key} -> "
        f"{relationship.mapper.class_.__name__}"
    )