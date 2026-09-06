from app.core.database import Base

# Import the models so SQLAlchemy registers them
from app.models.user import User
from app.models.case import Case
from app.models.document import Document
from app.models.case_file_page import CaseFilePage
from app.models.entity import Entity
from app.models.audit_log import AuditLog


print("Registered tables:")
for table in Base.metadata.tables.values():
    print(f" - {table.name}")

print("\nCaseFilePage columns:")
for column in CaseFilePage.__table__.columns:
    print(f" - {column.name}")

print("\nDocument relationships:")
for relationship in Document.__mapper__.relationships:
    print(f" - {relationship.key}")

print("\nCaseFilePage relationships:")
for relationship in CaseFilePage.__mapper__.relationships:
    print(f" - {relationship.key}")

print("\nORM model mapping successful.")
