import requests
from bs4 import BeautifulSoup, Comment, Tag
import logging
import re

logger = logging.getLogger(__name__)

MAX_CONTENT_BYTES = 4 * 1024 * 1024  # 4MB safety cap


# ---------------------------------------------------------------------------
# WebsiteScraper
# ---------------------------------------------------------------------------

class WebsiteScraper:
    """Semantic website scraper optimized for RAG ingestion."""

    @staticmethod
    def scrape_url(url: str, timeout: int = 30) -> str:
        """
        Scrape and extract structured text content from a URL.

        Returns:
            Clean semantic plain text (headings + paragraphs preserved)
        """
        try:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                )
            }

            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()

            if len(response.content) > MAX_CONTENT_BYTES:
                raise Exception("Page too large to process")

            soup = BeautifulSoup(response.content, "html.parser")

            # Remove layout noise
            for tag in soup(["script", "style", "nav", "footer",
                             "header", "aside", "noscript"]):
                tag.decompose()

            # Remove HTML comments
            for comment in soup.find_all(
                string=lambda t: isinstance(t, Comment)
            ):
                comment.extract()

            # Prefer semantic content containers
            root = (
                soup.find("article")
                or soup.find("main")
                or soup.find("section")
                or soup.body
                or soup
            )

            lines = []

            for element in root.descendants:
                if not isinstance(element, Tag):
                    continue

                if element.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                    text = element.get_text(strip=True)
                    if text:
                        lines.append(f"\n## {text}\n")

                elif element.name == "p":
                    text = element.get_text(strip=True)
                    if text:
                        lines.append(text)

                elif element.name == "li":
                    text = element.get_text(strip=True)
                    if text:
                        lines.append(f"- {text}")

            text = WebsiteScraper._clean_text(lines)

            if not text:
                raise Exception("No content extracted from URL")

            return text

        except requests.RequestException as e:
            logger.error(f"Error scraping URL {url}: {str(e)}")
            raise Exception(f"Failed to scrape website: {str(e)}")

        except Exception as e:
            logger.error(f"Error processing website content: {str(e)}")
            raise Exception(f"Failed to process website content: {str(e)}")

    @staticmethod
    def validate_url(url: str) -> bool:
        try:
            response = requests.head(url, timeout=5)
            return response.status_code < 400
        except:
            return False

    @staticmethod
    def _clean_text(lines: list[str]) -> str:
        cleaned = []
        seen = set()

        for line in lines:
            line = re.sub(r"\s+", " ", line.strip())

            if len(line) < 5:
                continue

            key = line.lower()
            if key in seen:
                continue

            seen.add(key)
            cleaned.append(line)

        return "\n".join(cleaned).strip()


# ---------------------------------------------------------------------------
# ChunkingService
# ---------------------------------------------------------------------------

class ChunkingService:
    """
    Paragraph-aware chunker optimized for vector embeddings.
    """

    DEFAULT_CHUNK_SIZE = 900
    DEFAULT_OVERLAP = 120
    MIN_CHUNK_LENGTH = 60

    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_OVERLAP
    ) -> list[str]:

        if not text or not text.strip():
            return []

        paragraphs = re.split(r"\n{2,}", text)

        chunks = []
        current = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If paragraph itself is too large, split by sentences
            if len(para) > chunk_size:
                if current:
                    chunks.append(current.strip())
                    current = ""

                sentence_chunks = ChunkingService._split_by_sentence(
                    para, chunk_size
                )
                chunks.extend(sentence_chunks)
                continue

            # Normal accumulation
            if len(current) + len(para) <= chunk_size:
                current += para + "\n\n"
            else:
                chunks.append(current.strip())

                tail = current[-overlap:]
                current = tail + "\n\n" + para

        if current.strip():
            chunks.append(current.strip())

        return [
            c for c in chunks
            if len(c.strip()) >= ChunkingService.MIN_CHUNK_LENGTH
        ]

    @staticmethod
    def _split_by_sentence(text: str, chunk_size: int) -> list[str]:
        sentence_re = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"])")
        sentences = sentence_re.split(text)

        chunks = []
        current = ""

        for sent in sentences:
            if not current:
                current = sent
            elif len(current) + len(sent) <= chunk_size:
                current += " " + sent
            else:
                chunks.append(current.strip())
                current = sent

        if current:
            chunks.append(current.strip())

        return chunks