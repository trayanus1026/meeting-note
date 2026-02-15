"""
Meeting Notes Backend — process-meeting endpoint.
Downloads audio, transcribes with OpenAI Whisper, summarizes, updates Supabase, sends push notification.
"""
import os
import tempfile

from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from supabase import create_client

load_dotenv()

app = FastAPI(title="Meeting Notes API")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class ProcessMeetingRequest(BaseModel):
    audio_url: str
    meeting_id: str
    push_token: str | None = None


def get_openai():
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
    return OpenAI(api_key=OPENAI_API_KEY)


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@app.post("/process-meeting")
async def process_meeting(body: ProcessMeetingRequest):
    """Download audio, transcribe with Whisper, summarize, update DB, send push."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as f:
            tmp_path = f.name
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(body.audio_url)
                r.raise_for_status()
                with open(tmp_path, "wb") as f:
                    f.write(r.content)

            openai_client = get_openai()
            supabase = get_supabase()

            with open(tmp_path, "rb") as audio_file:
                transcript_response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text",
                )
            transcript = (
                transcript_response
                if isinstance(transcript_response, str)
                else getattr(transcript_response, "text", "")
            )

            summary = ""
            if transcript.strip():
                summary_response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Summarize this meeting transcript in 2-4 short paragraphs. Be concise."},
                        {"role": "user", "content": transcript[:14000]},
                    ],
                    max_tokens=500,
                )
                summary = (summary_response.choices[0].message.content or "").strip()

            supabase.table("meetings").update(
                {"status": "ready", "transcript": transcript, "summary": summary}
            ).eq("id", body.meeting_id).execute()

            if body.push_token:
                await send_expo_push(
                    body.push_token,
                    title="Meeting transcript ready",
                    body="Your transcript and summary are ready.",
                    data={"meetingId": body.meeting_id},
                )

            return {"ok": True, "meeting_id": body.meeting_id}
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except HTTPException:
        raise
    except Exception as e:
        get_supabase().table("meetings").update({"status": "error"}).eq("id", body.meeting_id).execute()
        raise HTTPException(status_code=500, detail=str(e))


async def send_expo_push(token: str, title: str, body: str, data: dict):
    """Send a push notification via Expo Push API."""
    if not token or not token.startswith("ExponentPushToken"):
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            EXPO_PUSH_URL,
            json={
                "to": token,
                "title": title,
                "body": body,
                "data": data,
                "channelId": "default",
            },
        )


@app.get("/health")
def health():
    return {"status": "ok"}
