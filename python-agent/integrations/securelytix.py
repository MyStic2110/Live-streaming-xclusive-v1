import os
import logging
import aiohttp
import json
from typing import Any, Dict

logger = logging.getLogger("securelytix-client")

class SecurelytixClient:
    def __init__(self, base_url: str = None, api_key: str = None):
        """
        Initializes the Securelytix Dev SDK Client.
        If base_url is not provided, it defaults to the local docker-compose setup.
        """
        self.base_url = base_url or os.getenv("SECURELYTIX_URL", "http://localhost:8080")
        self.base_url = self.base_url.rstrip("/")
        self.api_key = api_key or os.getenv("SECURELYTIX_API_KEY", "sk_dev_mock_key_for_local_testing")
        
    async def _detokenize_single(self, data: Dict[str, Any], suppress_partial_warning: bool = False) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/detokenize"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {"data": data}
        json_payload = json.dumps(payload, default=str)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=json_payload, headers=headers) as response:
                    if response.status >= 300:
                        error_text = await response.text()
                        logger.error(f"[Securelytix] Detokenize failed with status {response.status}: {error_text}")
                        return data # Return original data on failure to prevent total crash

                    result = await response.json()
                    status = result.get("Status") or result.get("status")
                    if status == "partial_success" and not suppress_partial_warning:
                        failed = result.get("failed_fields", [])
                        logger.warning(f"[Securelytix] Partial detokenization. Failed fields: {failed}")

                    return result.get("data", data)
        except Exception as e:
            logger.error(f"[Securelytix] Detokenize error: {e}")
            return data

    async def detokenize(self, data: Any, suppress_partial_warning: bool = False) -> Any:
        if isinstance(data, list):
            import asyncio
            return await asyncio.gather(*(self._detokenize_single(item, suppress_partial_warning) for item in data))
        return await self._detokenize_single(data, suppress_partial_warning)

    async def _tokenize_single(self, data: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/tokenize"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {"data": data}
        json_payload = json.dumps(payload, default=str)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=json_payload, headers=headers) as response:
                    if response.status >= 300:
                        error_text = await response.text()
                        logger.error(f"[Securelytix] Tokenize failed with status {response.status}: {error_text}")
                        return data

                    result = await response.json()
                    return result.get("data", data)
        except Exception as e:
            logger.error(f"[Securelytix] Tokenize error: {e}")
            return data

    async def tokenize(self, data: Any) -> Any:
        if isinstance(data, list):
            import asyncio
            return await asyncio.gather(*(self._tokenize_single(item) for item in data))
        return await self._tokenize_single(data)
