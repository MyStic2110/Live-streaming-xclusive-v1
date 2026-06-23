# -*- coding: utf-8 -*-
"""
Structured price-comparison layer for the SHOPPE agent.

The agent's live Playwright browser is great for *showing* a site, but it cannot
reliably *compare prices*: scraped Google snippets rarely contain a parseable
price, so the old code fell back to "first result = lowest", which is wrong.

This module fetches structured, per-merchant pricing from a real product-search
API and lets the agent state the genuine cheapest option. It is provider-pluggable:
today it implements SerpAPI's Google Shopping engine (India-capable), but swapping
providers only means editing `fetch_price_comparison`.

If no `SERPAPI_KEY` is configured the functions degrade to empty results, and the
caller keeps its existing browser-scrape behaviour — nothing breaks without a key.
"""
from __future__ import annotations

import os
import re
import logging
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger("shoppe.price_compare")

_PRICE_RE = re.compile(r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)


@dataclass
class Listing:
    title: str
    url: str
    merchant: str
    price: float          # 0.0 means "price unknown"
    currency: str = "INR"
    rating: Optional[float] = None
    source: str = "api"   # "api" (structured) or "scrape" (browser DOM)

    def to_ui(self) -> dict:
        return asdict(self)


def _parse_price(value) -> float:
    """Accept a float, an int, or a string like '₹1,23,499.00' / 'Rs. 999'."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    m = _PRICE_RE.search(str(value)) or re.search(r"([\d,]+(?:\.\d{1,2})?)", str(value))
    if not m:
        return 0.0
    try:
        return float(m.group(1).replace(",", ""))
    except (ValueError, AttributeError):
        return 0.0


def parse_serpapi_shopping(data: dict, max_results: int = 10) -> list[Listing]:
    """Pure transform of a SerpAPI google_shopping response into Listings.

    Kept side-effect-free so it can be unit-tested without any network call.
    """
    out: list[Listing] = []
    for item in (data or {}).get("shopping_results", []) or []:
        title = (item.get("title") or "").strip()
        url = item.get("product_link") or item.get("link") or ""
        if not title or not url:
            continue
        price = _parse_price(item.get("extracted_price"))
        if price == 0.0:
            price = _parse_price(item.get("price"))
        rating = item.get("rating")
        try:
            rating = float(rating) if rating is not None else None
        except (ValueError, TypeError):
            rating = None
        out.append(Listing(
            title=title,
            url=url,
            merchant=(item.get("source") or item.get("store") or "Store").strip(),
            price=price,
            rating=rating,
            source="api",
        ))
        if len(out) >= max_results:
            break
    return out


def sort_by_price(listings: list[Listing]) -> list[Listing]:
    """Cheapest first; listings with a known price rank ahead of price-unknown ones."""
    return sorted(listings, key=lambda l: (l.price <= 0.0, l.price if l.price > 0 else float("inf")))


def pick_lowest(listings: list[Listing]) -> Optional[Listing]:
    """Genuine cheapest listing among those with a real (>0) price, else None."""
    priced = [l for l in listings if l.price and l.price > 0]
    if not priced:
        return None
    return min(priced, key=lambda l: l.price)


def summarize_comparison(listings: list[Listing]) -> str:
    """A short, voice-friendly comparison line for the LLM to read out."""
    priced = sort_by_price([l for l in listings if l.price and l.price > 0])
    if not priced:
        return "I found listings but couldn't read live prices for them right now."
    lowest = priced[0]
    line = f"Cheapest is ₹{lowest.price:,.0f} at {lowest.merchant}"
    if len(priced) > 1:
        nxt = priced[1]
        if nxt.price > lowest.price:
            line += f", which is ₹{nxt.price - lowest.price:,.0f} less than {nxt.merchant} at ₹{nxt.price:,.0f}"
    return line + "."


async def fetch_price_comparison(query: str, *, country: str = "in", max_results: int = 10) -> list[Listing]:
    """Fetch structured, per-merchant pricing for `query`.

    Provider: SerpAPI Google Shopping (gl=in). Returns [] when `SERPAPI_KEY` is
    unset or on any error, so the caller can fall back to browser scraping.
    """
    api_key = os.getenv("SERPAPI_KEY") or os.getenv("SERPAPI_API_KEY")
    if not api_key:
        return []

    params = {
        "engine": "google_shopping",
        "q": query,
        "gl": country,
        "hl": "en",
        "api_key": api_key,
    }
    try:
        import aiohttp
        timeout = aiohttp.ClientTimeout(total=12)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get("https://serpapi.com/search.json", params=params) as resp:
                if resp.status != 200:
                    logger.warning("[price_compare] SerpAPI returned %s", resp.status)
                    return []
                data = await resp.json()
    except Exception:
        logger.exception("[price_compare] SerpAPI request failed")
        return []

    listings = sort_by_price(parse_serpapi_shopping(data, max_results=max_results))
    logger.info("[price_compare] %d structured listings for %r", len(listings), query)
    return listings
