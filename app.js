const video = document.getElementById("video");
const cameraBtn = document.getElementById("cameraBtn");
const micBtn = document.getElementById("micBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const caption = document.getElementById("caption");
const portrait = document.getElementById("portrait");
const characterImage = document.getElementById("characterImage");
const mouth = document.getElementById("mouth");
const faceBox = document.getElementById("faceBox");

let stream = null;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let sourceNode = null;
let audioElement = null;
let animationFrame = null;
let recording = false;
let processing = false;
let speaking = false;
let stopped = true;
let history = [];
let currentEmotion = "happy";

const emotionImages = {
  happy: "/emotion-happy.png",
  thoughtful: "/emotion-thoughtful.png",
  concerned: "/emotion-concerned.png",
  shy: "/emotion-shy.png",
  playful: "/emotion-playful.png"
};

function setStatus(t){ statusEl.textContent = t; }
function setCaption(t){ caption.textContent = t; }

function setEmotion(emotion){
  const e = emotionImages[emotion] ? emotion : "happy";
  currentEmotion = e;
  portrait.className = "portrait emotion-" + e + (speaking ? " speaking" : "");
  characterImage.src = emotionImages[e];
}

function setSpeaking(on){
  speaking = on;
  portrait.classList.toggle("speaking", on);
  mouth.classList.toggle("talking", on);
}

function pickEmotion(text){
  const t = String(text || "");

  if (/(افسوس|اداس|پریشان|فکر|معذرت|دکھ|مشکل|مایوس|غم)/.test(t)) return "concerned";
  if (/(واقعی|حیرت|اوہ|ارے|کیا واقعی|سچ میں)/.test(t)) return "thoughtful";
  if (/(شاید|میرے خیال|غور|سوچ|سوچتی)/.test(t)) return "thoughtful";
  if (/(ہاہا|مزاح|زبردست|واہ|کمال|خوش|مزہ|مبارک|دلچسپ)/.test(t)) return "happy";
  return "happy";
}

async function unlockAudio(){
  try{
    if(!audioContext){
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioContext.state === "suspended") await audioContext.resume();
  }catch(e){
    console.warn("AudioContext unlock failed", e);
  }
}

function stopAudioAnimation(){
  if(animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  setSpeaking(false);
  if(sourceNode){
    try{sourceNode.disconnect();}catch(_){}
    sourceNode = null;
  }
}

function animateMouth(){
  if(!analyser || !speaking) return;

  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);

  let sum = 0;
  for(let i=0;i<data.length;i++){
    const v = (data[i]-128)/128;
    sum += v*v;
  }

  const rms = Math.sqrt(sum/data.length);
  const amount = Math.min(1.45, .35 + rms*9);
  mouth.style.transform = `translate(-50%,-50%) scaleY(${amount})`;

  animationFrame = requestAnimationFrame(animateMouth);
}

async function playTTS(base64){
  if(!base64) return;

  await unlockAudio();

  stopAudioAnimation();

  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], {type:"audio/mpeg"});
  const url = URL.createObjectURL(blob);

  audioElement = new Audio(url);
  audioElement.preload = "auto";
  audioElement.playsInline = true;

  await new Promise((resolve,reject)=>{
    audioElement.oncanplay = resolve;
    audioElement.onerror = reject;
    audioElement.load();
  });

  try{
    sourceNode = audioContext.createMediaElementSource(audioElement);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
  }catch(e){
    console.warn("Audio analyser unavailable", e);
  }

  audioElement.onplay = ()=>{
    setSpeaking(true);
    animateMouth();
  };

  audioElement.onended = ()=>{
    stopAudioAnimation();
    URL.revokeObjectURL(url);
  };

  audioElement.onerror = ()=>{
    stopAudioAnimation();
    URL.revokeObjectURL(url);
  };

  await audioElement.play();
}

async function sendTurn(text){
  if(!text || stopped || processing) return;

  processing = true;
  history.push({role:"user",content:text});
  history = history.slice(-30);

  setStatus("جواب تیار ہو رہا ہے…");
  setCaption("آپ: " + text);
  setEmotion("thoughtful");

  try{
    const r = await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({messages:history})
    });

    const raw = await r.text();
    let data = {};
    try{ data = JSON.parse(raw); }catch(_){}

    if(!r.ok) throw new Error(data.error || raw || ("HTTP "+r.status));

    const reply = String(data.reply || "").trim();
    if(!reply) throw new Error("Empty AI response");

    history.push({role:"assistant",content:reply});
    setCaption(reply);
    setEmotion(pickEmotion(reply));
    setStatus("میں جواب دے رہی ہوں…");

    await playTTS(data.audio_base64);

    setStatus("اب آپ جواب دے سکتے ہیں۔");
    processing = false;
  }catch(e){
    console.error(e);
    processing = false;
    setEmotion("concerned");
    setStatus("AI جواب نہیں دے سکی۔");
    setCaption("مسئلہ آیا ہے۔ دوبارہ جواب دیں۔");
  }
}

async function recordUserTurn(){
  if(stopped || !stream || recording || processing) return;

  await unlockAudio();

  if(!navigator.mediaDevices?.getUserMedia){
    setCaption("اس browser میں microphone دستیاب نہیں۔");
    return;
  }

  try{
    const micStream = await navigator.mediaDevices.getUserMedia({audio:true});
    audioChunks = [];

    const mime =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
      MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
      "audio/mp4";

    mediaRecorder = new MediaRecorder(micStream, {mimeType:mime});
    recording = true;

    micBtn.textContent = "⏹️ جواب مکمل";
    setStatus("میں سن رہی ہوں…");
    setCaption("اپنا جواب بولیں۔");

    mediaRecorder.ondataavailable = e=>{
      if(e.data.size) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async ()=>{
      recording = false;
      micBtn.textContent = "🎙️ جواب دیں";

      micStream.getTracks().forEach(t=>t.stop());

      const blob = new Blob(audioChunks,{type:mime});
      if(blob.size < 1000){
        setStatus("آواز بہت مختصر تھی۔");
        return;
      }

      processing = true;
      setStatus("آپ کی بات سمجھ رہی ہوں…");

      const form = new FormData();
      form.append("audio", blob, "user-audio.webm");

      try{
        const r = await fetch("/api/transcribe",{
          method:"POST",
          body:form
        });

        const raw = await r.text();
        let data = {};
        try{ data = JSON.parse(raw); }catch(_){}

        if(!r.ok) throw new Error(data.error || raw || ("HTTP "+r.status));

        const text = String(data.text || "").trim();
        processing = false;

        if(!text){
          setStatus("مجھے آواز سمجھ نہیں آئی۔");
          return;
        }

        await sendTurn(text);
      }catch(e){
        console.error("Transcription failed",e);
        processing = false;
        setStatus("آواز سمجھنے میں مسئلہ آیا۔");
        setCaption("دوبارہ “جواب دیں” دبائیں اور واضح بولیں۔");
      }
    };

    mediaRecorder.start();
  }catch(e){
    recording = false;
    micBtn.textContent = "🎙️ جواب دیں";
    console.error("Microphone error",e);
    setStatus("مائیک کی اجازت درکار ہے۔");
    setCaption("Chrome میں Microphone کو Allow کریں۔");
  }
}

micBtn.addEventListener("click",()=>{
  if(recording){
    try{ mediaRecorder.stop(); }catch(_){}
  }else{
    recordUserTurn();
  }
});

async function startCamera(){
  if(stream) return;

  stopped = false;

  try{
    await unlockAudio();

    stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:"user"},
      audio:false
    });

    video.srcObject = stream;
    cameraBtn.disabled = true;
    micBtn.disabled = false;

    setStatus("میں آپ کو دیکھ رہی ہوں…");
    setCaption("کیمرہ آن ہو گیا۔");

    await sendProactive();
  }catch(e){
    console.error("Camera",e);
    stopped = true;
    setStatus("کیمرہ کی اجازت درکار ہے۔");
    setCaption("Browser میں Camera کو Allow کریں۔");
  }
}

async function sendProactive(){
  if(stopped || processing) return;

  processing = true;
  history.push({
    role:"user",
    content:"کیمرہ ابھی آن ہوا ہے۔ خود سے ایک نئی، مختصر، قدرتی اردو گفتگو شروع کرو، کوئی تازہ موضوع چنو، اور آخر میں مجھ سے ایک آسان سوال پوچھو۔"
  });

  try{
    const r = await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({messages:history})
    });

    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "AI request failed");

    const reply = String(data.reply || "").trim();
    if(!reply) throw new Error("Empty reply");

    history.push({role:"assistant",content:reply});
    setCaption(reply);
    setEmotion(pickEmotion(reply));
    setStatus("میں جواب دے رہی ہوں…");

    await playTTS(data.audio_base64);

    processing = false;
    setStatus("اب آپ جواب دے سکتے ہیں۔");
  }catch(e){
    console.error(e);
    processing = false;
    setEmotion("concerned");
    setStatus("AI جواب نہیں دے سکی۔");
    setCaption("دوبارہ کوشش کریں۔");
  }
}

cameraBtn.addEventListener("click",startCamera);

stopBtn.addEventListener("click",()=>{
  stopped = true;
  processing = false;
  recording = false;

  try{ if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop(); }catch(_){}

  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }

  if(audioElement){
    try{audioElement.pause();}catch(_){}
    audioElement = null;
  }

  stopAudioAnimation();

  history = [];
  cameraBtn.disabled = false;
  micBtn.disabled = true;
  micBtn.textContent = "🎙️ جواب دیں";

  setEmotion("happy");
  setStatus("روک دیا گیا۔");
  setCaption("دوبارہ شروع کرنے کے لیے کیمرہ آن کریں۔");
});

(async()=>{
  if(!("FaceDetector" in window)) return;

  try{
    const detector = new FaceDetector({fastMode:true,maxDetectedFaces:1});

    const loop = async()=>{
      if(video.readyState >= 2 && video.videoWidth){
        try{
          const faces = await detector.detect(video);

          if(faces.length){
            const b = faces[0].boundingBox;
            const sx = video.clientWidth/video.videoWidth;
            const sy = video.clientHeight/video.videoHeight;

            faceBox.style.display = "block";
            faceBox.style.left = (video.offsetLeft+b.x*sx)+"px";
            faceBox.style.top = (video.offsetTop+b.y*sy)+"px";
            faceBox.style.width = (b.width*sx)+"px";
            faceBox.style.height = (b.height*sy)+"px";
          }else{
            faceBox.style.display = "none";
          }
        }catch(_){}
      }

      requestAnimationFrame(loop);
    };

    loop();
  }catch(_){}
})();
