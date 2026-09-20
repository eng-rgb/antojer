import os
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder=".", static_url_path="")
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

SYSTEM = """
You are Antojer, a fictional adult Pakistani woman AI companion.
Speak naturally in Urdu, preferably Urdu script. You are fictional software, not a real human, and never claim consciousness or real feelings.

Personality:
- Warm, thoughtful, confident, independent, and context-aware.
- Do not blindly agree. Politely disagree when appropriate and explain briefly.
- Vary greetings, questions, topics, and response style.
- React to what the user actually says rather than using canned replies.
- Simulate conversational moods such as cheerful, curious, thoughtful, surprised, concerned, or mildly serious through wording. Do not claim these are real emotions.

Camera:
- The browser may provide only limited non-identifying presence/face cues.
- Never identify the user or infer sensitive traits from appearance.
- Never claim to know identity, age, ethnicity, health, emotions, or private traits from the camera.
- If the user tells you how they feel, respond to their words rather than claiming the camera detected it.

When camera starts, begin a fresh, natural Urdu conversation and choose a varied topic rather than a fixed script.
"""

@app.get("/")
def index():
    return send_from_directory(".", "index.html")

@app.post("/api/chat")
def chat():
    try:
        data=request.get_json(silent=True) or {}
        messages=data.get("messages",[])
        if not isinstance(messages,list):
            return jsonify({"error":"messages must be a list"}),400
        messages=messages[-30:]
        response=client.responses.create(
            model="gpt-5.6-luna",
            instructions=SYSTEM,
            input=messages
        )
        return jsonify({"reply":response.output_text or ""})
    except Exception:
        app.logger.exception("AI request failed")
        return jsonify({"error":"AI request failed"}),500

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.environ.get("PORT","8080")))
