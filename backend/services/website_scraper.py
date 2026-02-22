"""
website_scraper.py
------------------
Production-grade, security-first web scraper for BotSmith RAG ingestion.
Preserves backward-compatible class/method signatures while upgrading
all internal logic for enterprise use.
"""

import ipaddress
import logging
import random
import re
import socket
import time
from typing import Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup, Comment
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_CONTENT_BYTES = 5 * 1024 * 1024  # 5 MB hard cap
CHUNK_SIZE = 8192  # streaming chunk size in bytes
RESPECT_ROBOTS_TXT = False  # toggle without signature change

# Minimal but realistic browser user-agent pool
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

_ACCEPT_LANGUAGES = [
    "en-US,en;q=0.9",
    "en-GB,en;q=0.9",
    "en-US,en;q=0.8,es;q=0.5",
]

# Tags whose entire subtree should be removed before extraction
_NOISE_TAGS = [
    "script", "style", "noscript", "nav", "header", "footer",
    "aside", "form", "button", "iframe", "svg", "figure",
    "figcaption", "advertisement", "ads",
]

# CSS class/id substrings that signal boilerplate regions
_BOILERPLATE_PATTERNS = re.compile(
    r"(cookie|banner|popup|modal|overlay|nav|menu|sidebar|footer|header|"
    r"advertisement|advert|promo|social|share|related|recommend|comment|"
    r"newsletter|subscribe|widget|breadcrumb|pagination|tag-cloud)",
    re.IGNORECASE,
)

# Strings that indicate bot-detection / Cloudflare walls
_BOT_DETECTION_MARKERS = [
    "cf-browser-verification",
    "challenge-platform",
    "Please enable JavaScript",
    "Checking your browser",
    "DDoS protection by Cloudflare",
    "Access denied",
    "blocked",
]

# Private IP networks for SSRF protection
_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local / metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

# Internal hostnames that must always be blocked
_BLOCKED_HOSTNAMES = {
    "localhost", "metadata.google.internal",
    "169.254.169.254",  # AWS/GCP metadata
}


# ---------------------------------------------------------------------------
# WebsiteScraper
# ---------------------------------------------------------------------------

class WebsiteScraper:
    """Scrape and extract text content from websites (production-grade)."""

    # ------------------------------------------------------------------
    # Public API  (signatures MUST NOT change)
    # ------------------------------------------------------------------

    @staticmethod
    def scrape_url(url: str, timeout: int = 30) -> str:
        """
        Scrape text content from a URL.

        Args:
            url:     The URL to scrape.
            timeout: Request timeout in seconds (default 30).

        Returns:
            Extracted, cleaned plain text suitable for RAG chunking.

        Raises:
            Exception: "Failed to scrape website: <reason>"
            Exception: "Failed to process website content: <reason>"
        """
        t_start = time.monotonic()

        try:
            # 1. Validate & sanitise URL (security gate)
            WebsiteScraper._validate_url_security(url)

            # 2. Optionally honour robots.txt
            if RESPECT_ROBOTS_TXT:
                WebsiteScraper._check_robots(url)

            # 3. Build session with retry strategy
            session = WebsiteScraper._build_session()
            headers = WebsiteScraper._build_headers()

            # 4. Stream response to enforce size cap
            response = session.get(
                url,
                headers=headers,
                timeout=timeout,
                stream=True,
                allow_redirects=True,
            )
            response.raise_for_status()

            elapsed_ms = int((time.monotonic() - t_start) * 1000)
            logger.info(
                "scrape_url fetched",
                extra={
                    "url_scheme": urlparse(url).scheme,
                    "url_host": urlparse(url).netloc,
                    "status_code": response.status_code,
                    "elapsed_ms": elapsed_ms,
                    "content_type": response.headers.get("Content-Type", ""),
                },
            )

            # 5. Content-type guard – skip non-HTML early
            content_type = response.headers.get("Content-Type", "")
            if not WebsiteScraper._is_html(content_type):
                raise Exception(
                    f"Invalid content type for scraping: {content_type}"
                )

            # 6. Read body with size cap (streaming)
            raw_bytes = WebsiteScraper._read_with_limit(response)

            logger.info(
                "scrape_url content received",
                extra={
                    "url_host": urlparse(url).netloc,
                    "content_bytes": len(raw_bytes),
                },
            )

        except requests.exceptions.Timeout as e:
            logger.error("scrape_url timeout", extra={"error": str(e)})
            raise Exception(f"Failed to scrape website: Request timed out after {timeout}s")
        except requests.exceptions.ConnectionError as e:
            logger.error("scrape_url connection error", extra={"error": str(e)})
            raise Exception(f"Failed to scrape website: Connection error – {str(e)}")
        except requests.exceptions.HTTPError as e:
            logger.error("scrape_url http error", extra={"error": str(e)})
            raise Exception(f"Failed to scrape website: HTTP {e.response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error("scrape_url request error", extra={"error": str(e)})
            raise Exception(f"Failed to scrape website: {str(e)}")
        except Exception as e:
            # Re-raise our own typed exceptions unchanged
            if str(e).startswith("Failed to scrape website:"):
                raise
            raise Exception(f"Failed to scrape website: {str(e)}")

        # 7. Parse & extract content (separate error domain)
        try:
            text = WebsiteScraper._extract_text(raw_bytes, url)
            return text
        except Exception as e:
            logger.error("scrape_url extraction error", extra={"error": str(e)})
            raise Exception(f"Failed to process website content: {str(e)}")

    @staticmethod
    def validate_url(url: str) -> bool:
        """
        Validate if a URL is accessible (HEAD request).

        Returns True if the server responds with HTTP < 400.
        """
        try:
            WebsiteScraper._validate_url_security(url)
            session = WebsiteScraper._build_session(retries=1)
            headers = WebsiteScraper._build_headers()
            response = session.head(
                url, headers=headers, timeout=5, allow_redirects=True
            )
            return response.status_code < 400
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Private helpers – internal implementation details
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_url_security(url: str) -> None:
        """
        Security gate: enforce scheme whitelist, block SSRF targets,
        and reject protocol-smuggling attempts.

        Raises Exception with "Failed to scrape website: ..." on violation.
        """
        parsed = urlparse(url)

        # Scheme whitelist
        if parsed.scheme not in ("http", "https"):
            raise Exception(
                f"Failed to scrape website: Blocked scheme '{parsed.scheme}'. "
                "Only http/https are permitted."
            )

        hostname = parsed.hostname or ""

        # Explicit hostname blocklist
        if hostname.lower() in _BLOCKED_HOSTNAMES:
            raise Exception(
                f"Failed to scrape website: Blocked hostname '{hostname}' (security policy)."
            )

        # Resolve and validate IP ranges (SSRF protection)
        try:
            resolved_ip = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(resolved_ip)
            for network in _PRIVATE_NETWORKS:
                if ip_obj in network:
                    raise Exception(
                        f"Failed to scrape website: Target resolves to private/internal "
                        f"IP range ({resolved_ip}). SSRF blocked."
                    )
        except OSError:
            # DNS resolution failed – let requests handle the error naturally
            pass

    @staticmethod
    def _check_robots(url: str) -> None:
        """Honour robots.txt for the given URL. Raises on disallowed."""
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            rp.read()
        except Exception:
            return  # If robots.txt unreadable, allow by default
        if not rp.can_fetch("*", url):
            raise Exception(
                f"Failed to scrape website: Disallowed by robots.txt for {parsed.netloc}"
            )

    @staticmethod
    def _build_session(retries: int = 3) -> requests.Session:
        """
        Create a requests.Session with retry + backoff strategy.

        Extensibility note: swap Session for a Playwright/Selenium driver
        here when JS rendering support is added.
        """
        session = requests.Session()
        retry_strategy = Retry(
            total=retries,
            backoff_factor=1.0,          # 1s, 2s, 4s …
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "HEAD"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        return session

    @staticmethod
    def _build_headers() -> dict:
        """Return randomised but realistic browser headers."""
        return {
            "User-Agent": random.choice(_USER_AGENTS),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": random.choice(_ACCEPT_LANGUAGES),
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Upgrade-Insecure-Requests": "1",
            "Connection": "keep-alive",
        }

    @staticmethod
    def _is_html(content_type: str) -> bool:
        """Return True only for text/html and application/xhtml+xml."""
        ct = content_type.lower()
        return "text/html" in ct or "application/xhtml" in ct

    @staticmethod
    def _read_with_limit(response: requests.Response) -> bytes:
        """
        Stream response body up to MAX_CONTENT_BYTES.
        Aborts early if Content-Length header already exceeds the cap.
        """
        declared = response.headers.get("Content-Length")
        if declared and int(declared) > MAX_CONTENT_BYTES:
            raise Exception(
                f"Content-Length {declared} exceeds maximum allowed "
                f"{MAX_CONTENT_BYTES} bytes."
            )

        chunks = []
        total = 0
        for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_CONTENT_BYTES:
                raise Exception(
                    f"Response body exceeded {MAX_CONTENT_BYTES} bytes – aborted."
                )
            chunks.append(chunk)
        return b"".join(chunks)

    @staticmethod
    def _extract_text(raw_bytes: bytes, url: str) -> str:
        """
        Parse HTML and return clean, RAG-optimised plain text.

        Priority order for content selection:
          <article> → <main> → <section> → <body>
        """
        soup = BeautifulSoup(raw_bytes, "html.parser")

        # Detect bot-wall pages before investing in extraction
        WebsiteScraper._detect_bot_wall(soup)

        # Remove HTML comments
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            comment.extract()

        # Remove obvious noise subtrees
        for tag_name in _NOISE_TAGS:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        # Remove boilerplate containers by class/id heuristic
        for tag in soup.find_all(True):
            identifier = " ".join(
                filter(None, [
                    " ".join(tag.get("class", [])),
                    tag.get("id", ""),
                    tag.get("role", ""),
                ])
            )
            if _BOILERPLATE_PATTERNS.search(identifier):
                tag.decompose()

        # Remove hidden elements
        for tag in soup.find_all(
            style=re.compile(r"display\s*:\s*none|visibility\s*:\s*hidden", re.I)
        ):
            tag.decompose()
        for tag in soup.find_all(hidden=True):
            tag.decompose()

        # Select best content container
        content_root = (
            soup.find("article")
            or soup.find("main")
            or soup.find("section")
            or soup.find("body")
            or soup
        )

        raw_text = content_root.get_text(separator="\n", strip=True)

        # Post-process into clean plain text
        text = WebsiteScraper._clean_text(raw_text)

        if not text:
            raise Exception("No meaningful content extracted from URL")

        return text

    @staticmethod
    def _detect_bot_wall(soup: BeautifulSoup) -> None:
        """Raise if the page looks like a bot-detection / Cloudflare wall."""
        page_text = soup.get_text()
        for marker in _BOT_DETECTION_MARKERS:
            if marker.lower() in page_text.lower():
                raise Exception(
                    f"Failed to scrape website: Bot detection / access restriction "
                    f"encountered (marker: '{marker}'). "
                    "Consider headless browser scraping for this target."
                )

    @staticmethod
    def _clean_text(raw: str) -> str:
        """
        Normalise whitespace, de-duplicate lines, and remove boilerplate
        to produce chunking-friendly plain text.
        """
        lines = raw.splitlines()

        cleaned: list[str] = []
        seen: set[str] = set()

        for line in lines:
            line = line.strip()

            # Drop empty and very short junk lines (single chars, separators)
            if not line or (len(line) <= 2 and not line.isalnum()):
                continue

            # Normalise unicode whitespace
            line = re.sub(r"\s+", " ", line)

            # De-duplicate identical lines (e.g. repeated nav items)
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)

            cleaned.append(line)

        # Collapse runs of more than 2 consecutive blank lines
        result_lines: list[str] = []
        blank_run = 0
        for line in cleaned:
            if not line:
                blank_run += 1
                if blank_run <= 2:
                    result_lines.append("")
            else:
                blank_run = 0
                result_lines.append(line)

        return "\n".join(result_lines).strip()