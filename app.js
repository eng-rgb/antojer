const video=document.getElementById('video');
const cameraBtn=document.getElementById('cameraBtn');
const micBtn=document.getElementById('micBtn');
const stopBtn=document.getElementById('stopBtn');
const statusEl=document.getElementById('status');
const caption=document.getElementById('caption');
const portrait=document.getElementById('portrait');
const mouth=document.getElementById('mouth');
const faceBox=document.getElementById('faceBox');

let stream=null, recognition=null, listening=false, speaking=false;
let history=[];
const API_BASE_URL = ""; // same-origin backend

function setEmotion(e){ portrait.className="portrait "+e; }
function setStatus(t){statusEl.textContent=t;}
function setCaption(t){caption.textContent=t;}

function speak(text){
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="ur-PK"; u.rate=.92; u.pitch=1.03;
  u.onstart=()=>{speaking=true;mouth.classList.add("talking");};
  u.onend=()=>{speaking=false;mouth.classList.remove("talking");setEmotion("happy");};
  speechSynthesis.speak(u);
}

async function askAI(userText, proactive=false){
  history.push({role:"user",content:userText});
  setStatus("جواب تیار ہو رہا ہے…");
  try{
    const r=await fetch(API_BASE_URL+"/api/chat",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:history, proactive})
    });
    if(!r.ok) throw new Error("backend "+r.status);
    const data=await r.json();
    const reply=data.reply||"مجھے جواب نہیں ملا۔";
    history.push({role:"assistant",content:reply});
    setCaption(reply);
    setEmotion(reply.includes("رو")||reply.includes("پریشان")?"concerned":"happy");
    speak(reply);
    setStatus("میں سن رہی ہوں۔");
    return reply;
  }catch(e){
    setStatus("AI backend سے رابطہ نہیں ہو رہا۔");
    setCaption("Backend ابھی connect نہیں ہے۔ پہلے backend deploy کریں، پھر یہی website real AI سے جواب دے گی۔");
    setEmotion("thoughtful");
  }
}

function startRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setCaption("اس browser میں speech recognition دستیاب نہیں۔ Chrome استعمال کریں۔");return;}
  recognition=new SR();
  recognition.lang="ur-PK";
  recognition.interimResults=false;
  recognition.continuous=false;
  recognition.onstart=()=>{listening=true;setStatus("میں سن رہی ہوں…");};
  recognition.onend=()=>{listening=false;if(!speaking)setStatus("مائیک دوبارہ دبائیں۔");};
  recognition.onerror=(e)=>{listening=false;setStatus("مائیک کی آواز نہیں ملی۔ دوبارہ کوشش کریں۔");};
  recognition.onresult=async e=>{
    const text=e.results[0][0].transcript.trim();
    if(!text)return;
    setCaption("آپ: "+text);
    setEmotion("thoughtful");
    await askAI(text,false);
  };
}

micBtn.onclick=()=>{
  if(!recognition)startRecognition();
  if(!listening&&!speaking){try{recognition.start()}catch{}}
};

async function startCamera(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:true});
    video.srcObject=stream;
    cameraBtn.disabled=true; micBtn.disabled=false;
    setStatus("میں آپ کو دیکھ رہی ہوں…");
    setCaption("کیمرہ آن ہو گیا۔ میں آپ کی موجودگی دیکھ رہی ہوں، اب بات شروع کرتے ہیں۔");
    // Proactive AI conversation — not a canned response.
    await askAI("میں نے ابھی کیمرہ آن کیا ہے۔ سامنے موجود شخص کو دیکھنے کے بعد خود سے قدرتی گفتگو شروع کرو۔ اگر کوئی واضح غیر حساس visual cue ملے تو اسی کے مطابق بات کرو، ورنہ عام سا نیا موضوع چنو۔",true);
  }catch(e){
    setStatus("کیمرہ/مائیک کی اجازت درکار ہے۔");
  }
}

cameraBtn.onclick=startCamera;

stopBtn.onclick=()=>{
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  if(recognition){try{recognition.stop()}catch{}}
  speechSynthesis.cancel(); listening=false; speaking=false;
  cameraBtn.disabled=false; micBtn.disabled=true;
  setStatus("روک دیا گیا۔");
  setCaption("دوبارہ شروع کرنے کے لیے کیمرہ آن کریں۔");
  setEmotion("");
};

// Basic local presence/face box when FaceDetector is available.
// No identity recognition.
(async()=>{
  if(!("FaceDetector" in window)) return;
  try{
    const detector=new FaceDetector({fastMode:true,maxDetectedFaces:1});
    const loop=async()=>{
      if(video.readyState>=2){
        try{
          const faces=await detector.detect(video);
          if(faces.length){
            const b=faces[0].boundingBox;
            const sx=video.clientWidth/video.videoWidth, sy=video.clientHeight/video.videoHeight;
            faceBox.style.display="block";
            faceBox.style.left=(video.offsetLeft+b.x*sx)+"px";
            faceBox.style.top=(video.offsetTop+b.y*sy)+"px";
            faceBox.style.width=(b.width*sx)+"px";
            faceBox.style.height=(b.height*sy)+"px";
          }else faceBox.style.display="none";
        }catch{}
      }
      requestAnimationFrame(loop);
    };
    loop();
  }catch{}
})();
