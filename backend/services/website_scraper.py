import logging
import re
import socket
import ipaddress
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, Comment, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_CONTENT_BYTES = 4 * 1024 * 1024  # 4 MB streaming cap
CHUNK_SIZE = 8192

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
]

# Domains always allowed even if they resolve to private IPs (same-VPC deploys)
_TRUSTED_DOMAINS: set[str] = {"botsmith.pro"}

# Tags to fully remove before extraction
_REMOVE_TAGS = [
    "script", "style", "noscript", "nav", "header", "footer",
    "aside", "form", "button", "iframe", "svg", "figure", "figcaption",
]

# Class/id substrings that signal boilerplate containers
_BOILERPLATE_RE = re.compile(
    r"(cookie|banner|popup|modal|overlay|nav|menu|sidebar|footer|header|"
    r"advertisement|promo|social|share|related|comment|newsletter|subscribe|"
    r"widget|breadcrumb|pagination|tag-cloud|back-to-top|skip-link)",
    re.IGNORECASE,
)


class WebsiteScraper:
    """Production-grade web scraper optimised for RAG ingestion."""

    # ------------------------------------------------------------------
    # Public API  (signatures must not change)
    # ------------------------------------------------------------------

    @staticmethod
    def scrape_url(url: str, timeout: int = 30) -> str:
        try:
            WebsiteScraper._security_check(url)
            session = WebsiteScraper._build_session()
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }

            response = session.get(
                url, headers=headers, timeout=timeout,
                stream=True, allow_redirects=True,
            )
            response.raise_for_status()

            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                raise Exception(f"URL does not return HTML content: {content_type}")

            raw = WebsiteScraper._stream_with_cap(response)

            logger.info("scrape_url ok", extra={
                "host": urlparse(url).netloc,
                "status": response.status_code,
                "bytes": len(raw),
            })

            text = WebsiteScraper._extract(raw)
            if not text:
                raise Exception("No content extracted from URL")
            return text

        except requests.exceptions.Timeout:
            raise Exception(f"Failed to scrape website: Request timed out after {timeout}s")
        except requests.exceptions.ConnectionError as e:
            raise Exception(f"Failed to scrape website: Connection error - {e}")
        except requests.exceptions.HTTPError as e:
            raise Exception(f"Failed to scrape website: HTTP {e.response.status_code}")
        except requests.RequestException as e:
            logger.error("scrape_url request error", extra={"error": str(e)})
            raise Exception(f"Failed to scrape website: {e}")
        except Exception as e:
            if str(e).startswith("Failed to scrape website:"):
                raise
            logger.error("scrape_url processing error", extra={"error": str(e)})
            raise Exception(f"Failed to process website content: {e}")

    @staticmethod
    def validate_url(url: str) -> bool:
        try:
            WebsiteScraper._security_check(url)
            session = WebsiteScraper._build_session(retries=1)
            r = session.head(url, timeout=5, allow_redirects=True,
                             headers={"User-Agent": "Mozilla/5.0"})
            return r.status_code < 400
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _security_check(url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise Exception(f"Failed to scrape website: Only HTTP/HTTPS allowed, got '{parsed.scheme}'")

        hostname = (parsed.hostname or "").lower()
        if not hostname:
            raise Exception("Failed to scrape website: Invalid URL - no hostname")

        if WebsiteScraper._is_trusted(hostname):
            return

        try:
            ip_str = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(ip_str)
            for net in _PRIVATE_NETWORKS:
                if ip in net:
                    raise Exception(
                        f"Failed to scrape website: Hostname resolves to private IP "
                        f"({ip_str}) - SSRF blocked."
                    )
        except OSError:
            pass  # DNS failure - let requests raise naturally

    @staticmethod
    def _is_trusted(hostname: str) -> bool:
        hostname = hostname.rstrip(".")
        for trusted in _TRUSTED_DOMAINS:
            trusted = trusted.lower().rstrip(".")
            if hostname == trusted or hostname.endswith("." + trusted):
                return True
        return False

    @staticmethod
    def _build_session(retries: int = 3) -> requests.Session:
        session = requests.Session()
        retry = Retry(
            total=retries,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "HEAD"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        return session

    @staticmethod
    def _stream_with_cap(response: requests.Response) -> bytes:
        declared = response.headers.get("Content-Length")
        if declared and int(declared) > MAX_CONTENT_BYTES:
            raise Exception(
                f"Failed to scrape website: Content-Length {declared} exceeds "
                f"{MAX_CONTENT_BYTES} byte limit."
            )
        chunks, total = [], 0
        for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_CONTENT_BYTES:
                raise Exception(
                    f"Failed to scrape website: Response body exceeded "
                    f"{MAX_CONTENT_BYTES} bytes - aborted."
                )
            chunks.append(chunk)
        return b"".join(chunks)

    @staticmethod
    def _extract(raw: bytes) -> str:
        soup = BeautifulSoup(raw, "html.parser")

        # Strip HTML comments
        for node in soup.find_all(string=lambda t: isinstance(t, Comment)):
            node.extract()

        # Remove noise tags entirely
        for tag_name in _REMOVE_TAGS:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        # Remove boilerplate containers by class/id heuristics
        for tag in soup.find_all(True):
            if not isinstance(tag, Tag):
                continue
            attrs = " ".join([
                " ".join(tag.get("class", [])),
                tag.get("id", ""),
                tag.get("role", ""),
            ])
            if _BOILERPLATE_RE.search(attrs):
                tag.decompose()

        # Remove hidden elements
        for tag in soup.find_all(style=re.compile(
            r"display\s*:\s*none|visibility\s*:\s*hidden", re.I
        )):
            tag.decompose()

        # Select the best semantic content root
        root = (
            soup.find("article")
            or soup.find("main")
            or soup.find("div", role="main")
            or soup.find("section")
            or soup.find("body")
            or soup
        )

        # Walk the tree and build structured lines preserving headings/paragraphs
        lines: list[str] = []
        _BLOCK_TAGS = {
            "p", "h1", "h2", "h3", "h4", "h5", "h6",
            "li", "td", "th", "blockquote", "pre", "div",
        }

        def walk(node) -> None:
            if not isinstance(node, Tag):
                return
            tag_name = node.name or ""
            if tag_name in _BLOCK_TAGS:
                text = node.get_text(" ", strip=True)
                if text:
                    if tag_name in ("h1", "h2", "h3", "h4", "h5", "h6"):
                        lines.append(f"\n## {text}\n")
                    else:
                        lines.append(text)
            else:
                for child in node.children:
                    walk(child)

        walk(root)
        return WebsiteScraper._clean(lines)

    @staticmethod
    def _clean(lines: list[str]) -> str:
        seen: set[str] = set()
        out: list[str] = []

        for line in lines:
            line = re.sub(r"[ \t]+", " ", line).strip()
            if not line or len(line) < 4:
                continue
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(line)

        result: list[str] = []
        prev_blank = False
        for line in out:
            is_blank = not line.strip()
            if is_blank and prev_blank:
                continue
            result.append(line)
            prev_blank = is_blank

        return "\n".join(result).strip()


# ---------------------------------------------------------------------------
# ChunkingService
# ---------------------------------------------------------------------------

class ChunkingService:
    """
    Paragraph-aware text chunker optimised for RAG vector embedding.

    Splits on semantic boundaries (paragraphs / headings), respects a
    target character window, and applies configurable overlap so context
    is not lost at chunk edges.
    """

    DEFAULT_CHUNK_SIZE = 900   # target chars per chunk
    DEFAULT_OVERLAP    = 120   # chars of overlap between adjacent chunks
    MIN_CHUNK_LENGTH   = 60    # discard near-empty chunks below this

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_OVERLAP,
    ) -> list[str]:
        """
        Split *text* into semantically coherent chunks ready for embedding.

        Args:
            text:       Plain text (output of WebsiteScraper.scrape_url).
            chunk_size: Soft upper bound on chunk length in characters.
            overlap:    Number of characters to repeat at chunk boundaries.

        Returns:
            list[str] of clean, non-empty chunks.
        """
        if not text or not text.strip():
            return []

        paragraphs = ChunkingService._split_paragraphs(text)
        if not paragraphs:
            return []

        chunks = ChunkingService._build_chunks(paragraphs, chunk_size, overlap)
        return [c for c in chunks if len(c.strip()) >= ChunkingService.MIN_CHUNK_LENGTH]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _split_paragraphs(text: str) -> list[str]:
        """
        Split text into logical paragraphs.

        Heading markers (## ...) always start a new paragraph so that topic
        boundaries are respected during chunk assembly.
        """
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        raw_blocks = re.split(r"\n{2,}", text)

        paragraphs: list[str] = []
        for block in raw_blocks:
            block = block.strip()
            if not block:
                continue

            # Split on heading markers to keep each heading with its content
            if "\n## " in block or block.startswith("## "):
                sub_blocks = re.split(r"(?=\n## |\A## )", block)
                for sb in sub_blocks:
                    sb = sb.strip()
                    if sb:
                        paragraphs.append(sb)
            else:
                paragraphs.append(block)

        return paragraphs

    @staticmethod
    def _build_chunks(
        paragraphs: list[str],
        chunk_size: int,
        overlap: int,
    ) -> list[str]:
        """
        Greedily accumulate paragraphs into chunks that stay near *chunk_size*.

        When a single paragraph exceeds *chunk_size* it is split on sentence
        boundaries rather than arbitrary character positions.
        """
        chunks: list[str] = []
        current_parts: list[str] = []
        current_len = 0

        def flush() -> None:
            if current_parts:
                chunks.append("\n\n".join(current_parts).strip())
                current_parts.clear()

        for para in paragraphs:
            para_len = len(para)

            # Paragraph is too large on its own - sentence-split it first
            if para_len > chunk_size:
                flush()
                current_len = 0
                for sentence_chunk in ChunkingService._split_large_paragraph(para, chunk_size):
                    chunks.append(sentence_chunk.strip())
                continue

            # Adding this paragraph would exceed the target - flush first
            if current_len + para_len > chunk_size and current_parts:
                flush()
                current_len = 0

            current_parts.append(para)
            current_len += para_len

        flush()

        if overlap > 0 and len(chunks) > 1:
            chunks = ChunkingService._apply_overlap(chunks, overlap)

        return chunks

    @staticmethod
    def _split_large_paragraph(para: str, chunk_size: int) -> list[str]:
        """
        Split a paragraph that exceeds *chunk_size* on sentence boundaries.
        Falls back to hard splitting only when no sentence boundary is found.
        """
        sentence_re = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"])")
        sentences = sentence_re.split(para)

        parts: list[str] = []
        current = ""

        for sent in sentences:
            if not current:
                current = sent
            elif len(current) + 1 + len(sent) <= chunk_size:
                current += " " + sent
            else:
                parts.append(current.strip())
                current = sent

        if current:
            parts.append(current.strip())

        # Last resort: if any part is still too big, hard-split on word boundary
        final: list[str] = []
        for part in parts:
            if len(part) <= chunk_size:
                final.append(part)
            else:
                final.extend(ChunkingService._hard_split(part, chunk_size))

        return final

    @staticmethod
    def _hard_split(text: str, chunk_size: int) -> list[str]:
        """Split on the last space within the window to avoid mid-word cuts."""
        parts: list[str] = []
        while len(text) > chunk_size:
            cut = text.rfind(" ", 0, chunk_size)
            if cut == -1:
                cut = chunk_size
            parts.append(text[:cut].strip())
            text = text[cut:].strip()
        if text:
            parts.append(text)
        return parts

    @staticmethod
    def _apply_overlap(chunks: list[str], overlap: int) -> list[str]:
        """
        Prepend the last *overlap* characters of chunk[i-1] to chunk[i],
        preserving word boundaries to avoid mid-word prefixes.
        """
        result = [chunks[0]]
        for i in range(1, len(chunks)):
            prev_tail = chunks[i - 1][-overlap:]
            space = prev_tail.find(" ")
            if space != -1:
                prev_tail = prev_tail[space + 1:]
            result.append((prev_tail + "\n\n" + chunks[i]).strip())
        return result