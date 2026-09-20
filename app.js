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
const API_BASE_URL = "";

function setEmotion(e){ portrait.className="portrait "+e; }
function setStatus(t){statusEl.textContent=t;}
function setCaption(t){caption.textContent=t;}

function speak(text){
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="ur-PK"; u.rate=.92; u.pitch=1.03;
  u.onstart=()=>{speaking=true;mouth.classList.add("talking");};
  u.onend=()=>{speaking=false;mouth.classList.remove("talking");};
  speechSynthesis.speak(u);
}

async function askAI(userText, proactive=false){
  if(!userText)return;
  history.push({role:"user",content:userText});
  setStatus("جواب تیار ہو رہا ہے…");
  setEmotion("thoughtful");
  try{
    const r=await fetch(API_BASE_URL+"/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({messages:history,proactive})
    });
    const raw=await r.text();
    let data={};
    try{data=JSON.parse(raw);}catch{}
    if(!r.ok)throw new Error(data.error||raw||("HTTP "+r.status));
    const reply=(data.reply||"").trim();
    if(!reply)throw new Error("Empty AI response");
    history.push({role:"assistant",content:reply});
    setCaption(reply);
    if(/(غم|اداس|پریشان|افسوس|معذرت)/.test(reply))setEmotion("concerned");
    else if(/(واقعی|زبردست|ہاہا|مزاح|خوش)/.test(reply))setEmotion("happy");
    else setEmotion("thoughtful");
    speak(reply);
    setStatus("میں سن رہی ہوں۔");
  }catch(e){
    console.error("AI request failed:",e);
    setStatus("AI سے رابطے میں مسئلہ ہے۔");
    setCaption("AI جواب نہیں دے سکی۔ دوبارہ کوشش کریں۔");
    setEmotion("concerned");
  }
}

function startRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    setCaption("اس browser میں speech recognition دستیاب نہیں۔ Chrome استعمال کریں۔");
    return false;
  }
  recognition=new SR();
  recognition.lang="ur-PK";
  recognition.interimResults=false;
  recognition.continuous=false;
  recognition.onstart=()=>{listening=true;setStatus("میں سن رہی ہوں…");};
  recognition.onend=()=>{listening=false;if(!speaking)setStatus("مائیک دوبارہ دبائیں۔");};
  recognition.onerror=()=>{listening=false;setStatus("مائیک کی آواز نہیں ملی۔ دوبارہ کوشش کریں۔");};
  recognition.onresult=async e=>{
    const text=e.results[0][0].transcript.trim();
    if(!text)return;
    setCaption("آپ: "+text);
    setEmotion("thoughtful");
    await askAI(text,false);
  };
  return true;
}

micBtn.onclick=()=>{
  if(!recognition&&!startRecognition())return;
  if(!listening&&!speaking){try{recognition.start();}catch(e){console.warn(e);}}
};

async function startCamera(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:true});
    video.srcObject=stream;
    cameraBtn.disabled=true;
    micBtn.disabled=false;
    setStatus("میں آپ کو دیکھ رہی ہوں…");
    setCaption("کیمرہ آن ہو گیا۔");
    await askAI("میں نے ابھی کیمرہ آن کیا ہے۔ ایک نئی، قدرتی اور مختصر اردو گفتگو خود سے شروع کرو۔ ہر بار نیا موضوع چنو اور پہلے والی باتیں بلاوجہ مت دہراؤ۔",true);
  }catch(e){
    console.error("Camera/mic error:",e);
    setStatus("کیمرہ/مائیک کی اجازت درکار ہے۔");
    setCaption("Browser میں Camera اور Microphone کو Allow کریں۔");
  }
}
cameraBtn.onclick=startCamera;

stopBtn.onclick=()=>{
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  if(recognition){try{recognition.stop();}catch{}}
  speechSynthesis.cancel();
  listening=false;speaking=false;
  cameraBtn.disabled=false;micBtn.disabled=true;
  history=[];
  setStatus("روک دیا گیا۔");
  setCaption("دوبارہ شروع کرنے کے لیے کیمرہ آن کریں۔");
  setEmotion("");
};

(async()=>{
  if(!("FaceDetector" in window))return;
  try{
    const detector=new FaceDetector({fastMode:true,maxDetectedFaces:1});
    const loop=async()=>{
      if(video.readyState>=2){
        try{
          const faces=await detector.detect(video);
          if(faces.length){
            const b=faces[0].boundingBox;
            const sx=video.clientWidth/video.videoWidth,sy=video.clientHeight/video.videoHeight;
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
