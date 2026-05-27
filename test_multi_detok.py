import asyncio
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "python-agent"))
from integrations.securelytix import SecurelytixClient

async def test():
    vault = SecurelytixClient()
    token = "opbke@bmzhxqtjpi.ssi_stx"
    payload = {
        "email": token,
        "full_name": token,
        "phoneNo": token,
        "value": token
    }
    res = await vault.detokenize(payload)
    print("Response:", res)

if __name__ == "__main__":
    asyncio.run(test())
