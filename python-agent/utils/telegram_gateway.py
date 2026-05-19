import os
import asyncio
import httpx
import logging
from dotenv import load_dotenv

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TELEGRAM_GATEWAY")

# Load environment variables
base_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.abspath(os.path.join(base_dir, "..", ".env"))
load_dotenv(dotenv_path)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

def is_configured() -> bool:
    """Checks if Telegram configuration credentials exist in the environment."""
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)

async def send_approval_request(slug: str, title: str, category: str, excerpt: str) -> int:
    """
    Sends an interactive approval card to the configured Telegram chat.
    Returns the message ID of the sent message, or -1 on failure.
    """
    if not is_configured():
        logger.error("Telegram credentials not configured in .env!")
        return -1

    message_text = (
        f"🤖 *SWARM COMMAND CENTER*\n"
        f"Astra has drafted a new autonomous insight candidate!\n\n"
        f"📂 *Category*: {category}\n"
        f"📰 *Title*: *{title}*\n\n"
        f"📝 *Excerpt*: _{excerpt}_\n\n"
        f"Select an action below to command your autonomous publishing fleet:"
    )

    reply_markup = {
        "inline_keyboard": [
            [
                {"text": "✅ Approve & Publish", "callback_data": f"approve_{slug}"},
                {"text": "❌ Reject Draft", "callback_data": f"reject_{slug}"}
            ]
        ]
    }

    url = f"{BASE_URL}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message_text,
        "parse_mode": "Markdown",
        "reply_markup": reply_markup
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                msg_id = data["result"]["message_id"]
                logger.info(f"Sent Telegram approval request for {slug}. Message ID: {msg_id}")
                return msg_id
            else:
                logger.error(f"Telegram returned status {resp.status_code}: {resp.text}")
                return -1
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")
        return -1

async def poll_approval(slug: str, message_id: int) -> bool:
    """
    Polls the Telegram Bot updates asynchronously waiting for the user to approve or reject.
    Modifies the message UI dynamically once approved/rejected.
    """
    if not is_configured():
        return False

    logger.info(f"Starting async polling loop for slug: {slug} (Message: {message_id})...")

    # Set up offset to only capture updates starting from this execution moment
    offset = 0
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BASE_URL}/getUpdates", params={"limit": 1, "offset": -1})
            if resp.status_code == 200:
                updates = resp.json().get("result", [])
                if updates:
                    offset = updates[-1]["update_id"] + 1
    except Exception as e:
        logger.warning(f"Could not fetch initial Telegram update offset: {e}")

    while True:
        try:
            url = f"{BASE_URL}/getUpdates"
            params = {"offset": offset, "timeout": 15}
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url, params=params)
                
                if resp.status_code != 200:
                    await asyncio.sleep(2.0)
                    continue

                updates = resp.json().get("result", [])
                for update in updates:
                    # Update offset to acknowledge this update
                    offset = update["update_id"] + 1

                    # Look for button callback queries
                    if "callback_query" in update:
                        cb = update["callback_query"]
                        cb_data = cb.get("data", "")
                        cb_id = cb.get("id")

                        # Validate it relates to our active blog draft
                        if cb_data == f"approve_{slug}":
                            logger.info(f"Received Telegram APPROVE callback for {slug}")
                            
                            # 1. Answer callback spinner
                            await client.post(f"{BASE_URL}/answerCallbackQuery", json={"callback_query_id": cb_id, "text": "Draft Approved! 🚀"})
                            
                            # 2. Update Telegram message text to confirm approval
                            edit_text = f"✅ *Approved and Publishing Insight*\n\nDraft '{slug}' has been approved by the Swarm Commander. Moving to publishing and Reels synthesis pipeline... 🎬"
                            await client.post(f"{BASE_URL}/editMessageText", json={
                                "chat_id": TELEGRAM_CHAT_ID,
                                "message_id": message_id,
                                "text": edit_text,
                                "parse_mode": "Markdown"
                            })
                            return True

                        elif cb_data == f"reject_{slug}":
                            logger.info(f"Received Telegram REJECT callback for {slug}")
                            
                            # 1. Answer callback spinner
                            await client.post(f"{BASE_URL}/answerCallbackQuery", json={"callback_query_id": cb_id, "text": "Draft Rejected ❌"})
                            
                            # 2. Update Telegram message text to confirm rejection
                            edit_text = f"❌ *Draft Publication Rejected*\n\nDraft '{slug}' has been rejected. Astra will abort this publication cycle and log the rejection."
                            await client.post(f"{BASE_URL}/editMessageText", json={
                                "chat_id": TELEGRAM_CHAT_ID,
                                "message_id": message_id,
                                "text": edit_text,
                                "parse_mode": "Markdown"
                            })
                            return False

        except Exception as e:
            logger.error(f"Error polling Telegram updates: {e}")
        
        await asyncio.sleep(1.5)

async def send_video_reel(video_path: str, caption: str) -> bool:
    """
    Sends the finished Reels .mp4 video directly to your Telegram chat.
    Uses multipart/form-data to upload the video file cleanly.
    """
    if not is_configured():
        return False

    if not os.path.exists(video_path):
        logger.error(f"Reels video path {video_path} does not exist!")
        return False

    url = f"{BASE_URL}/sendVideo"
    logger.info(f"Uploading Reel {video_path} directly to Telegram Command Chat...")

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            with open(video_path, "rb") as video_file:
                files = {"video": video_file}
                data = {
                    "chat_id": TELEGRAM_CHAT_ID,
                    "caption": caption,
                    "parse_mode": "Markdown"
                }
                resp = await client.post(url, data=data, files=files)
                if resp.status_code == 200:
                    logger.info("Reel video delivered to Telegram Command Chat successfully!")
                    return True
                else:
                    logger.error(f"Failed to send video. Telegram status {resp.status_code}: {resp.text}")
                    return False
    except Exception as e:
        logger.error(f"Exception while sending Telegram video: {e}")
        return False

# Diagnostic bootstrap self-run
if __name__ == "__main__":
    async def diagnostic():
        print("=== TELEGRAM GATEWAY DIAGNOSTIC ===")
        print(f"BOT TOKEN configured: {'Yes' if TELEGRAM_BOT_TOKEN else 'No'}")
        print(f"CHAT ID configured: {'Yes' if TELEGRAM_CHAT_ID else 'No'}")
        if is_configured():
            print("Sending simple test message to confirm API credentials...")
            url = f"{BASE_URL}/sendMessage"
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": "🔌 *Swarm Core*: Telegram Command Gateway Online! Connection status verified.",
                    "parse_mode": "Markdown"
                })
                if resp.status_code == 200:
                    print("[SUCCESS] Connection verified! Check your Telegram chat.")
                else:
                    print(f"[FAILED] Bot returned code {resp.status_code}: {resp.text}")
        else:
            print("[INFO] Telegram credentials are not yet configured in .env")

    asyncio.run(diagnostic())
