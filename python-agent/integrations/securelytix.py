import os
import asyncio
import logging
import aiohttp
import json
import re
from typing import Any, Dict, List

logger = logging.getLogger("securelytix-client")

# Retry config for transient errors (429, 500)
_MAX_RETRIES = 3
_BACKOFF_BASE = 1.5  # seconds


class SecurelytixError(Exception):
    """Raised for non-retryable Securelytix SDK errors."""
    pass


class SecurelytixClient:
    def __init__(self, base_url: str = None, api_key: str = None):
        """
        Initializes the Securelytix Dev SDK Client.
        If base_url is not provided, it defaults to the local docker-compose setup.
        """
        self.base_url = base_url or os.getenv("SECURELYTIX_URL", "http://localhost:8080")
        self.base_url = self.base_url.rstrip("/")
        self.api_key = api_key or os.getenv("SECURELYTIX_API_KEY", "sk_dev_mock_key_for_local_testing")

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

    async def _post_with_retry(self, endpoint: str, payload: Any) -> Dict:
        """
        POST to a Securelytix endpoint with retry/backoff for 429 and 500.
        Returns the parsed JSON response dict on success.
        Raises SecurelytixError on non-retryable failures.
        """
        url = f"{self.base_url}{endpoint}"
        json_payload = json.dumps({"data": payload}, default=str)

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, data=json_payload, headers=self._headers()) as response:
                        status = response.status

                        if status == 200:
                            return await response.json()

                        error_text = await response.text()

                        if status == 400:
                            # Bad request shape — not retryable
                            logger.error(
                                f"[Securelytix] Bad request to {endpoint} (400). "
                                f"Check payload shape. Detail: {error_text}"
                            )
                            raise SecurelytixError(f"400 Bad Request: {error_text}")

                        if status == 413:
                            # Payload too large — not retryable, caller must split
                            logger.warning(
                                f"[Securelytix] Payload exceeds 25 MB limit (413) on {endpoint}. "
                                "Split or truncate input before sending."
                            )
                            raise SecurelytixError("413 Payload Too Large: split input and retry")

                        if status == 429:
                            wait = _BACKOFF_BASE ** attempt
                            logger.warning(
                                f"[Securelytix] Rate limit hit (429) on {endpoint}. "
                                f"Attempt {attempt}/{_MAX_RETRIES}. Backing off {wait:.1f}s. "
                                "Check license usage in dashboard."
                            )
                            if attempt < _MAX_RETRIES:
                                await asyncio.sleep(wait)
                                continue
                            raise SecurelytixError("429 Rate Limit: exhausted retries")

                        if status == 500:
                            # Distinguish ML detection failure vs storage failure from body
                            is_ml = any(k in error_text.lower() for k in ("ml", "detection", "timeout", "model"))
                            kind = "ML detection" if is_ml else "database/storage"
                            wait = _BACKOFF_BASE ** attempt
                            logger.error(
                                f"[Securelytix] 500 {kind} failure on {endpoint}. "
                                f"Attempt {attempt}/{_MAX_RETRIES}. Backing off {wait:.1f}s. "
                                f"Detail: {error_text}"
                            )
                            if attempt < _MAX_RETRIES:
                                await asyncio.sleep(wait)
                                continue
                            raise SecurelytixError(f"500 {kind} failure: exhausted retries")

                        # Any other unexpected status
                        logger.error(f"[Securelytix] Unexpected status {status} on {endpoint}: {error_text}")
                        raise SecurelytixError(f"Unexpected status {status}")

            except SecurelytixError:
                raise
            except Exception as e:
                logger.error(f"[Securelytix] Network/parse error on {endpoint} (attempt {attempt}): {e}")
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_BACKOFF_BASE ** attempt)
                    continue
                raise

        raise SecurelytixError(f"Failed after {_MAX_RETRIES} attempts on {endpoint}")

    # ── Tokenize ──────────────────────────────────────────────────────────────

    async def _tokenize_single(self, data: Any) -> Any:
        try:
            is_str = isinstance(data, str)
            payload = {"text": data} if is_str else data
            result = await self._post_with_retry("/api/v1/tokenize", payload)
            res_data = result.get("data", payload)
            return res_data.get("text", data) if is_str else res_data
        except SecurelytixError:
            # Fail open: return original data so agents are not blocked
            return data

    async def tokenize(self, data: Any) -> Any:
        if isinstance(data, list):
            return list(await asyncio.gather(*(self._tokenize_single(item) for item in data)))
        return await self._tokenize_single(data)

    async def detokenize_dates(self, text: str) -> str:
        if not isinstance(text, str):
            return text
        
        token_regex = re.compile(r'\b([a-zA-Z0-9_\-\.\@]+_stx)\b')
        matches = token_regex.findall(text)
        if not matches:
            return text
            
        payload = {}
        for idx, token in enumerate(matches):
            payload[f"token_{idx}"] = token
            
        try:
            result = await self._post_with_retry("/api/v1/detokenize", payload)
            raw_map = result.get("data", {})
            
            processed_text = text
            date_regex = re.compile(
                r'\b\d{4}[-/]\d{2}[-/]\d{2}\b|\b\d{2}[-/]\d{2}[-/]\d{4}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?\b',
                re.IGNORECASE
            )
            
            for key, token in payload.items():
                raw_value = raw_map.get(key)
                if raw_value and date_regex.search(raw_value):
                    processed_text = processed_text.replace(token, raw_value)
            return processed_text
        except Exception as e:
            logger.error(f"[Securelytix] detokenize_dates failed: {e}")
            return text


    # ── Detokenize ────────────────────────────────────────────────────────────

    async def _detokenize_single(self, data: Any, suppress_partial_warning: bool = False) -> Any:
        try:
            is_str = isinstance(data, str)
            payload = {"text": data} if is_str else data
            result = await self._post_with_retry("/api/v1/detokenize", payload)

            # 200: check for partial_success as per SDK spec
            sdk_status = result.get("Status") or result.get("status")
            if sdk_status == "partial_success" and not suppress_partial_warning:
                failed = result.get("failed_fields", [])
                logger.warning(f"[Securelytix] Partial detokenization — failed fields: {failed}")

            res_data = result.get("data", payload)
            return res_data.get("text", data) if is_str else res_data
        except SecurelytixError:
            # Fail open: return data with tokens intact rather than crashing
            return data

    async def detokenize(self, data: Any, suppress_partial_warning: bool = False) -> Any:
        if isinstance(data, list):
            return list(await asyncio.gather(*(
                self._detokenize_single(item, suppress_partial_warning) for item in data
            )))
        return await self._detokenize_single(data, suppress_partial_warning)
