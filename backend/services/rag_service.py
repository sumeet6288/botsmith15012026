import logging
from typing import List, Dict, Optional

from .chunking_service import ChunkingService
from .vector_store import VectorStore
from .embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class RAGService:
    """
    Main RAG service.

    Pipeline:
    document -> chunks -> embeddings -> MongoDB
    query -> query embedding -> cosine similarity -> context
    """

    def __init__(self):
        self.chunking_service = ChunkingService(
            chunk_size=600,
            chunk_overlap=100
        )
        self.vector_store = VectorStore()
        self.embedding_service = EmbeddingService()

        self.top_k_results = 2
        self.similarity_threshold = 0.4

        logger.info("Vector RAG Service initialized successfully")

    async def process_document(
        self,
        text: str,
        chatbot_id: str,
        source_id: str,
        source_type: str,
        filename: str = None,
        use_paragraph_chunking: bool = True
    ) -> Dict:
        """Chunk a document, generate embeddings, and store vector chunks."""
        try:
            logger.info(
                "Processing document for chatbot %s, source %s",
                chatbot_id,
                source_id
            )

            metadata = {
                "source_id": source_id,
                "source_type": source_type
            }

            if filename:
                metadata["filename"] = filename

            if use_paragraph_chunking:
                chunks = self.chunking_service.chunk_by_paragraphs(
                    text,
                    metadata
                )
            else:
                chunks = self.chunking_service.chunk_text(
                    text,
                    metadata
                )

            if not chunks:
                logger.warning("No chunks created from document")
                return {
                    "success": False,
                    "error": "No chunks created",
                    "chunks_created": 0
                }

            chunk_stats = self.chunking_service.get_stats(chunks)
            logger.info(
                "Created %s chunks: %s",
                len(chunks),
                chunk_stats
            )

            texts = [chunk.get("text", "") for chunk in chunks]

            # Generate one embedding per chunk.
            embeddings = await self.embedding_service.generate_embeddings_batch(
                texts
            )

            if len(embeddings) != len(chunks):
                raise ValueError(
                    f"Embedding count mismatch: "
                    f"{len(embeddings)} embeddings for {len(chunks)} chunks"
                )

            for index, embedding in enumerate(embeddings):
                if not embedding:
                    raise ValueError(
                        f"Empty embedding generated for chunk {index}"
                    )

            store_result = await self.vector_store.add_chunks(
                chatbot_id=chatbot_id,
                chunks=chunks,
                embeddings=embeddings,
                source_id=source_id,
                source_type=source_type,
                filename=filename
            )

            return {
                "success": True,
                "chunks_created": len(chunks),
                "chunks_stored": store_result.get("chunks_added", 0),
                "total_chunks_in_store": store_result.get(
                    "collection_size",
                    0
                ),
                "chunk_stats": chunk_stats,
                "method": "vector_rag"
            }

        except Exception as e:
            logger.error(
                "Error processing document: %s",
                str(e)
            )
            return {
                "success": False,
                "error": str(e),
                "chunks_created": 0
            }

    async def retrieve_relevant_context(
        self,
        query: str,
        chatbot_id: str,
        top_k: int = None,
        min_similarity: float = None
    ) -> Dict:
        """Generate a query embedding and retrieve similar chunks."""
        try:
            top_k = (
                top_k
                if top_k is not None
                else self.top_k_results
            )
            min_similarity = (
                min_similarity
                if min_similarity is not None
                else self.similarity_threshold
            )

            logger.info(
                "Retrieving vector context for chatbot %s, top_k=%s",
                chatbot_id,
                top_k
            )

            query_embedding = (
                await self.embedding_service.generate_embedding(query)
            )

            if not query_embedding:
                logger.warning("Could not generate query embedding")
                return self._empty_context()

            matches = await self.vector_store.search(
                chatbot_id=chatbot_id,
                query_embedding=query_embedding,
                query=query,
                top_k=top_k,
                min_similarity=min_similarity
            )

            if not matches:
                logger.info("No relevant vector context found")
                return self._empty_context()

            context_parts = []
            citations = []

            for i, match in enumerate(matches):
                text = match["text"]
                metadata = match["metadata"]
                similarity = match["similarity"]

                citation = self._build_citation(
                    metadata,
                    similarity,
                    i + 1
                )
                citations.append(citation)

                context_parts.append(
                    f"[Source {i + 1}]: {text}"
                )

            combined_context = "\n\n".join(context_parts)

            citation_footer = "\n\n" + "\n".join([
                (
                    f"[Source {c['source_number']}]: "
                    f"{c['display_name']} "
                    f"(confidence: {c['confidence']}%)"
                )
                for c in citations
            ])

            return {
                "has_context": True,
                "context": combined_context,
                "citations": citations,
                "citation_footer": citation_footer,
                "num_sources": len(matches),
                "avg_similarity": round(
                    sum(m["similarity"] for m in matches) / len(matches),
                    4
                ),
                "matches": matches
            }

        except Exception as e:
            logger.error(
                "Error retrieving vector context: %s",
                str(e)
            )
            return self._empty_context()

    def _build_citation(
        self,
        metadata: Dict,
        similarity: float,
        source_num: int
    ) -> Dict:
        """Build citation information from metadata."""
        filename = metadata.get("filename", "Unknown source")
        source_type = metadata.get("source_type", "unknown")
        chunk_index = metadata.get("chunk_index", 0)

        if source_type == "file":
            display_name = filename
        elif source_type == "website":
            display_name = "Website content"
        else:
            display_name = "Text content"

        return {
            "source_number": source_num,
            "filename": filename,
            "source_type": source_type,
            "chunk_index": chunk_index,
            "similarity": similarity,
            "confidence": round(similarity * 100, 1),
            "display_name": display_name
        }

    def _empty_context(self) -> Dict:
        """Return empty context structure."""
        return {
            "has_context": False,
            "context": "",
            "citations": [],
            "citation_footer": "",
            "num_sources": 0,
            "avg_similarity": 0,
            "matches": []
        }

    async def delete_source(
        self,
        chatbot_id: str,
        source_id: str
    ) -> Dict:
        """Delete all RAG data for a source."""
        try:
            result = await self.vector_store.delete_source(
                chatbot_id,
                source_id
            )
            logger.info(
                "Deleted source %s from chatbot %s",
                source_id,
                chatbot_id
            )
            return result

        except Exception as e:
            logger.error(
                "Error deleting source: %s",
                str(e)
            )
            return {
                "success": False,
                "error": str(e)
            }

    async def delete_chatbot_data(self, chatbot_id: str) -> bool:
        """Delete all RAG data for a chatbot."""
        try:
            success = await self.vector_store.delete_chatbot_collection(
                chatbot_id
            )

            if success:
                logger.info(
                    "Deleted all RAG data for chatbot %s",
                    chatbot_id
                )

            return success

        except Exception as e:
            logger.error(
                "Error deleting chatbot data: %s",
                str(e)
            )
            return False

    async def get_stats(self, chatbot_id: str) -> Dict:
        """Get RAG statistics for a chatbot."""
        try:
            stats = await self.vector_store.get_collection_stats(
                chatbot_id
            )

            stats.update({
                "config": {
                    "chunk_size": self.chunking_service.chunk_size,
                    "chunk_overlap": self.chunking_service.chunk_overlap,
                    "top_k_results": self.top_k_results,
                    "similarity_threshold": self.similarity_threshold,
                    "embedding_model": self.embedding_service.model,
                    "embedding_dimensions": self.embedding_service.dimensions,
                    "method": "vector_rag"
                }
            })

            return stats

        except Exception as e:
            logger.error(
                "Error getting RAG stats: %s",
                str(e)
            )
            return {"error": str(e)}
