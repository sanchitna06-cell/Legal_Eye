"""
app/core/blockchain.py
----------------------
The custom Blockchain for tamper-proof evidence logging.
Stores a chain of blocks as a JSON file.
"""

import json
import hashlib
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.core.config import settings

BLOCKCHAIN_PATH = os.path.join(settings.STORAGE_PATH, "blockchain.json")

class Blockchain:
    """Simple blockchain implementation for evidence integrity."""
    
    def __init__(self, chain_path: str = BLOCKCHAIN_PATH):
        self.chain_path = chain_path
        self.chain = self._load_or_create()
    
    def _load_or_create(self) -> List[Dict[str, Any]]:
        """Load chain from disk or create genesis block."""
        if os.path.exists(self.chain_path):
            try:
                with open(self.chain_path, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return self._create_genesis()
        return self._create_genesis()
    
    def _create_genesis(self) -> List[Dict[str, Any]]:
        """Create the genesis block."""
        genesis = {
            "index": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": "GENESIS",
            "document_id": "GENESIS",
            "document_hash": "0" * 64,
            "user_id": "SYSTEM",
            "previous_hash": "0" * 64,
            "hash": hashlib.sha256(b"genesis_block").hexdigest(),
            "metadata": {}
        }
        return [genesis]
    
    def _save(self):
        """Persist chain to disk."""
        with open(self.chain_path, 'w') as f:
            json.dump(self.chain, f, indent=2)
    
    def _calculate_hash(self, block: Dict[str, Any]) -> str:
        """Calculate SHA-256 hash of a block."""
        block_copy = block.copy()
        block_copy.pop("hash", None)  # Remove hash before calculating
        # Ensure consistent string serialization
        block_string = json.dumps(block_copy, sort_keys=True)
        return hashlib.sha256(block_string.encode()).hexdigest()
    
    def add_block(self, action: str, document_id: str, document_hash: str, user_id: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """Add a new block to the chain."""
        previous_block = self.chain[-1]
        index = previous_block["index"] + 1
        
        block = {
            "index": index,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "document_id": document_id,
            "document_hash": document_hash,
            "user_id": user_id,
            "previous_hash": previous_block["hash"],
            "hash": "",  # Will be filled below
            "metadata": metadata or {}
        }
        
        block["hash"] = self._calculate_hash(block)
        self.chain.append(block)
        self._save()
        return block
    
    def verify_document(self, document_id: str, current_hash: str) -> Dict[str, Any]:
        """
        Verify a document's integrity by comparing its current hash
        against the hash stored in the blockchain.
        """
        # Find the latest block for this document (search backwards)
        for block in reversed(self.chain):
            if block["document_id"] == document_id:
                stored_hash = block["document_hash"]
                block_number = block["index"]
                
                if current_hash == stored_hash:
                    return {
                        "verified": True,
                        "status": "VERIFIED",
                        "block_number": block_number,
                        "stored_hash": stored_hash,
                    }
                else:
                    return {
                        "verified": False,
                        "status": "TAMPERED",
                        "block_number": block_number,
                        "stored_hash": stored_hash,
                        "current_hash": current_hash,
                    }
        
        # No block found for this document
        return {
            "verified": False,
            "status": "PENDING",
            "block_number": None,
            "stored_hash": None,
        }
    
    def verify_chain_integrity(self) -> bool:
        """Verify that the entire chain is intact (no tampering)."""
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]
            
            # Check if hash matches
            if current["previous_hash"] != previous["hash"]:
                print(f"❌ Chain broken at block {i}")
                return False
            
            # Check if block's own hash is valid
            if current["hash"] != self._calculate_hash(current):
                print(f"❌ Block {i} hash mismatch")
                return False
        
        return True
    
    def get_chain(self) -> List[Dict[str, Any]]:
        """Return the full chain."""
        return self.chain
    
    def get_blocks_for_document(self, document_id: str) -> List[Dict[str, Any]]:
        """Get all blocks related to a specific document."""
        return [b for b in self.chain if b["document_id"] == document_id]

# Singleton instance
blockchain = Blockchain()

print(f"🔗 Blockchain initialized with {len(blockchain.chain)} blocks at {BLOCKCHAIN_PATH}")