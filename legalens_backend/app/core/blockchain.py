"""
app/core/blockchain.py

PostgreSQL-backed tamper-evident hash chain.

This is not a decentralized blockchain.
It is an internal cryptographic hash chain used
for document integrity verification.
"""

import hashlib
import json
from datetime import datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blockchain_block import BlockchainBlock


class BlockchainService:
    """
    PostgreSQL-backed tamper-evident hash chain.

    The chain is stored in the blockchain_blocks table.
    It is used to provide cryptographic evidence of document
    integrity and detect unauthorized modification.

    This is not a decentralized blockchain.
    """

    # PostgreSQL transaction-level advisory lock.
    #
    # This prevents two simultaneous block insertions
    # from calculating the same latest block.
    ADVISORY_LOCK_KEY = 73918421

    # 64 hexadecimal zero characters.
    # Used as the previous_hash of the genesis block.
    GENESIS_HASH = "0" * 64

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def calculate_hash(block_data: dict[str, Any]) -> str:
        """
        Calculate the SHA-256 hash of a block's contents.

        The hash field itself is excluded because a block
        cannot contain a hash of itself.
        """

        data = block_data.copy()
        data.pop("hash", None)

        block_string = json.dumps(
            data,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )

        return hashlib.sha256(
            block_string.encode("utf-8")
        ).hexdigest()

    async def _acquire_chain_lock(self) -> None:
        """
        Acquire a PostgreSQL transaction-level advisory lock.

        The lock exists only for the current database transaction.
        """

        await self.db.execute(
            text(
                "SELECT pg_advisory_xact_lock(:lock_key)"
            ),
            {
                "lock_key": self.ADVISORY_LOCK_KEY
            },
        )

    async def _get_latest_block(
        self,
    ) -> BlockchainBlock | None:
        """Return the latest block in the chain."""

        result = await self.db.execute(
            select(BlockchainBlock)
            .order_by(BlockchainBlock.block_index.desc())
            .limit(1)
        )

        return result.scalar_one_or_none()

    async def _create_genesis(self) -> BlockchainBlock:
        """
        Create the first block in the chain.

        Genesis is not associated with a document or user.
        """

        timestamp = datetime.utcnow()

        block_data = {
            "block_index": 0,
            "created_at": timestamp.isoformat(),
            "action": "GENESIS",
            "document_id": None,
            "document_hash": None,
            "previous_hash": self.GENESIS_HASH,
            "user_id": None,
            "metadata": {},
        }

        block_hash = self.calculate_hash(block_data)

        genesis = BlockchainBlock(
            block_index=0,
            created_at=timestamp,
            action="GENESIS",
            document_id=None,
            document_hash=None,
            previous_hash=self.GENESIS_HASH,
            hash=block_hash,
            user_id=None,
            block_metadata={},
        )

        self.db.add(genesis)

        await self.db.flush()

        return genesis

    async def add_block(
        self,
        action: str,
        document_id: str | None,
        document_hash: str | None,
        user_id: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> BlockchainBlock:
        """
        Append a new block to the hash chain.

        The operation is protected by a PostgreSQL
        transaction-level advisory lock so concurrent
        uploads cannot append based on the same previous block.
        """

        # Prevent concurrent chain modifications.
        await self._acquire_chain_lock()

        # Find the current end of the chain.
        previous_block = await self._get_latest_block()

        # Create genesis if this is the first block.
        if previous_block is None:
            previous_block = await self._create_genesis()

        block_index = previous_block.block_index + 1

        timestamp = datetime.utcnow()

        block_data = {
            "block_index": block_index,
            "created_at": timestamp.isoformat(),
            "action": action,
            "document_id": document_id,
            "document_hash": document_hash,
            "previous_hash": previous_block.hash,
            "user_id": user_id,
            "metadata": metadata or {},
        }

        block_hash = self.calculate_hash(block_data)

        block = BlockchainBlock(
            block_index=block_index,
            created_at=timestamp,
            action=action,
            document_id=document_id,
            document_hash=document_hash,
            previous_hash=previous_block.hash,
            hash=block_hash,
            user_id=user_id,
            block_metadata=metadata or {},
        )

        self.db.add(block)

        await self.db.flush()

        return block

    async def verify_document(
        self,
        document_id: str,
        current_hash: str,
    ) -> dict[str, Any]:
        """
        Verify a document against its original UPLOAD block.

        The first UPLOAD block for the document is treated
        as the canonical integrity anchor.
        """

        result = await self.db.execute(
            select(BlockchainBlock)
            .where(
                BlockchainBlock.document_id == document_id,
                BlockchainBlock.action == "UPLOAD",
            )
            .order_by(BlockchainBlock.block_index.asc())
            .limit(1)
        )

        block = result.scalar_one_or_none()

        # No blockchain anchor exists yet.
        if block is None:
            return {
                "status": "PENDING",
                "document_id": document_id,
                "message": (
                    "No blockchain anchor found "
                    "for this document."
                ),
            }

        # Current file matches the canonical hash.
        if current_hash == block.document_hash:
            return {
                "status": "VERIFIED",
                "document_id": document_id,
                "block_index": block.block_index,
                "message": "Document integrity verified.",
            }

        # Current file differs from the canonical hash.
        return {
            "status": "TAMPERED",
            "document_id": document_id,
            "block_index": block.block_index,
            "message": (
                "Document hash does not match "
                "the anchored hash."
            ),
        }

    async def verify_chain_integrity(self) -> bool:
        """
        Verify the cryptographic links between every block.

        This checks:

        1. Genesis is block 0.
        2. Genesis points to the zero hash.
        3. Genesis's own hash is correct.
        4. Block indexes are sequential.
        5. Every block points to the previous block.
        6. Every block's own hash is correct.
        """

        result = await self.db.execute(
            select(BlockchainBlock)
            .order_by(BlockchainBlock.block_index.asc())
        )

        blocks = result.scalars().all()

        # An empty chain is considered valid.
        if not blocks:
            return True

        # ---------------------------------------------------------
        # 1. Verify genesis block
        # ---------------------------------------------------------

        genesis = blocks[0]

        if genesis.block_index != 0:
            return False

        if genesis.previous_hash != self.GENESIS_HASH:
            return False

        genesis_data = {
            "block_index": genesis.block_index,
            "created_at": genesis.created_at.isoformat(),
            "action": genesis.action,
            "document_id": genesis.document_id,
            "document_hash": genesis.document_hash,
            "previous_hash": genesis.previous_hash,
            "user_id": genesis.user_id,
            "metadata": genesis.block_metadata or {},
        }

        calculated_genesis_hash = self.calculate_hash(
            genesis_data
        )

        if genesis.hash != calculated_genesis_hash:
            return False

        # ---------------------------------------------------------
        # 2. Verify every subsequent block
        # ---------------------------------------------------------

        for i in range(1, len(blocks)):
            current = blocks[i]
            previous = blocks[i - 1]

            # Block numbering must remain sequential.
            if current.block_index != previous.block_index + 1:
                return False

            # Current block must point to the previous block.
            if current.previous_hash != previous.hash:
                return False

            # Recalculate current block's hash.
            block_data = {
                "block_index": current.block_index,
                "created_at": current.created_at.isoformat(),
                "action": current.action,
                "document_id": current.document_id,
                "document_hash": current.document_hash,
                "previous_hash": current.previous_hash,
                "user_id": current.user_id,
                "metadata": current.block_metadata or {},
            }

            calculated_hash = self.calculate_hash(
                block_data
            )

            if current.hash != calculated_hash:
                return False

        return True

    async def get_chain(
        self,
    ) -> list[BlockchainBlock]:
        """Return the complete blockchain in chronological order."""

        result = await self.db.execute(
            select(BlockchainBlock)
            .order_by(BlockchainBlock.block_index.asc())
        )

        return list(result.scalars().all())

    async def get_blocks_for_document(
        self,
        document_id: str,
    ) -> list[BlockchainBlock]:
        """Return all blockchain blocks associated with a document."""

        result = await self.db.execute(
            select(BlockchainBlock)
            .where(
                BlockchainBlock.document_id == document_id
            )
            .order_by(BlockchainBlock.block_index.asc())
        )

        return list(result.scalars().all())