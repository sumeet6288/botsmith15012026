import os
import logging
from typing import List
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating embeddings using OpenAI via Emergent LLM Key."""

    def __init__(self):
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not self.api_key:
            raise Exception("EMERGENT_LLM_KEY not found in environment variables")

        self.client = AsyncOpenAI(api_key=self.api_key)
        self.model = "text-embedding-3-small"
        self.dimensions = 1536

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate one embedding vector."""
        try:
            text = (text or "").strip()
            if not text:
                logger.warning("Empty text provided for embedding")
                return []

            response = await self.client.embeddings.create(
                model=self.model,
                input=text
            )
            embedding = response.data[0].embedding
            logger.info("Generated embedding with %s dimensions", len(embedding))
            return embedding

        except Exception as e:
            logger.error("Error generating embedding: %s", str(e))
            raise Exception(f"Failed to generate embedding: {str(e)}")

    async def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings while preserving one-to-one alignment with `texts`.
        Empty strings receive an empty vector.
        """
        try:
            if not texts:
                return []

            cleaned_texts = [(text or "").strip() for text in texts]
            embeddings: List[List[float]] = [[] for _ in cleaned_texts]

            valid_indices = [
                index for index, text in enumerate(cleaned_texts) if text
            ]

            if not valid_indices:
                logger.warning("No valid texts provided for batch embedding")
                return embeddings

            batch_size = 100

            for start in range(0, len(valid_indices), batch_size):
                batch_indices = valid_indices[start:start + batch_size]
                batch = [cleaned_texts[index] for index in batch_indices]

                response = await self.client.embeddings.create(
                    model=self.model,
                    input=batch
                )

                if len(response.data) != len(batch_indices):
                    raise Exception(
                        "Embedding API returned an unexpected number of embeddings"
                    )

                for index, data in zip(batch_indices, response.data):
                    embeddings[index] = data.embedding

                logger.info(
                    "Generated %s embeddings (batch %s)",
                    len(batch_indices),
                    start // batch_size + 1
                )

            return embeddings

        except Exception as e:
            logger.error("Error generating batch embeddings: %s", str(e))
            raise Exception(f"Failed to generate batch embeddings: {str(e)}")

    def get_model_info(self) -> dict:
        """Get information about the embedding model."""
        return {
            "model": self.model,
            "dimensions": self.dimensions,
            "max_tokens": 8191,
            "cost_per_1k_tokens": 0.00002
        }
