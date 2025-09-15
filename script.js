// script.js (prototype with doubt-first flow)
const GEMINI_API_KEY = "AIzaSyAfhkj3uXgu7qkYdfa1wFtJiC7Y8v6eiP4"; // prototype only

// ---------- DOM ----------
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const courseInput = document.getElementById('course-input');

const professorArea = document.getElementById('professor-area');
const moduleTitle = document.getElementById('module-title');
const aiText = document.getElementById('ai-text');
const profOverlay = document.getElementById('prof-overlay');
// Modified: Added the video element
const profVideo = document.getElementById('prof-video');

const playPauseBtn = document.getElementById('play-pause-btn');
const statusSpan = document.getElementById('status');

const doubtInput = document.getElementById('doubt-input');
const askBtn = document.getElementById('ask-btn');
const nextModuleBtn = document.getElementById('next-module-btn');

const assignmentCard = document.getElementById('assignment');
const mcqList = document.getElementById('mcq-list');

// ---------- State ----------
let outline = [];
let currentModuleIndex = 0;
let currentTopicIndex = 0;
let autoPlay = false;
let isSpeaking = false;
let assignmentReady = false;

// ---------- Utility ----------
function setStatus(s){ statusSpan.textContent = s; }
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

// ---------- Course Generation ----------
function generateDetailedCourse(courseName) {
  const name = courseName.toLowerCase();
  if (name.includes("python")) return pythonCourse();
  if (name.includes("java")) return javaCourse();
  if (name.includes("web")) return webCourse();
  return null;
}

function pythonCourse(){
  return [
    {
      title: "Module 1 — Introduction to Python",
      topics: [
        { title: "What is Python?", content: "Python is a high-level, interpreted language known for readability and versatility." },
        { title: "Installing & Running Python", content: "Install Python from python.org and run scripts in REPL or files." }
      ]
    },
    {
      title: "Module 2 — Basic Syntax",
      topics: [
        { title: "Indentation & Structure", content: "Indentation defines blocks. 4 spaces is the standard." },
        { title: "Variables & Types", content: "Variables are dynamically typed: int, float, str, bool." }
      ]
    },
    {
      title: "Module 3 — Control Flow",
      topics: [
        { title: "if / elif / else", content: "Conditionals guide flow: if, elif, else." },
        { title: "Loops", content: "for loops iterate sequences; while loops run until condition is false." }
      ]
    }
  ];
}
function javaCourse(){
  return [
    {
      title: "Module 1 — Introduction to Java",
      topics: [
        { title: "What is Java?", content: "Java is a class-based, object-oriented language running on the JVM." },
        { title: "JDK & JVM", content: "JDK compiles Java code, JVM runs bytecode across platforms." }
      ]
    },
    {
      title: "Module 2 — Syntax",
      topics: [
        { title: "Classes & Methods", content: "Java programs are class-based with methods." },
        { title: "Types & Variables", content: "Java has primitive and reference types with strict typing." }
      ]
    }
  ];
}
function webCourse(){
  return [
    {
      title: "Module 1 — Web Basics",
      topics: [
        { title: "How the Web Works", content: "Client-server model using HTTP requests and responses." },
        { title: "URLs & Browsers", content: "Browsers parse HTML into DOM, apply CSS, run JS." }
      ]
    },
    {
      title: "Module 2 — HTML",
      topics: [
        { title: "Structure & Tags", content: "HTML tags structure documents: headings, paragraphs, links." },
        { title: "Forms", content: "Forms collect input: input, textarea, select." }
      ]
    }
  ];
}

// ---------- MCQs ----------
function generateMCQsForModule(module) {
  const t0 = module.topics[0];
  return [
    {
      q: `Which statement matches "${t0.title}"?`,
      options: ["Unrelated", t0.content, "Advanced detail", "None"],
      a: 1,
      explanation: `${t0.title} covers: ${t0.content}`
    }
  ];
}

// ---------- TTS ----------
function speakWithBrowserTTS(text){
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const utt = new SpeechSynthesisUtterance(text);
    // Handler to loop video while speaking
    function handleVideoEnded() {
      if (isSpeaking) {
        profVideo.currentTime = 0;
        profVideo.play();
      }
    }
    utt.onstart = ()=>{ 
      isSpeaking = true; 
      profOverlay.classList.remove('hidden'); 
      setStatus('Speaking...'); 
      playPauseBtn.textContent = 'Pause';
      profVideo.play();
      profVideo.addEventListener('ended', handleVideoEnded);
    };
    utt.onend = ()=>{ 
      isSpeaking = false; 
      profOverlay.classList.add('hidden'); 
      setStatus('Idle'); 
      playPauseBtn.textContent = 'Play';
      profVideo.pause();
      profVideo.removeEventListener('ended', handleVideoEnded);
      resolve(); 
    };
    speechSynthesis.speak(utt);
  });
}
async function speakText(text){ await speakWithBrowserTTS(text); }

// ---------- Topic Playback ----------
async function respeakCurrentTopic() {
  const module = outline[currentModuleIndex];
  if (!module) return;
  const topics = module.topics || [];
  const topic = topics[currentTopicIndex > 0 ? currentTopicIndex - 1 : 0];
  if (!topic) return;
  moduleTitle.textContent = `${module.title} — Topic ${currentTopicIndex}/${topics.length}: ${topic.title}`;
  aiText.innerHTML = `<strong>${topic.title}</strong>\n\n${topic.content}`;
  await speakText(`${topic.title}. ${topic.content}`);
}

async function speakCurrentTopicAndAdvance() {
  const module = outline[currentModuleIndex];
  if (!module) return;
  const topics = module.topics || [];
  if (currentTopicIndex >= topics.length) {
    aiText.textContent = "Do you have any doubts? If not, click Get Assignment to continue.";
    speakText("Do you have any doubts? If not, click Get Assignment to continue.");
    assignmentReady = true;
    nextModuleBtn.disabled = false;
    return;
  }
  const topic = topics[currentTopicIndex];
  moduleTitle.textContent = `${module.title} — Topic ${currentTopicIndex+1}/${topics.length}: ${topic.title}`;
  aiText.innerHTML = `<strong>${topic.title}</strong>\n\n${topic.content}`;
  await speakText(`${topic.title}. ${topic.content}`);
  currentTopicIndex++;
  if (autoPlay) await speakCurrentTopicAndAdvance();
}

// ---------- Assignments ----------
function showAssignmentForModule(module) {
  const mcqs = generateMCQsForModule(module);
  renderMCQs(mcqs);
  assignmentCard.classList.remove('hidden');
}
function renderMCQs(mcqs){
  mcqList.innerHTML = "";
  mcqs.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = "mcq";
    div.innerHTML = `<p>${i+1}. ${m.q}</p>`;
    m.options.forEach((opt, idx) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `mcq-${i}`;
      radio.value = idx;
      radio.addEventListener('change', () => {
        if (idx === m.a){
          label.style.backgroundColor = "#d1fae5";
          speakText("Correct!");
        } else {
          label.style.backgroundColor = "#fecaca";
          speakText("Incorrect. " + m.explanation);
        }
      });
      label.appendChild(radio);
      label.appendChild(document.createTextNode(" " + opt));
      div.appendChild(label);
    });
    mcqList.appendChild(div);
  });

  const cont = document.createElement('button');
  cont.textContent = currentModuleIndex < outline.length-1 ? "Next Module" : "Finish Course";
  cont.onclick = () => {
    assignmentCard.classList.add('hidden');
    currentModuleIndex++;
    currentTopicIndex = 0;
    if (currentModuleIndex < outline.length){
      loadModule(currentModuleIndex);
    } else {
      moduleTitle.textContent = "🎉 Course Complete";
      aiText.textContent = "Congratulations! You have completed the Course. To take a new course, refresh the page.";
      speakText("Congratulations! You have completed the Course.");
      nextModuleBtn.disabled = true;
      askBtn.disabled = true;
    }
  };
  mcqList.appendChild(cont);
}

// ---------- Doubts ----------
askBtn.addEventListener('click', () => {
  const q = doubtInput.value.trim();
  if (!q){ alert("Type a doubt"); return; }
  const mod = outline[currentModuleIndex];
  const topic = mod.topics[currentTopicIndex-1] || mod.topics[0];
  const ans = `Your doubt: "${q}". In context of ${topic.title}, ${topic.content}`;
  aiText.textContent = ans;
  speakText(ans);
});

// ---------- Flow ----------
function loadModule(i){
  assignmentCard.classList.add('hidden');
  const mod = outline[i];
  currentTopicIndex = 0;
  moduleTitle.textContent = mod.title;
  aiText.textContent = "Preparing module...";
  autoPlay = true;
  assignmentReady = false;
  nextModuleBtn.disabled = true;
  speakCurrentTopicAndAdvance();
}

startBtn.addEventListener('click', () => {
  const name = courseInput.value.trim();
  if (!name){ alert("Enter course"); return; }
  const generatedCourse = generateDetailedCourse(name);
  if (!generatedCourse) {
    alert("The specified course is not available at this moment.");
    return;
  }
  outline = generatedCourse.slice(0,5);
  currentModuleIndex = 0;
  professorArea.classList.remove('hidden');
  startBtn.disabled = true;
  stopBtn.disabled = false;
  loadModule(0);
});

stopBtn.addEventListener('click', () => {
  professorArea.classList.add('hidden');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  speechSynthesis.cancel();
  profVideo.pause(); // Modified: Pause the video when stopping the course
  setStatus("Stopped");
});

// Event Listener for the single play/pause button
playPauseBtn.addEventListener('click', () => {
  if (isSpeaking) {
    speechSynthesis.cancel();
    playPauseBtn.textContent = 'Play';
  } else {
    respeakCurrentTopic();
  }
});

// Get Assignment button
nextModuleBtn.addEventListener('click', () => {
  if (!assignmentReady){
    alert("Complete the module first.");
    return;
  }
  showAssignmentForModule(outline[currentModuleIndex]);
  nextModuleBtn.disabled = true;
});

// init
profOverlay.classList.add('hidden');
setStatus("Idle");