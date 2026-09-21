import logging
from typing import List, Dict, Optional
import os
import math
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import TEXT

logger = logging.getLogger(__name__)


class VectorStore:
    """
    MongoDB-backed vector store.

    Vectors are stored directly in MongoDB and cosine similarity is calculated
    in Python. This does not require MongoDB Atlas Vector Search.
    """

    def __init__(self):
        try:
            mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
            db_name = os.environ.get("DB_NAME", "botsmith")

            self.client = AsyncIOMotorClient(mongo_url)
            self.db = self.client[db_name]
            self.chunks_collection = self.db["document_chunks"]

            logger.info(
                "MongoDB VectorStore initialized with database: %s",
                db_name
            )

        except Exception as e:
            logger.error("Error initializing MongoDB VectorStore: %s", str(e))
            raise Exception(f"Failed to initialize vector store: {str(e)}")

    async def ensure_text_index(self, chatbot_id: str):
        """Ensure useful indexes exist."""
        try:
            await self.chunks_collection.create_index([("text", TEXT)])
            await self.chunks_collection.create_index([("chatbot_id", 1)])
            await self.chunks_collection.create_index([("source_id", 1)])
            await self.chunks_collection.create_index([("chatbot_id", 1), ("embedding_model", 1)])
            logger.info("Indexes ensured for chatbot %s", chatbot_id)
        except Exception as e:
            logger.warning("Index may already exist: %s", str(e))

    def get_or_create_collection(self, chatbot_id: str):
        """Compatibility method retained for existing callers."""
        return {
            "chatbot_id": chatbot_id,
            "collection_name": f"chatbot_{chatbot_id}"
        }

    async def add_chunks(
        self,
        chatbot_id: str,
        chunks: List[Dict],
        embeddings: List[List[float]] = None,
        source_id: str = None,
        source_type: str = None,
        filename: str = None
    ) -> Dict:
        """Store chunks together with their embedding vectors."""
        try:
            await self.ensure_text_index(chatbot_id)

            if embeddings is None:
                raise ValueError("Embeddings are required for vector RAG")

            if len(chunks) != len(embeddings):
                raise ValueError(
                    f"Chunk/embedding count mismatch: "
                    f"{len(chunks)} chunks vs {len(embeddings)} embeddings"
                )

            documents = []

            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                if not chunk.get("text", "").strip():
                    continue

                if not embedding:
                    raise ValueError(
                        f"Missing embedding for chunk index {i}"
                    )

                chunk_id = f"{source_id}_chunk_{i}"

                doc = {
                    "chunk_id": chunk_id,
                    "chatbot_id": chatbot_id,
                    "source_id": source_id,
                    "source_type": source_type,
                    "text": chunk["text"],
                    "chunk_index": chunk.get("chunk_index", i),
                    "token_count": chunk.get("token_count", 0),
                    "embedding": embedding,
                    "embedding_model": "text-embedding-3-small",
                    "embedding_dimensions": len(embedding)
                }

                if filename:
                    doc["filename"] = filename

                if "page" in chunk:
                    doc["page"] = chunk["page"]

                documents.append(doc)

            if documents:
                result = await self.chunks_collection.insert_many(documents)
                inserted_count = len(result.inserted_ids)
            else:
                inserted_count = 0

            total_count = await self.chunks_collection.count_documents(
                {"chatbot_id": chatbot_id}
            )

            logger.info(
                "Added %s vector chunks to MongoDB for chatbot %s",
                inserted_count,
                chatbot_id
            )

            return {
                "success": True,
                "chunks_added": inserted_count,
                "collection_size": total_count
            }

        except Exception as e:
            logger.error("Error adding chunks to MongoDB: %s", str(e))
            raise Exception(f"Failed to add chunks: {str(e)}")

    @staticmethod
    def _cosine_similarity(
        vector_a: List[float],
        vector_b: List[float]
    ) -> float:
        """Calculate cosine similarity between two vectors."""
        if not vector_a or not vector_b:
            return 0.0

        if len(vector_a) != len(vector_b):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vector_a, vector_b))
        magnitude_a = math.sqrt(sum(a * a for a in vector_a))
        magnitude_b = math.sqrt(sum(b * b for b in vector_b))

        if magnitude_a == 0.0 or magnitude_b == 0.0:
            return 0.0

        return dot_product / (magnitude_a * magnitude_b)

    async def search(
        self,
        chatbot_id: str,
        query_embedding: List[float] = None,
        query: str = None,
        top_k: int = 5,
        min_similarity: float = 0.0
    ) -> List[Dict]:
        """
        Search using cosine similarity over stored embedding vectors.

        The query text remains in the signature for compatibility, but vector
        similarity is the retrieval mechanism.
        """
        try:
            if not query_embedding:
                logger.warning("No query embedding provided for vector search")
                return []

            cursor = self.chunks_collection.find({
                "chatbot_id": chatbot_id,
                "embedding": {"$exists": True}
            })

            chunks = await cursor.to_list(length=None)

            if not chunks:
                logger.info(
                    "No embedded chunks found for chatbot %s",
                    chatbot_id
                )
                return []

            scored_chunks = []

            for chunk in chunks:
                embedding = chunk.get("embedding")

                if not isinstance(embedding, list) or not embedding:
                    continue

                similarity = self._cosine_similarity(
                    query_embedding,
                    embedding
                )

                if similarity >= min_similarity:
                    scored_chunks.append({
                        "chunk": chunk,
                        "similarity": similarity
                    })

            scored_chunks.sort(
                key=lambda item: item["similarity"],
                reverse=True
            )

            top_chunks = scored_chunks[:top_k]

            matches = []

            for rank, item in enumerate(top_chunks, start=1):
                chunk = item["chunk"]

                matches.append({
                    "text": chunk["text"],
                    "metadata": {
                        "source_id": chunk.get("source_id"),
                        "source_type": chunk.get("source_type"),
                        "chunk_index": chunk.get("chunk_index", 0),
                        "token_count": chunk.get("token_count", 0),
                        "filename": chunk.get("filename"),
                        "page": chunk.get("page")
                    },
                    "similarity": round(item["similarity"], 4),
                    "rank": rank
                })

            logger.info(
                "Found %s vector matches above %.3f similarity for chatbot %s",
                len(matches),
                min_similarity,
                chatbot_id
            )

            return matches

        except Exception as e:
            logger.error("Error searching MongoDB vector store: %s", str(e))
            return []

    async def delete_source(self, chatbot_id: str, source_id: str) -> Dict:
        """Delete all chunks associated with a source."""
        try:
            result = await self.chunks_collection.delete_many({
                "chatbot_id": chatbot_id,
                "source_id": source_id
            })

            deleted_count = result.deleted_count

            total_count = await self.chunks_collection.count_documents({
                "chatbot_id": chatbot_id
            })

            logger.info(
                "Deleted %s chunks for source %s",
                deleted_count,
                source_id
            )

            return {
                "success": True,
                "chunks_deleted": deleted_count,
                "collection_size": total_count
            }

        except Exception as e:
            logger.error(
                "Error deleting source from MongoDB: %s",
                str(e)
            )
            raise Exception(f"Failed to delete source: {str(e)}")

    async def delete_chatbot_collection(self, chatbot_id: str) -> bool:
        """Delete all chunks for a chatbot."""
        try:
            result = await self.chunks_collection.delete_many({
                "chatbot_id": chatbot_id
            })

            logger.info(
                "Deleted %s chunks for chatbot %s",
                result.deleted_count,
                chatbot_id
            )
            return True

        except Exception as e:
            logger.error(
                "Error deleting chatbot collection: %s",
                str(e)
            )
            return False

    async def get_collection_stats(self, chatbot_id: str) -> Dict:
        """Get statistics about a chatbot's stored chunks."""
        try:
            total_chunks = await self.chunks_collection.count_documents({
                "chatbot_id": chatbot_id
            })

            vector_chunks = await self.chunks_collection.count_documents({
                "chatbot_id": chatbot_id,
                "embedding": {"$exists": True}
            })

            return {
                "total_chunks": total_chunks,
                "vector_chunks": vector_chunks,
                "collection_name": f"chatbot_{chatbot_id}",
                "metadata": {"chatbot_id": chatbot_id}
            }

        except Exception as e:
            logger.error(
                "Error getting collection stats: %s",
                str(e)
            )
            return {
                "total_chunks": 0,
                "vector_chunks": 0,
                "error": str(e)
            }
