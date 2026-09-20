const video=document.getElementById('camera');
const cameraBtn=document.getElementById('cameraBtn');
const micBtn=document.getElementById('micBtn');
const stopBtn=document.getElementById('stopBtn');
const statusEl=document.getElementById('status');
const caption=document.getElementById('caption');
const mouth=document.getElementById('mouth');

let stream=null, recognition=null, speaking=false, lastTopics=[];
const topics=[
  "آج تمہارا دن کیسا گزر رہا ہے؟",
  "ویسے آج کل تم کس چیز میں سب سے زیادہ مصروف ہو؟",
  "اچھا یہ بتاؤ، آج کوئی دلچسپ بات ہوئی؟",
  "تمہیں فارغ وقت میں کیا کرنا سب سے زیادہ پسند ہے؟",
  "اگر آج کہیں گھومنے جانا ہو تو کہاں جاؤ گے؟",
  "تمہارے خیال میں آج کل سب سے دلچسپ چیز کیا ہے؟"
];

function nextTopic(){
  const available=topics.filter(x=>!lastTopics.includes(x));
  const pool=available.length?available:topics;
  const t=pool[Math.floor(Math.random()*pool.length)];
  lastTopics.push(t); if(lastTopics.length>3) lastTopics.shift();
  return t;
}
function speak(text){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang='ur-PK'; u.rate=.94; u.pitch=1;
  u.onstart=()=>{speaking=true;mouth.classList.add('talk')};
  u.onend=()=>{speaking=false;mouth.classList.remove('talk')};
  speechSynthesis.speak(u);
  caption.textContent=text;
}
function startConversation(){
  const line="اچھا، اب میں تمہیں دیکھ سکتی ہوں۔ " + nextTopic();
  speak(line);
  statusEl.textContent="گفتگو شروع ہو گئی";
}
cameraBtn.onclick=async()=>{
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    video.srcObject=stream;
    statusEl.textContent="کیمرہ اور مائیک کی اجازت مل گئی";
    cameraBtn.disabled=true; micBtn.disabled=false;
    startConversation();
  }catch(e){
    statusEl.textContent="Camera/Microphone اجازت نہیں ملی۔ HTTPS ویب سائٹ پر کھولیں۔";
    caption.textContent="اگر یہ فائل content:// یا file:// سے کھلی ہے تو GitHub Pages جیسے HTTPS link سے کھولیں۔";
  }
};

micBtn.onclick=()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){caption.textContent="اس browser میں speech recognition دستیاب نہیں۔";return;}
  if(recognition){recognition.stop();return;}
  recognition=new SR(); recognition.lang='ur-PK'; recognition.continuous=false; recognition.interimResults=false;
  recognition.onstart=()=>{statusEl.textContent="میں سن رہی ہوں…"};
  recognition.onresult=(e)=>{
    const heard=e.results[0][0].transcript;
    caption.textContent="آپ: "+heard;
    const reply="میں نے تمہاری بات سنی۔ " + nextTopic();
    speak(reply);
  };
  recognition.onerror=()=>{statusEl.textContent="مائیک سے آواز نہیں ملی۔ دوبارہ کوشش کریں۔"};
  recognition.onend=()=>{recognition=null};
  recognition.start();
};

stopBtn.onclick=()=>{
  if(stream) stream.getTracks().forEach(t=>t.stop());
  stream=null; video.srcObject=null; cameraBtn.disabled=false; micBtn.disabled=true;
  if(recognition) recognition.stop();
  speechSynthesis.cancel(); mouth.classList.remove('talk');
  statusEl.textContent="روک دیا گیا"; caption.textContent="دوبارہ شروع کرنے کے لیے کیمرہ آن کریں۔";
};
