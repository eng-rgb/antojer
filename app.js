const video = document.getElementById("video");
const cameraBtn = document.getElementById("cameraBtn");
const micBtn = document.getElementById("micBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const caption = document.getElementById("caption");
const portrait = document.getElementById("portrait");
const mouth = document.getElementById("mouth");
const faceBox = document.getElementById("faceBox");

let stream = null;
let recognition = null;
let listening = false;
let speaking = false;
let stopped = true;
let processing = false;
let history = [];
let restartTimer = null;
let mouthTimer = null;

const API_BASE_URL = "";

function setEmotion(emotion) {
  portrait.className = "portrait " + (emotion || "neutral");
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setCaption(text) {
  caption.textContent = text;
}

/* Visual mouth movement while the browser's Urdu voice is speaking. */
function startMouthAnimation() {
  clearInterval(mouthTimer);
  mouth.classList.add("talking");
  mouthTimer = setInterval(() => {
    mouth.classList.toggle("talking");
  }, 110);
}

function stopMouthAnimation() {
  clearInterval(mouthTimer);
  mouthTimer = null;
  mouth.classList.remove("talking");
}

function chooseEmotion(text) {
  const t = String(text || "");

  if (/(زبردست|واہ|خوش|مزہ|ہاہا|مبارک|کمال|دلچسپ|خوب|اچھا ہوا)/.test(t)) {
    return "happy";
  }
  if (/(افسوس|غم|اداس|پریشان|فکر|معذرت|دکھ|مشکل|مایوس)/.test(t)) {
    return "concerned";
  }
  if (/(واقعی|حیرت|اوہ|ارے|کیا واقعی|سچ میں)/.test(t)) {
    return "surprised";
  }
  if (/(شاید|میرے خیال|غور|سوچ|سوچتی|سوچ رہا)/.test(t)) {
    return "thoughtful";
  }
  return "neutral";
}

function speak(text) {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ur-PK";
    utterance.rate = 0.90;
    utterance.pitch = 1.03;

    utterance.onstart = () => {
      speaking = true;
      startMouthAnimation();
    };

    utterance.onend = () => {
      speaking = false;
      stopMouthAnimation();
      resolve();
    };

    utterance.onerror = () => {
      speaking = false;
      stopMouthAnimation();
      resolve();
    };

    speechSynthesis.speak(utterance);
  });
}

function stopRecognition() {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch (_) {}
}

function scheduleListening() {
  clearTimeout(restartTimer);

  if (stopped || !stream || speaking || processing) return;

  restartTimer = setTimeout(() => {
    if (!stopped && stream && !speaking && !processing && !listening) {
      startListening();
    }
  }, 600);
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    setCaption("اس browser میں speech recognition دستیاب نہیں۔ Chrome استعمال کریں۔");
    return false;
  }

  recognition = new SR();
  recognition.lang = "ur-PK";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    setStatus("میں آپ کی بات سن رہی ہوں…");
  };

  recognition.onresult = async (event) => {
    listening = false;

    const text = event.results?.[0]?.[0]?.transcript?.trim();
    if (!text) {
      scheduleListening();
      return;
    }

    setCaption("آپ: " + text);
    setEmotion("thoughtful");
    await askAI(text, false);
  };

  recognition.onerror = (event) => {
    listening = false;
    console.warn("Speech recognition:", event.error);

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setStatus("مائیک کی اجازت درکار ہے۔");
      setCaption("Chrome میں Microphone کو Allow کریں، پھر بولیں دبائیں۔");
      return;
    }

    if (!stopped && stream && !speaking && !processing) {
      setStatus("میں دوبارہ سننے کے لیے تیار ہوں۔");
      scheduleListening();
    }
  };

  recognition.onend = () => {
    listening = false;

    if (!stopped && stream && !speaking && !processing) {
      scheduleListening();
    }
  };

  return true;
}

function startListening() {
  if (stopped || !stream || speaking || processing) return;

  if (!recognition && !startRecognition()) return;
  if (listening) return;

  try {
    recognition.start();
  } catch (error) {
    console.warn("Recognition start:", error);

    setTimeout(() => {
      if (!stopped && stream && !speaking && !processing && !listening) {
        try {
          recognition.start();
        } catch (_) {}
      }
    }, 700);
  }
}

async function askAI(userText, proactive = false) {
  if (!userText || stopped || processing) return;

  processing = true;
  stopRecognition();

  history.push({ role: "user", content: userText });
  history = history.slice(-30);

  setStatus("جواب تیار ہو رہا ہے…");
  setEmotion("thoughtful");

  try {
    const response = await fetch(API_BASE_URL + "/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        messages: history,
        proactive
      })
    });

    const raw = await response.text();
    let data = {};

    try {
      data = JSON.parse(raw);
    } catch (_) {}

    if (!response.ok) {
      throw new Error(data.error || raw || ("HTTP " + response.status));
    }

    const reply = String(data.reply || "").trim();

    if (!reply) {
      throw new Error("Empty AI response");
    }

    history.push({ role: "assistant", content: reply });

    setCaption(reply);
    setEmotion(chooseEmotion(reply));
    setStatus("میں بول رہی ہوں…");

    await speak(reply);

    if (!stopped && stream) {
      setStatus("اب آپ کی باری ہے…");
      processing = false;

      /* Automatically listen for the next turn. */
      scheduleListening();
    }
  } catch (error) {
    console.error("AI request failed:", error);

    setEmotion("concerned");
    setStatus("AI سے رابطے میں مسئلہ ہے۔");
    setCaption("AI جواب نہیں دے سکی۔ دوبارہ کوشش کریں۔");

    processing = false;

    if (!stopped && stream) {
      scheduleListening();
    }
  }
}

async function startCamera() {
  if (stream) return;

  stopped = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true
    });

    video.srcObject = stream;
    cameraBtn.disabled = true;
    micBtn.disabled = false;

    setStatus("میں آپ کو دیکھ رہی ہوں…");
    setCaption("کیمرہ آن ہو گیا۔");

    /* Keep the first AI message natural and varied. */
    await askAI(
      "میں نے ابھی کیمرہ آن کیا ہے۔ خود سے ایک نئی، مختصر اور قدرتی اردو گفتگو شروع کرو۔ کوئی تازہ موضوع چنو، پہلے سے طے شدہ جملہ استعمال نہ کرو، اور آخر میں مجھ سے ایک آسان سا سوال پوچھو تاکہ گفتگو جاری رہ سکے۔",
      true
    );
  } catch (error) {
    console.error("Camera/microphone:", error);
    stopped = true;
    setStatus("کیمرہ/مائیک کی اجازت درکار ہے۔");
    setCaption("Browser میں Camera اور Microphone کو Allow کریں۔");
  }
}

cameraBtn.addEventListener("click", startCamera);

micBtn.addEventListener("click", () => {
  if (!stream) return;

  stopped = false;
  startListening();
});

stopBtn.addEventListener("click", () => {
  stopped = true;
  clearTimeout(restartTimer);

  stopRecognition();

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  speechSynthesis.cancel();
  stopMouthAnimation();

  listening = false;
  speaking = false;
  processing = false;
  history = [];

  cameraBtn.disabled = false;
  micBtn.disabled = true;

  setEmotion("neutral");
  setStatus("روک دیا گیا۔");
  setCaption("دوبارہ شروع کرنے کے لیے کیمرہ آن کریں۔");
});

/* Local, non-identifying face/presence box only. */
(async () => {
  if (!("FaceDetector" in window)) return;

  try {
    const detector = new FaceDetector({
      fastMode: true,
      maxDetectedFaces: 1
    });

    const loop = async () => {
      if (video.readyState >= 2 && video.videoWidth) {
        try {
          const faces = await detector.detect(video);

          if (faces.length) {
            const b = faces[0].boundingBox;
            const sx = video.clientWidth / video.videoWidth;
            const sy = video.clientHeight / video.videoHeight;

            faceBox.style.display = "block";
            faceBox.style.left = (video.offsetLeft + b.x * sx) + "px";
            faceBox.style.top = (video.offsetTop + b.y * sy) + "px";
            faceBox.style.width = (b.width * sx) + "px";
            faceBox.style.height = (b.height * sy) + "px";
          } else {
            faceBox.style.display = "none";
          }
        } catch (_) {}
      }

      requestAnimationFrame(loop);
    };

    loop();
  } catch (_) {}
})();
