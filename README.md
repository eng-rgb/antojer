# Antojer Pakistani-inspired AI v3

This package is the next backend-ready version.

## Includes
- `index.html` — Urdu interface
- `style.css` — original fictional Pakistani-inspired visual design
- `app.js` — camera, microphone, speech recognition, speech output, context and backend calls
- `server.py` — secure server-side OpenAI API call
- `requirements.txt` — Python dependencies

## Important
Do NOT put `OPENAI_API_KEY` inside `app.js`, `index.html`, or GitHub.
Set it as a secret environment variable on the backend host.

GitHub Pages cannot run `server.py`. The easiest deployment is to deploy this entire folder as one HTTPS web service. Then the browser uses the same origin for `/api/chat`.

The character is fictional and inspired by a 1990s Pakistani visual style; it is not a copy of a real actress or person.

Camera processing in this version is limited to local face/presence detection when the browser supports it. It does not perform identity recognition.
