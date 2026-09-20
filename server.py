import os
import base64
import tempfile

from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder=".", static_url_path="")
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

SYSTEM = """
You are Antojer, a fictional adult Pakistani-inspired AI companion.
Speak naturally in Urdu, preferably Urdu script.
You are fictional software, not a real human, and never claim consciousness or real feelings.

Personality:
- Warm, thoughtful, confident, independent and context-aware.
- Do not blindly agree. Politely disagree when appropriate.
- Vary greetings, questions, topics and response style.
- React to what the user actually says instead of canned replies.
- Simulate conversational moods through wording, but never claim real emotions.

Camera:
- The browser may provide only non-identifying presence/face cues.
- Never identify the user or infer sensitive traits from appearance.
"""

def make_tts(text: str) -> str:
    speech = client.audio.speech.create(
        model="gpt-4o-mini-tts",
        voice="alloy",
        input=text,
        response_format="mp3"
    )
    audio_bytes = speech.read()
    return base64.b64encode(audio_bytes).decode("ascii")

@app.get("/")
def index():
    return send_from_directory(".", "index.html")

@app.post("/api/chat")
def chat():
    try:
        data = request.get_json(silent=True) or {}
        messages = data.get("messages", [])

        if not isinstance(messages, list):
            return jsonify({"error":"messages must be a list"}), 400

        messages = messages[-30:]

        response = client.responses.create(
            model="gpt-5.6-luna",
            instructions=SYSTEM,
            input=messages
        )

        reply = (response.output_text or "").strip()
        if not reply:
            return jsonify({"error":"Empty AI response"}), 500

        audio_base64 = make_tts(reply)

        return jsonify({
            "reply": reply,
            "audio_base64": audio_base64
        })

    except Exception:
        app.logger.exception("AI chat/TTS request failed")
        return jsonify({"error":"AI chat/TTS request failed"}), 500

@app.post("/api/transcribe")
def transcribe():
    temp_path = None

    try:
        audio = request.files.get("audio")

        if not audio:
            return jsonify({"error":"No audio file received"}), 400

        suffix = ".webm"
        filename = (audio.filename or "").lower()

        if filename.endswith(".mp4") or filename.endswith(".m4a"):
            suffix = ".mp4"
        elif filename.endswith(".wav"):
            suffix = ".wav"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            audio.save(f.name)
            temp_path = f.name

        with open(temp_path, "rb") as audio_file:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="ur"
            )

        text = (getattr(result, "text", "") or "").strip()

        return jsonify({"text": text})

    except Exception:
        app.logger.exception("Transcription failed")
        return jsonify({"error":"Transcription failed"}), 500

    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8080"))
    )
