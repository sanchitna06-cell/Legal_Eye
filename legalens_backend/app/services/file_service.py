import os
import hashlib
import shutil
from app.core.config import settings

class FileService:
    def __init__(self):
        self.storage_path = settings.STORAGE_PATH
        os.makedirs(self.storage_path, exist_ok=True)
    
    async def save_file(self, file_id: str, file_name: str, content: bytes) -> str:
        """Save a file to disk and return its path."""
        safe_name = f"{file_id}_{file_name.replace(' ', '_')}"
        file_path = os.path.join(self.storage_path, safe_name)
        
        with open(file_path, 'wb') as f:
            f.write(content)
        
        return file_path
    
    async def get_file_hash(self, file_path: str) -> str | None:
        """Calculate SHA-256 hash of a file."""
        if not os.path.exists(file_path):
            return None
        
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                sha256.update(chunk)
        
        return sha256.hexdigest()
    
    async def tamper_file(self, file_path: str) -> bool:
        """Simulate tampering by changing 1 byte in the file."""
        if not os.path.exists(file_path):
            return False
        
        with open(file_path, 'rb+') as f:
            content = f.read()
            if len(content) == 0:
                return False
            # Change the first byte
            modified = bytearray(content)
            modified[0] = modified[0] ^ 0xFF  # Flip bits of first byte
            f.seek(0)
            f.write(bytes(modified))
        
        return True