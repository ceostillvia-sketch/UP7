// Up7 - Core Application Logic
// State Management, Routing, Web Audio Alarm Engine, Challenges, and PWA Support.

// Initialize state from LocalStorage or defaults
const DEFAULT_STATE = {
  auth: {
    user: { 
      name: "Julian Sterling", 
      email: "julian@up7app.io", 
      profession: "Software Engineer", 
      purpose: "Gym / Workout" 
    },
    loggedIn: true
  },
  alarms: [
    { id: 1, time: "06:30", days: [1, 2, 3, 4, 5], label: "Morning Wakeup", mission: "qr", active: true, completedToday: false },
    { id: 2, time: "07:15", days: [6, 0], label: "Weekend Routine", mission: "step", active: true, completedToday: false },
    { id: 3, time: "08:00", days: [1, 3, 5], label: "Gym Session", mission: "math", active: false, completedToday: false }
  ],
  birthdays: [
    { id: 1, name: "Sarah Jenkins", date: "1995-10-14", notifyWeekBefore: true, notifyDayOf: true },
    { id: 2, name: "Michael Chen", date: "1992-06-20", notifyWeekBefore: true, notifyDayOf: true },
    { id: 3, name: "Emma Watson", date: "1990-06-25", notifyWeekBefore: true, notifyDayOf: false },
    { id: 4, name: "David Miller", date: "1988-07-02", notifyWeekBefore: false, notifyDayOf: true }
  ],
  tasks: [],
  stats: {
    currentStreak: 12,
    longestStreak: 45,
    lastWakeupDate: null,
    totalAlarmsCompleted: 142,
    totalMissionsSolved: 120,
    completionHistory: [] // list of YYYY-MM-DD when missions were completed
  },
  settings: {
    difficulty: "medium", // easy, medium, hard
    darkMode: false,
    volume: 80,
    snoozeDuration: 5 // minutes
  }
};

let state = JSON.parse(localStorage.getItem('up7_state')) || DEFAULT_STATE;

// Ensure fallback attributes exist in loaded state
if (state.auth && state.auth.user) {
  state.auth.user.profession = state.auth.user.profession || "Software Engineer";
  state.auth.user.purpose = state.auth.user.purpose || "Gym / Workout";
}

state.tasks = state.tasks || [
  { id: 1, title: "Drink 500ml Water", date: new Date().toISOString().split('T')[0], time: "08:30", notified: false },
  { id: 2, title: "Review Daily Reminders", date: new Date().toISOString().split('T')[0], time: "09:00", notified: false }
];

// Save state to localStorage
function saveState() {
  localStorage.setItem('up7_state', JSON.stringify(state));
}

// ----------------------------------------------------
// Web Audio Alarm Engine
// ----------------------------------------------------
let audioContext = null;
let alarmInterval = null;
let isPlayingAlarm = false;

function startAlarmSound() {
  if (isPlayingAlarm) return;
  isPlayingAlarm = true;
  
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  let toggle = false;
  
  function playBeep(freq, duration) {
    if (!isPlayingAlarm) return;
    
    // Create dual oscillators for maximum piercing thickness
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Sawtooth + Square create an extremely aggressive and piercing industrial buzzer sound
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    
    osc1.frequency.setValueAtTime(freq, audioContext.currentTime);
    osc2.frequency.setValueAtTime(freq + 4, audioContext.currentTime); // detuned for harsh chorusing effect
    
    const baseVol = (state.settings.volume || 80) / 100 * 0.45; // High volume scale
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(baseVol, audioContext.currentTime + 0.01);
    gainNode.gain.setValueAtTime(baseVol, audioContext.currentTime + duration - 0.02);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
    
    osc1.start(audioContext.currentTime);
    osc2.start(audioContext.currentTime);
    
    osc1.stop(audioContext.currentTime + duration);
    osc2.stop(audioContext.currentTime + duration);
  }
  
  alarmInterval = setInterval(() => {
    // Rapidly toggle between high dissonant tones
    const freq = toggle ? 1100 : 880;
    playBeep(freq, 0.15);
    toggle = !toggle;
  }, 180);
}

function stopAlarmSound() {
  isPlayingAlarm = false;
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

// ----------------------------------------------------
// Router & Page Navigation
// ----------------------------------------------------
const pages = ['auth', 'dashboard', 'alarms', 'birthdays', 'stats', 'settings', 'active-mission'];

function navigateTo(pageId) {
  // If not logged in, force navigation to auth
  if (!state.auth.loggedIn && pageId !== 'auth') {
    window.location.hash = '#auth';
    return;
  }
  // If logged in and at auth, redirect to dashboard
  if (state.auth.loggedIn && pageId === 'auth') {
    window.location.hash = '#dashboard';
    return;
  }
  
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) {
      if (p === pageId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Highlight navigation items
  updateNavHighlights(pageId);
  
  // Render page-specific content
  if (pageId === 'active-mission') {
    if (activeTriggeredAlarm) {
      setupActiveMissionUI(activeTriggeredAlarm);
    } else {
      window.location.hash = '#dashboard';
      return;
    }
  }
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'alarms') renderAlarms();
  if (pageId === 'birthdays') showReminderTab('birthdays');
  if (pageId === 'stats') renderStats();
  if (pageId === 'settings') renderSettings();
  
  // Close menu if mobile
  window.scrollTo(0, 0);
}

function updateNavHighlights(activePage) {
  // Highlight active bottom navigation items
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === `#${activePage}`) {
      link.className = 'flex flex-col items-center justify-center bg-primary-container dark:bg-on-primary-fixed-variant text-on-primary-container dark:text-primary-fixed rounded-full px-4 py-1 active:scale-95 transition-all duration-150';
    } else {
      link.className = 'flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant px-4 py-1 hover:text-primary active:scale-95 transition-all duration-150';
    }
  });

  // Show/hide shell containers for login page vs app pages
  const header = document.querySelector('header');
  const bottomNav = document.querySelector('nav');
  const main = document.querySelector('main');
  
  if (activePage === 'auth' || activePage === 'active-mission') {
    if (header) header.classList.add('hidden');
    if (bottomNav) bottomNav.classList.add('hidden');
    if (main) main.className = 'w-full flex-grow px-gutter py-lg flex items-center justify-center';
  } else {
    if (header) header.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');
    if (main) main.className = 'flex-grow px-gutter py-lg pb-12';
  }
}

// Handle routing on hash change
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1) || 'dashboard';
  navigateTo(hash);
});

// ----------------------------------------------------
// Alarm Scheduler Engine
// ----------------------------------------------------
let activeTriggeredAlarm = null;
let alarmCheckInterval = null;
let lastCheckedMinute = -1;

function startAlarmChecking() {
  if (alarmCheckInterval) clearInterval(alarmCheckInterval);
  
  alarmCheckInterval = setInterval(() => {
    if (!state.auth.loggedIn) return;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentDay = now.getDay(); // 0 is Sun, 1 is Mon, etc.
    const currentMinString = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
    
    // Check once per minute
    if (currentMin !== lastCheckedMinute) {
      lastCheckedMinute = currentMin;
      
      // Auto-reset completed alarms at midnight
      if (currentHour === 0 && currentMin === 0) {
        state.alarms.forEach(a => a.completedToday = false);
        state.tasks.forEach(t => t.notified = false); // Reset task status for recurring
        saveState();
      }
      
      // Run custom task reminders checker
      checkTaskReminders();
      
      // Look for match
      const matchingAlarm = state.alarms.find(alarm => {
        if (!alarm.active || alarm.completedToday) return false;
        if (alarm.time !== currentMinString) return false;
        
        // Check days. If empty array, it's a one-time alarm.
        if (alarm.days.length === 0) return true;
        return alarm.days.includes(currentDay);
      });
      
      if (matchingAlarm) {
        triggerAlarm(matchingAlarm);
      }
    }
  }, 1000);
}

function triggerAlarm(alarm) {
  activeTriggeredAlarm = alarm;
  window.location.hash = '#active-mission';
  startAlarmSound();
  setupActiveMissionUI(alarm);
}

// ----------------------------------------------------
// Active Mission / Challenge Code
// ----------------------------------------------------
let activeMissionType = "math";
let mathCorrectAnswer = 0;
let stepCount = 0;
const stepsRequired = 30;
let qrScanTimeout = null;

function setupActiveMissionUI(alarm) {
  const missionType = alarm.mission === 'random' ? getRandomMissionType() : alarm.mission;
  activeMissionType = missionType;
  
  // Hide all challenge forms first
  document.getElementById('challenge-math').classList.add('hidden');
  document.getElementById('challenge-qr').classList.add('hidden');
  document.getElementById('challenge-step').classList.add('hidden');
  
  // Set icons and title
  const iconEl = document.getElementById('mission-icon');
  const titleEl = document.getElementById('mission-title');
  const descEl = document.getElementById('mission-desc');
  
  titleEl.innerText = "Wake Up! Up7";
  descEl.innerText = `Alarm: ${alarm.label || 'Good Morning'}`;
  
  if (missionType === 'math') {
    iconEl.innerText = 'calculate';
    document.getElementById('challenge-math').classList.remove('hidden');
    generateMathProblem();
  } else if (missionType === 'qr') {
    iconEl.innerText = 'qr_code_scanner';
    document.getElementById('challenge-qr').classList.remove('hidden');
    startQRScannerSimulation();
  } else if (missionType === 'step') {
    iconEl.innerText = 'directions_walk';
    document.getElementById('challenge-step').classList.remove('hidden');
    resetStepCounter();
  }
}

function getRandomMissionType() {
  const types = ['math', 'qr', 'step'];
  return types[Math.floor(Math.random() * types.length)];
}

function generateMathProblem() {
  const diff = state.settings.difficulty || 'medium';
  let a, b, c;
  let expression = "";
  
  if (diff === 'easy') {
    a = Math.floor(Math.random() * 20) + 5;
    b = Math.floor(Math.random() * 20) + 5;
    mathCorrectAnswer = a + b;
    expression = `${a} + ${b}`;
  } else if (diff === 'medium') {
    a = Math.floor(Math.random() * 50) + 10;
    b = Math.floor(Math.random() * 50) + 10;
    c = Math.floor(Math.random() * 20) + 2;
    mathCorrectAnswer = a + b - c;
    expression = `${a} + ${b} - ${c}`;
  } else {
    a = Math.floor(Math.random() * 12) + 2;
    b = Math.floor(Math.random() * 12) + 2;
    c = Math.floor(Math.random() * 100) + 20;
    mathCorrectAnswer = (a * b) + c;
    expression = `(${a} × ${b}) + ${c}`;
  }
  
  document.getElementById('math-expression').innerText = expression;
  document.getElementById('math-input').value = "";
  document.getElementById('math-input').focus();
}

function submitMathAnswer() {
  const val = parseInt(document.getElementById('math-input').value);
  if (val === mathCorrectAnswer) {
    completeMissionSuccess();
  } else {
    showMissionFeedback(false, "Focus! Try again.");
    generateMathProblem();
  }
}

function startQRScannerSimulation() {
  const video = document.getElementById('qr-video');
  const qrStatus = document.getElementById('qr-status');
  qrStatus.innerText = "Initializing camera feed...";
  
  // Access real camera video stream to make it feel premium
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        video.srcObject = stream;
        video.play();
        qrStatus.innerText = "Position QR code inside the box";
        
        // Auto resolve after 4 seconds as fallback/simulated scan
        qrScanTimeout = setTimeout(() => {
          stopVideoStream();
          completeMissionSuccess();
        }, 4000);
      })
      .catch(err => {
        qrStatus.innerText = "Camera not available. Simulating scan...";
        qrScanTimeout = setTimeout(() => {
          completeMissionSuccess();
        }, 3000);
      });
  } else {
    qrStatus.innerText = "Camera not supported. Simulating scan...";
    qrScanTimeout = setTimeout(() => {
      completeMissionSuccess();
    }, 3000);
  }
}

function stopVideoStream() {
  const video = document.getElementById('qr-video');
  if (video && video.srcObject) {
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }
  if (qrScanTimeout) {
    clearTimeout(qrScanTimeout);
    qrScanTimeout = null;
  }
}

function resetStepCounter() {
  stepCount = 0;
  updateStepProgress();
  
  // Attempt to use device motion sensors
  if (window.DeviceMotionEvent) {
    // Some mobile devices require permission first
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            window.addEventListener('devicemotion', handleMotionShake);
          }
        });
    } else {
      window.addEventListener('devicemotion', handleMotionShake);
    }
  }
}

let lastShakeTime = 0;
function handleMotionShake(event) {
  const acceleration = event.accelerationIncludingGravity;
  if (!acceleration) return;
  
  const curTime = new Date().getTime();
  if ((curTime - lastShakeTime) > 300) {
    const speed = Math.abs(acceleration.x + acceleration.y + acceleration.z);
    
    if (speed > 15) { // Shake sensitivity threshold
      lastShakeTime = curTime;
      simulateStep();
    }
  }
}

function simulateStep() {
  stepCount++;
  updateStepProgress();
  
  // Audio chime feedback for each step
  if (audioContext && audioContext.state === 'running') {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(600 + stepCount * 10, audioContext.currentTime);
    gain.gain.setValueAtTime(0.05, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    osc.start();
    osc.stop(audioContext.currentTime + 0.1);
  }
  
  if (stepCount >= stepsRequired) {
    window.removeEventListener('devicemotion', handleMotionShake);
    completeMissionSuccess();
  }
}

function updateStepProgress() {
  const text = document.getElementById('step-text');
  const bar = document.getElementById('step-progress-bar');
  text.innerText = `${stepCount} / ${stepsRequired} steps completed`;
  const pct = Math.min((stepCount / stepsRequired) * 100, 100);
  bar.style.width = `${pct}%`;
}

function completeMissionSuccess() {
  stopAlarmSound();
  stopVideoStream();
  window.removeEventListener('devicemotion', handleMotionShake);
  
  showMissionFeedback(true, "Great Job! You're awake.");
  
  // Record alarm history and streak updates
  const todayStr = getTodayDateString();
  
  state.stats.totalAlarmsCompleted++;
  state.stats.totalMissionsSolved++;
  
  if (activeTriggeredAlarm) {
    activeTriggeredAlarm.completedToday = true;
    
    // Streak calculations
    if (state.stats.lastWakeupDate !== todayStr) {
      if (state.stats.lastWakeupDate === getYesterdayDateString()) {
        state.stats.currentStreak++;
      } else {
        state.stats.currentStreak = 1;
      }
      state.stats.lastWakeupDate = todayStr;
      if (state.stats.currentStreak > state.stats.longestStreak) {
        state.stats.longestStreak = state.stats.currentStreak;
      }
    }
    
    if (!state.stats.completionHistory.includes(todayStr)) {
      state.stats.completionHistory.push(todayStr);
    }
  }
  
  saveState();
  
  setTimeout(() => {
    window.location.hash = '#dashboard';
  }, 1500);
}

function snoozeActiveAlarm() {
  stopAlarmSound();
  stopVideoStream();
  window.removeEventListener('devicemotion', handleMotionShake);
  
  const snoozeMins = state.settings.snoozeDuration || 5;
  const now = new Date();
  now.setMinutes(now.getMinutes() + snoozeMins);
  
  // Create a temporary snooze alarm that goes off once
  const snoozeTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Modify or schedule snooze alarm in state
  const snoozedAlarm = {
    id: Date.now(),
    time: snoozeTimeStr,
    days: [], // One-time alarm
    label: `Snoozed: ${activeTriggeredAlarm ? activeTriggeredAlarm.label : 'Wakeup'}`,
    mission: activeTriggeredAlarm ? activeTriggeredAlarm.mission : 'math',
    active: true,
    completedToday: false,
    isSnooze: true // Tag to delete it after triggering
  };
  
  state.alarms.push(snoozedAlarm);
  saveState();
  
  alert(`Snoozed for ${snoozeMins} minutes until ${snoozeTimeStr}`);
  window.location.hash = '#dashboard';
}

function showMissionFeedback(isSuccess, message) {
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  const content = document.getElementById('feedback-content');
  
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    content.classList.remove('scale-90');
  }, 10);
  
  if (isSuccess) {
    overlay.className = "fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-primary-container/20 transition-all duration-300";
    icon.innerText = "verified";
    icon.className = "material-symbols-outlined text-[64px] mb-md text-primary animate-bounce";
  } else {
    overlay.className = "fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-error-container/20 transition-all duration-300";
    icon.innerText = "error";
    icon.className = "material-symbols-outlined text-[64px] mb-md text-error animate-pulse";
  }
  text.innerText = message;
  
  if (!isSuccess) {
    setTimeout(() => {
      overlay.classList.add('opacity-0');
      content.classList.add('scale-90');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    }, 1500);
  } else {
    setTimeout(() => {
      overlay.classList.add('opacity-0');
      content.classList.add('scale-90');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    }, 1500);
  }
}

// ----------------------------------------------------
// Dashboard Page View Render
// ----------------------------------------------------
function renderDashboard() {
  // Good Morning Greeting
  const hour = new Date().getHours();
  let greeting = "Good Morning";
  let greetingIcon = "wb_sunny";
  if (hour >= 12 && hour < 17) {
    greeting = "Good Afternoon";
    greetingIcon = "light_mode";
  } else if (hour >= 17) {
    greeting = "Good Evening";
    greetingIcon = "bedtime";
  }
  document.getElementById('dash-greeting').innerText = `${greeting}, ${state.auth.user.name.split(' ')[0]}`;
  document.getElementById('dash-greeting-icon').innerText = greetingIcon;

  // Dynamic greeting sub-text based on Wake-up Purpose and Profession
  const motivationText = document.getElementById('dash-motivation-text');
  if (motivationText) {
    const purpose = state.auth.user.purpose || "Gym / Workout";
    const profession = state.auth.user.profession || "Software Engineer";
    
    let quote = "“Wake Up. Level Up.” Start your day off with intent.";
    if (purpose.includes("Gym")) {
      quote = `Time to get up and hit the gym! Stay fit as a ${profession}.`;
    } else if (purpose.includes("Study")) {
      quote = `Time to hit the books and focus on your ${profession} goals!`;
    } else if (purpose.includes("Meditation")) {
      quote = `Start your day with peaceful mindfulness before your work as a ${profession}.`;
    } else if (purpose.includes("Morning")) {
      quote = `Rise and shine! Perfect your routine to excel as a ${profession}.`;
    } else if (purpose.includes("Work") || purpose.includes("Commute")) {
      quote = `Get ready to crush your responsibilities as a ${profession} today!`;
    } else {
      quote = `Wake up with purpose for your daily routine. Let's make progress!`;
    }
    motivationText.innerText = quote;
  }
  
  // Current Streak
  document.getElementById('dash-streak-count').innerText = state.stats.currentStreak;
  
  // Streak progress level up slider (mock leveling system every 15 days)
  const nextMilestone = Math.ceil((state.stats.currentStreak + 1) / 15) * 15;
  const prevMilestone = nextMilestone - 15;
  const progressVal = state.stats.currentStreak - prevMilestone;
  const progressPct = (progressVal / 15) * 100;
  
  document.getElementById('dash-level-text').innerText = `Level Up Progress`;
  document.getElementById('dash-level-ratio').innerText = `${state.stats.currentStreak}/${nextMilestone}`;
  document.getElementById('dash-level-bar').style.width = `${progressPct}%`;
  
  // Next Alarm Card info
  const nextAlarm = getNextScheduledAlarm();
  const nextAlarmContainer = document.getElementById('dash-next-alarm-info');
  
  if (nextAlarm) {
    let daysStr = getDaysShortString(nextAlarm.days);
    nextAlarmContainer.innerHTML = `
      <div class="flex justify-between items-start mb-md">
        <div>
          <span class="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Next Alarm</span>
          <div class="flex items-baseline gap-sm mt-xs">
            <h3 class="font-display-lg text-display-lg-mobile md:text-display-lg text-primary">${formatTime12h(nextAlarm.time).time}</h3>
            <span class="font-headline-md text-headline-md text-primary">${formatTime12h(nextAlarm.time).ampm}</span>
          </div>
          <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">${nextAlarm.label || "Alarm"}</p>
        </div>
        <div class="bg-primary-container text-on-primary-container px-md py-sm rounded-full flex items-center gap-sm">
          <span class="material-symbols-outlined text-sm">${getMissionIcon(nextAlarm.mission)}</span>
          <span class="font-label-sm text-label-sm capitalize">${nextAlarm.mission} Challenge</span>
        </div>
      </div>
      <div class="flex items-center justify-between mt-xl">
        <span class="font-label-sm text-label-sm text-primary font-semibold">${daysStr}</span>
        <a href="#alarms" class="text-primary font-label-md flex items-center gap-xs">
          Manage Alarms <span class="material-symbols-outlined">chevron_right</span>
        </a>
      </div>
    `;
  } else {
    nextAlarmContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-lg text-center">
        <span class="material-symbols-outlined text-outline-variant text-[48px] mb-sm">alarm_off</span>
        <p class="font-label-md text-label-md text-on-surface-variant">No alarms scheduled.</p>
        <a href="#alarms" class="mt-md text-primary font-bold text-label-md">Schedule alarm</a>
      </div>
    `;
  }
  
  // Render Upcoming Birthdays horizontal slider
  renderUpcomingBirthdaysList();
}

function getNextScheduledAlarm() {
  if (state.alarms.length === 0) return null;
  const activeAlarms = state.alarms.filter(a => a.active);
  if (activeAlarms.length === 0) return null;
  
  // Sort by time
  return activeAlarms.sort((a, b) => a.time.localeCompare(b.time))[0];
}

function renderUpcomingBirthdaysList() {
  const container = document.getElementById('dash-birthdays-container');
  container.innerHTML = "";
  
  const upcoming = getSortedUpcomingBirthdays();
  
  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="p-md text-center bg-surface-container-low rounded-xl text-on-surface-variant text-label-sm w-full">
        No birthdays added yet.
      </div>
    `;
    return;
  }
  
  upcoming.slice(0, 5).forEach(b => {
    const bCard = document.createElement('div');
    bCard.className = "flex-shrink-0 w-64 bg-surface-container-low rounded-xl p-md border border-surface-container-highest flex items-center gap-md";
    
    // Highlight if birthday is very soon
    let relativeText = getDaysUntilBirthdayString(b.date);
    let relativeClass = "text-on-surface-variant";
    if (relativeText === "Today" || relativeText === "Tomorrow") {
      relativeClass = "text-tertiary font-bold";
    }
    
    bCard.innerHTML = `
      <div class="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
        <span class="material-symbols-outlined">person</span>
      </div>
      <div>
        <h4 class="font-label-md text-label-md text-on-surface truncate max-w-[150px]">${b.name}</h4>
        <p class="font-label-sm text-label-sm ${relativeClass} mt-xs">${relativeText}</p>
      </div>
    `;
    container.appendChild(bCard);
  });
  
  // Add direct link card at the end
  const addBtn = document.createElement('a');
  addBtn.href = "#birthdays";
  addBtn.className = "flex-shrink-0 w-12 h-12 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center text-outline-variant hover:border-primary hover:text-primary transition-colors";
  addBtn.innerHTML = `<span class="material-symbols-outlined">add</span>`;
  container.appendChild(addBtn);
}

// ----------------------------------------------------
// Alarms Page View Render
// ----------------------------------------------------
let alarmEditId = null;

function renderAlarms() {
  const alarmsListContainer = document.getElementById('alarms-list');
  alarmsListContainer.innerHTML = "";
  
  if (state.alarms.length === 0) {
    alarmsListContainer.innerHTML = `
      <div class="col-span-2 text-center p-xl border border-dashed border-outline-variant rounded-xl">
        <span class="material-symbols-outlined text-[48px] text-outline-variant mb-md">alarm_off</span>
        <p class="font-body-md text-body-md text-on-surface-variant">No alarms created yet.</p>
        <button class="mt-md text-primary font-bold text-label-md" onclick="openAlarmModal()">Create alarm</button>
      </div>
    `;
    return;
  }
  
  state.alarms.forEach(alarm => {
    const card = document.createElement('div');
    card.className = `alarm-card bg-surface-container-lowest border border-surface-container p-lg rounded-xl shadow-[0px_4px_20px_rgba(44,62,80,0.05)] flex flex-col gap-md transition-all ${!alarm.active ? 'opacity-70 grayscale-[0.3]' : ''}`;
    
    const timeFormatted = formatTime12h(alarm.time);
    
    const hour = parseInt(alarm.time.split(':')[0]);
    const periodLabel = (hour >= 5 && hour < 18) ? "Morning" : "Night";
    const periodColor = periodLabel === "Morning" ? "bg-primary-container/40 text-primary" : "bg-secondary-container/40 text-secondary";

    // Generate active states for each weekday dot
    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let dotsHtml = "";
    for (let i = 0; i < 7; i++) {
      // Shift mapping so Monday is index 1, Sunday is 0. JS getDay(): 0=Sun, 1=Mon...
      const isActive = alarm.days.includes(i);
      const dotClass = isActive ? "bg-primary text-on-primary font-bold" : "bg-surface-container text-on-surface-variant";
      dotsHtml += `<span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${dotClass}">${weekdays[i]}</span>`;
    }
    
    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <div class="flex items-center gap-xs">
            <span class="font-display-lg text-display-lg text-on-background leading-none">${timeFormatted.time}</span>
            <span class="font-label-md text-label-md text-on-surface-variant uppercase ml-1">${timeFormatted.ampm}</span>
            <span class="ml-md px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${periodColor}">${periodLabel}</span>
          </div>
          <span class="text-xs text-on-surface-variant font-medium block mt-1.5">${alarm.label || 'Alarm'}</span>
          <div class="flex gap-1 mt-md">
            ${dotsHtml}
          </div>
        </div>
        <div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input class="sr-only peer" type="checkbox" ${alarm.active ? 'checked' : ''} onchange="toggleAlarmActive(${alarm.id}, this.checked)" />
            <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>
      <div class="flex items-center justify-between border-t border-surface-container pt-md mt-sm">
        <div class="flex items-center gap-sm bg-secondary-container/30 px-md py-xs rounded-full">
          <span class="material-symbols-outlined text-secondary text-sm">${getMissionIcon(alarm.mission)}</span>
          <span class="font-label-sm text-label-sm text-on-secondary-container capitalize">${alarm.mission} Challenge</span>
        </div>
        <div class="flex gap-sm">
          <button class="p-xs text-on-surface-variant hover:text-primary transition-colors" onclick="editAlarm(${alarm.id})">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button class="p-xs text-on-surface-variant hover:text-error transition-colors" onclick="deleteAlarm(${alarm.id})">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
    `;
    alarmsListContainer.appendChild(card);
  });
}

function toggleAlarmActive(id, activeVal) {
  const alarm = state.alarms.find(a => a.id === id);
  if (alarm) {
    alarm.active = activeVal;
    saveState();
    renderAlarms();
  }
}

function updateHiddenTimeInput() {
  const hourInput = document.getElementById('alarm-hour');
  const minuteInput = document.getElementById('alarm-minute');
  const radioPM = document.getElementById('alarm-period-pm');
  const timeInput = document.getElementById('alarm-time');
  
  if (!hourInput || !minuteInput || !radioPM || !timeInput) return;
  
  let hour = parseInt(hourInput.value);
  let minute = parseInt(minuteInput.value);
  
  if (isNaN(hour) || hour < 1) hour = 1;
  if (hour > 12) hour = 12;
  if (isNaN(minute) || minute < 0) minute = 0;
  if (minute > 59) minute = 59;
  
  hourInput.value = hour;
  minuteInput.value = minute.toString().padStart(2, '0');
  
  const isPM = radioPM.checked;
  let hour24 = hour;
  if (isPM) {
    if (hour < 12) hour24 += 12;
  } else {
    if (hour === 12) hour24 = 0;
  }
  
  const hourStr = hour24.toString().padStart(2, '0');
  const minStr = minute.toString().padStart(2, '0');
  timeInput.value = `${hourStr}:${minStr}`;
}

function updatePeriodButtonsVisual(period) {
  const amBtn = document.getElementById('btn-period-am');
  const pmBtn = document.getElementById('btn-period-pm');
  if (!amBtn || !pmBtn) return;
  
  if (period === 'AM') {
    amBtn.className = "px-3 py-1.5 rounded font-bold text-xs transition-all bg-primary text-white shadow-sm";
    pmBtn.className = "px-3 py-1.5 rounded font-bold text-xs transition-all text-on-surface-variant hover:text-primary";
  } else {
    amBtn.className = "px-3 py-1.5 rounded font-bold text-xs transition-all text-on-surface-variant hover:text-primary";
    pmBtn.className = "px-3 py-1.5 rounded font-bold text-xs transition-all bg-primary text-white shadow-sm";
  }
}

function selectPeriod(period) {
  const amRadio = document.getElementById('alarm-period-am');
  const pmRadio = document.getElementById('alarm-period-pm');
  if (!amRadio || !pmRadio) return;
  
  if (period === 'AM') {
    amRadio.checked = true;
    pmRadio.checked = false;
  } else {
    amRadio.checked = false;
    pmRadio.checked = true;
  }
  
  updatePeriodButtonsVisual(period);
  updateHiddenTimeInput();
  setAlarmPeriodPreset('custom');
}

function setAlarmPeriodPreset(period) {
  const btnMorning = document.getElementById('btn-preset-morning');
  const btnNight = document.getElementById('btn-preset-night');
  const alarmHour = document.getElementById('alarm-hour');
  const alarmMinute = document.getElementById('alarm-minute');
  const radioAM = document.getElementById('alarm-period-am');
  const radioPM = document.getElementById('alarm-period-pm');
  
  if (!btnMorning || !btnNight || !alarmHour || !alarmMinute || !radioAM || !radioPM) return;
  
  if (period === 'morning') {
    alarmHour.value = 7;
    alarmMinute.value = "00";
    radioAM.checked = true;
    radioPM.checked = false;
    updatePeriodButtonsVisual('AM');
    updateHiddenTimeInput();
    
    btnMorning.className = "flex-1 py-2 bg-primary text-white border border-primary font-semibold rounded-lg text-xs hover:bg-opacity-95 transition-all shadow-sm";
    btnNight.className = "flex-1 py-2 bg-transparent text-primary border border-primary font-semibold rounded-lg text-xs hover:bg-primary-container/10 transition-all";
  } else if (period === 'night') {
    alarmHour.value = 10;
    alarmMinute.value = "00";
    radioAM.checked = false;
    radioPM.checked = true;
    updatePeriodButtonsVisual('PM');
    updateHiddenTimeInput();
    
    btnMorning.className = "flex-1 py-2 bg-transparent text-primary border border-primary font-semibold rounded-lg text-xs hover:bg-primary-container/10 transition-all";
    btnNight.className = "flex-1 py-2 bg-primary text-white border border-primary font-semibold rounded-lg text-xs hover:bg-opacity-95 transition-all shadow-sm";
  } else {
    btnMorning.className = "flex-1 py-2 bg-transparent text-primary border border-primary font-semibold rounded-lg text-xs hover:bg-primary-container/10 transition-all";
    btnNight.className = "flex-1 py-2 bg-transparent text-primary border border-primary font-semibold rounded-lg text-xs hover:bg-primary-container/10 transition-all";
  }
}

function openAlarmModal(isEdit = false) {
  const modal = document.getElementById('alarmModal');
  const title = document.getElementById('alarm-modal-title');
  
  if (isEdit) {
    title.innerText = "Edit Alarm";
  } else {
    alarmEditId = null;
    title.innerText = "New Alarm";
    setAlarmPeriodPreset('morning');
    document.getElementById('alarm-mission-select').value = "math";
    document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);
  }
  
  // Connect custom time input change events
  document.getElementById('alarm-hour').oninput = () => {
    updateHiddenTimeInput();
    setAlarmPeriodPreset('custom');
  };
  document.getElementById('alarm-minute').oninput = () => {
    updateHiddenTimeInput();
    setAlarmPeriodPreset('custom');
  };
  document.getElementById('alarm-period-am').onchange = () => {
    updateHiddenTimeInput();
    setAlarmPeriodPreset('custom');
  };
  document.getElementById('alarm-period-pm').onchange = () => {
    updateHiddenTimeInput();
    setAlarmPeriodPreset('custom');
  };

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAlarmModal() {
  const modal = document.getElementById('alarmModal');
  modal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

function editAlarm(id) {
  const alarm = state.alarms.find(a => a.id === id);
  if (!alarm) return;
  
  alarmEditId = id;
  openAlarmModal(true);
  
  const [h24, m] = alarm.time.split(':');
  let hr = parseInt(h24);
  const isPM = hr >= 12;
  hr = hr % 12;
  hr = hr ? hr : 12;
  
  document.getElementById('alarm-hour').value = hr;
  document.getElementById('alarm-minute').value = m;
  if (isPM) {
    document.getElementById('alarm-period-pm').checked = true;
    updatePeriodButtonsVisual('PM');
  } else {
    document.getElementById('alarm-period-am').checked = true;
    updatePeriodButtonsVisual('AM');
  }
  
  document.getElementById('alarm-label').value = alarm.label || "";
  document.getElementById('alarm-mission-select').value = alarm.mission;
  
  updateHiddenTimeInput();
  
  // Highlight correct preset
  if (alarm.time === "07:00") {
    setAlarmPeriodPreset('morning');
  } else if (alarm.time === "22:00") {
    setAlarmPeriodPreset('night');
  } else {
    setAlarmPeriodPreset('custom');
  }

  // Set day checkboxes
  document.querySelectorAll('.day-checkbox').forEach(cb => {
    const val = parseInt(cb.value);
    cb.checked = alarm.days.includes(val);
  });
}

function saveAlarm(event) {
  if (event) event.preventDefault();
  
  const timeVal = document.getElementById('alarm-time').value;
  const labelVal = document.getElementById('alarm-label').value.trim() || "Alarm";
  const missionVal = document.getElementById('alarm-mission-select').value;
  
  // Get checked days
  const checkedDays = [];
  document.querySelectorAll('.day-checkbox').forEach(cb => {
    if (cb.checked) {
      checkedDays.push(parseInt(cb.value));
    }
  });
  
  if (alarmEditId) {
    // Editing
    const alarm = state.alarms.find(a => a.id === alarmEditId);
    if (alarm) {
      alarm.time = timeVal;
      alarm.label = labelVal;
      alarm.mission = missionVal;
      alarm.days = checkedDays;
      alarm.completedToday = false; // Reset completed flag
    }
  } else {
    // New alarm
    const newAlarm = {
      id: Date.now(),
      time: timeVal,
      label: labelVal,
      mission: missionVal,
      days: checkedDays,
      active: true,
      completedToday: false
    };
    state.alarms.push(newAlarm);
  }
  
  saveState();
  closeAlarmModal();
  renderAlarms();
}

function deleteAlarm(id) {
  if (confirm("Are you sure you want to delete this alarm?")) {
    state.alarms = state.alarms.filter(a => a.id !== id);
    saveState();
    renderAlarms();
  }
}

// ----------------------------------------------------
// Birthdays Page View Render
// ----------------------------------------------------
let birthdayEditId = null;

function renderBirthdays() {
  const listContainer = document.getElementById('birthdays-list');
  listContainer.innerHTML = "";
  
  const upcomingThisMonth = getBirthdaysThisMonth();
  const upcomingThisMonthContainer = document.getElementById('birthdays-this-month');
  upcomingThisMonthContainer.innerHTML = "";
  
  // Render Highlight Section (This Month)
  if (upcomingThisMonth.length === 0) {
    upcomingThisMonthContainer.innerHTML = `
      <div class="col-span-full p-lg bg-surface-container-low rounded-xl text-center text-on-surface-variant text-body-md border">
        No upcoming birthdays in the next 30 days.
      </div>
    `;
  } else {
    // Featured upcoming birthday card (first one)
    const featured = upcomingThisMonth[0];
    const daysLeft = getDaysUntilBirthdayVal(featured.date);
    
    const featCard = document.createElement('div');
    featCard.className = "bg-surface-container-lowest border border-surface-container p-lg rounded-xl shadow-[0px_4px_20px_rgba(44,62,80,0.05)] relative overflow-hidden group";
    featCard.innerHTML = `
      <div class="absolute top-0 right-0 p-lg opacity-10 group-hover:opacity-20 transition-opacity">
        <span class="material-symbols-outlined !text-[80px]">cake</span>
      </div>
      <div class="relative z-10">
        <div class="flex justify-between items-start mb-lg">
          <div class="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined">person</span>
          </div>
          <span class="bg-tertiary-container/20 text-on-tertiary-container font-label-sm text-label-sm px-sm py-xs rounded-full">In ${daysLeft} Days</span>
        </div>
        <h4 class="font-headline-md text-headline-md mb-xs">${featured.name}</h4>
        <p class="font-body-md text-body-md text-on-surface-variant">${formatDateString(featured.date)}</p>
      </div>
    `;
    upcomingThisMonthContainer.appendChild(featCard);
    
    // Remaining upcoming birthdays list (max 3)
    const nextList = document.createElement('div');
    nextList.className = "md:col-span-2 bg-surface-container-low p-lg rounded-xl flex flex-col gap-md";
    
    let listItemsHtml = `
      <div class="flex items-center justify-between border-b border-outline-variant/30 pb-sm">
        <span class="font-label-md text-label-md text-on-surface-variant">Name</span>
        <span class="font-label-md text-label-md text-on-surface-variant">Date</span>
      </div>
    `;
    
    upcomingThisMonth.slice(1, 4).forEach(b => {
      const days = getDaysUntilBirthdayVal(b.date);
      listItemsHtml += `
        <div class="flex items-center justify-between group cursor-pointer" onclick="editBirthday(${b.id})">
          <div class="flex items-center gap-md">
            <div class="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
              <span class="material-symbols-outlined">person</span>
            </div>
            <div>
              <p class="font-label-md text-label-md font-bold text-on-surface">${b.name}</p>
              <p class="font-label-sm text-label-sm text-on-surface-variant">${days} days to go</p>
            </div>
          </div>
          <p class="font-label-md text-label-md text-primary">${formatDateShort(b.date)}</p>
        </div>
      `;
    });
    
    if (upcomingThisMonth.length === 1) {
      listItemsHtml += `<p class="text-center text-on-surface-variant text-label-sm py-md">No other upcoming birthdays.</p>`;
    }
    
    nextList.innerHTML = listItemsHtml;
    upcomingThisMonthContainer.appendChild(nextList);
  }
  
  // Render All Reminders list
  if (state.birthdays.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center p-xl border border-dashed border-outline-variant rounded-xl">
        <p class="font-body-md text-body-md text-on-surface-variant">No birthday reminders scheduled.</p>
      </div>
    `;
    return;
  }
  
  // Sort all birthdays by upcoming order
  const allSorted = getSortedBirthdaysAll();
  
  allSorted.forEach(b => {
    const card = document.createElement('div');
    card.className = "bg-surface-container-lowest border border-surface-container p-md rounded-xl flex items-center justify-between hover:border-primary/30 transition-all cursor-pointer";
    card.onclick = () => editBirthday(b.id);
    
    const daysUntil = getDaysUntilBirthdayVal(b.date);
    const dateFormatted = formatDateString(b.date);
    
    card.innerHTML = `
      <div class="flex items-center gap-md">
        <div class="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
          <span class="material-symbols-outlined text-secondary">cake</span>
        </div>
        <div>
          <h5 class="font-label-md text-label-md font-bold">${b.name}</h5>
          <p class="font-label-sm text-label-sm text-on-surface-variant">${dateFormatted}</p>
        </div>
      </div>
      <div class="text-right flex items-center gap-sm">
        <div>
          <p class="font-label-md text-label-md text-on-surface-variant">${daysUntil} days</p>
        </div>
        <span class="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

function openBirthdayModal(isEdit = false) {
  const modal = document.getElementById('birthdayModal');
  const title = document.getElementById('birthday-modal-title');
  
  if (isEdit) {
    title.innerText = "Edit Birthday";
    document.getElementById('b-delete-btn').classList.remove('hidden');
  } else {
    birthdayEditId = null;
    title.innerText = "New Birthday";
    document.getElementById('b-delete-btn').classList.add('hidden');
    // Reset Form
    document.getElementById('b-name').value = "";
    document.getElementById('b-date').value = "";
    document.getElementById('b-notify-week').checked = true;
    document.getElementById('b-notify-day').checked = true;
  }
  
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeBirthdayModal() {
  const modal = document.getElementById('birthdayModal');
  modal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

function editBirthday(id) {
  const birthday = state.birthdays.find(b => b.id === id);
  if (!birthday) return;
  
  birthdayEditId = id;
  openBirthdayModal(true);
  
  document.getElementById('b-name').value = birthday.name;
  document.getElementById('b-date').value = birthday.date;
  document.getElementById('b-notify-week').checked = birthday.notifyWeekBefore;
  document.getElementById('b-notify-day').checked = birthday.notifyDayOf;
}

function saveBirthday(event) {
  if (event) event.preventDefault();
  
  const nameVal = document.getElementById('b-name').value.trim();
  const dateVal = document.getElementById('b-date').value;
  const notifyWeekVal = document.getElementById('b-notify-week').checked;
  const notifyDayVal = document.getElementById('b-notify-day').checked;
  
  if (!nameVal || !dateVal) {
    alert("Please fill in the Name and Date fields.");
    return;
  }
  
  if (birthdayEditId) {
    const b = state.birthdays.find(x => x.id === birthdayEditId);
    if (b) {
      b.name = nameVal;
      b.date = dateVal;
      b.notifyWeekBefore = notifyWeekVal;
      b.notifyDayOf = notifyDayVal;
    }
  } else {
    const newB = {
      id: Date.now(),
      name: nameVal,
      date: dateVal,
      notifyWeekBefore: notifyWeekVal,
      notifyDayOf: notifyDayVal
    };
    state.birthdays.push(newB);
  }
  
  saveState();
  closeBirthdayModal();
  renderBirthdays();
  // Also check birthday triggers immediately to trigger notification if today
  checkBirthdayNotifications();
}

function deleteActiveBirthday() {
  if (birthdayEditId && confirm("Are you sure you want to delete this reminder?")) {
    state.birthdays = state.birthdays.filter(b => b.id !== birthdayEditId);
    saveState();
    closeBirthdayModal();
    renderBirthdays();
  }
}

// ----------------------------------------------------
// Statistics Page View Render
// ----------------------------------------------------
function renderStats() {
  document.getElementById('stats-current-streak').innerText = state.stats.currentStreak;
  document.getElementById('stats-longest-streak').innerText = `${state.stats.longestStreak} Days`;
  document.getElementById('stats-total-completed').innerText = state.stats.totalAlarmsCompleted;
  document.getElementById('stats-missions-solved').innerText = state.stats.totalMissionsSolved;
  
  // Render Heatmap Calendar (Grid representing last 28 days)
  const heatmap = document.getElementById('stats-heatmap');
  heatmap.innerHTML = "";
  
  // Draw last 28 days cells
  const history = state.stats.completionHistory || [];
  
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isCompleted = history.includes(dateStr);
    
    const cell = document.createElement('div');
    cell.className = `heatmap-cell ${isCompleted ? 'bg-primary' : 'bg-surface-variant'} cursor-pointer relative group`;
    cell.title = `${dateStr}: ${isCompleted ? 'Wakeup completed' : 'No record'}`;
    
    // Tiny tooltip overlay on hover
    cell.innerHTML = `
      <div class="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 scale-0 group-hover:scale-100 bg-inverse-surface text-inverse-on-surface text-[10px] py-1 px-2 rounded z-20 whitespace-nowrap transition-transform duration-100">
        ${formatDateShort(dateStr)}: ${isCompleted ? 'Wakeup ✓' : 'No mission'}
      </div>
    `;
    heatmap.appendChild(cell);
  }
}

// ----------------------------------------------------
// Settings & Profile Page View Render
// ----------------------------------------------------
function renderSettings() {
  // Update Profile Info
  document.getElementById('settings-profile-name').innerText = state.auth.user.name;
  document.getElementById('settings-profile-email').innerText = state.auth.user.email;
  document.getElementById('settings-streak-badge').innerText = `Active ${state.stats.currentStreak}d streak`;
  
  const profEl = document.getElementById('settings-profile-profession');
  const purpEl = document.getElementById('settings-profile-purpose');
  if (profEl) profEl.innerText = state.auth.user.profession || "Software Engineer";
  if (purpEl) purpEl.innerText = `Wake-up: ${state.auth.user.purpose || "Gym / Workout"}`;
  
  // Update UI Inputs to match settings state
  document.getElementById('settings-difficulty').value = state.settings.difficulty || 'medium';
  document.getElementById('settings-snooze-duration').value = state.settings.snoozeDuration || 5;
  document.getElementById('settings-volume').value = state.settings.volume || 80;
  document.getElementById('settings-volume-value').innerText = `${state.settings.volume || 80}%`;
  
  // Dark mode toggle visual state
  const html = document.documentElement;
  const toggleBtn = document.getElementById('settings-theme-toggle');
  
  if (state.settings.darkMode) {
    html.classList.add('dark');
    toggleBtn.innerHTML = '<span class="material-symbols-outlined">light_mode</span>';
    toggleBtn.className = "p-sm rounded-full bg-on-surface-variant text-surface-bright hover:opacity-90 transition-all duration-200";
  } else {
    html.classList.remove('dark');
    toggleBtn.innerHTML = '<span class="material-symbols-outlined">dark_mode</span>';
    toggleBtn.className = "p-sm rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-variant transition-all duration-200";
  }
}

function handleDifficultyChange(val) {
  state.settings.difficulty = val;
  saveState();
}

function handleSnoozeChange(val) {
  state.settings.snoozeDuration = parseInt(val);
  saveState();
}

function handleVolumeChange(val) {
  state.settings.volume = parseInt(val);
  document.getElementById('settings-volume-value').innerText = `${val}%`;
  saveState();
  
  // Play short chime to test audio volume level dynamically
  playVolumeTestTone();
}

let volTestTimeout = null;
function playVolumeTestTone() {
  if (volTestTimeout) clearTimeout(volTestTimeout);
  volTestTimeout = setTimeout(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      const vol = (state.settings.volume / 100) * 0.15;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e){}
  }, 250);
}

function toggleThemeMode() {
  state.settings.darkMode = !state.settings.darkMode;
  saveState();
  renderSettings();
}

// ----------------------------------------------------
// Authentication Handlers (Mock)
// ----------------------------------------------------
function handleLogin(event) {
  if (event) event.preventDefault();
  
  const email = document.getElementById('login-email').value.trim();
  const name = document.getElementById('login-name').value.trim() || "Julian Sterling";
  
  if (!email) {
    alert("Please enter a valid email address.");
    return;
  }
  
  state.auth.loggedIn = true;
  state.auth.user.name = name;
  state.auth.user.email = email;
  
  const professionEl = document.getElementById('login-profession');
  const purposeEl = document.getElementById('login-purpose');
  if (professionEl) state.auth.user.profession = professionEl.value;
  if (purposeEl) state.auth.user.purpose = purposeEl.value;

  saveState();
  
  // Initialize notifications trigger permission
  requestNotificationPermission();
  
  window.location.hash = '#dashboard';
}

function handleLogout() {
  if (confirm("Are you sure you want to log out?")) {
    state.auth.loggedIn = false;
    saveState();
    window.location.hash = '#auth';
  }
}

// ----------------------------------------------------
// PWA Local Notifications & Birthday Checker
// ----------------------------------------------------
function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}

function checkBirthdayNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();
  
  state.birthdays.forEach(b => {
    const bDate = new Date(b.date);
    const bMonth = bDate.getMonth();
    const bDay = bDate.getDate();
    
    // Check if birthday is today
    if (b.notifyDayOf && todayMonth === bMonth && todayDate === bDay) {
      const lastNotifyKey = `bday_notify_${b.id}_${today.getFullYear()}`;
      if (!localStorage.getItem(lastNotifyKey)) {
        new Notification("Up7 Birthday Reminder 🎉", {
          body: `Today is ${b.name}'s Birthday! Wish them a happy day.`,
          icon: 'app_icon.png'
        });
        localStorage.setItem(lastNotifyKey, 'true');
      }
    }
    
    // Check if birthday is 7 days from now
    if (b.notifyWeekBefore) {
      const oneWeekLater = new Date();
      oneWeekLater.setDate(today.getDate() + 7);
      if (oneWeekLater.getMonth() === bMonth && oneWeekLater.getDate() === bDay) {
        const lastNotifyKey = `bday_notify_week_${b.id}_${today.getFullYear()}`;
        if (!localStorage.getItem(lastNotifyKey)) {
          new Notification("Up7 Birthday Reminder 🎁", {
            body: `${b.name}'s Birthday is in 1 week (${formatDateShort(b.date)})! Get ready.`,
            icon: 'app_icon.png'
          });
          localStorage.setItem(lastNotifyKey, 'true');
        }
      }
    }
  });
}

// Check every hour for upcoming birthdays
setInterval(checkBirthdayNotifications, 3600 * 1000);

// ----------------------------------------------------
// Utility Functions
// ----------------------------------------------------
function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatTime12h(timeString) {
  const [hourStr, minStr] = timeString.split(':');
  let hour = parseInt(hourStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // 0 should be 12
  return {
    time: `${hour}:${minStr}`,
    ampm: ampm
  };
}

function getDaysShortString(daysArray) {
  if (daysArray.length === 0) return "One-time";
  if (daysArray.length === 7) return "Every day";
  if (daysArray.length === 5 && !daysArray.includes(0) && !daysArray.includes(6)) return "Weekdays";
  if (daysArray.length === 2 && daysArray.includes(0) && daysArray.includes(6)) return "Weekends";
  
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return daysArray.map(d => names[d]).join(', ');
}

function getMissionIcon(mission) {
  const icons = {
    math: 'calculate',
    qr: 'qr_code_scanner',
    step: 'directions_walk',
    random: 'bolt'
  };
  return icons[mission] || 'alarm';
}

function getSortedUpcomingBirthdays() {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  return [...state.birthdays].sort((a, b) => {
    return getDaysUntilBirthdayVal(a.date) - getDaysUntilBirthdayVal(b.date);
  });
}

function getSortedBirthdaysAll() {
  return [...state.birthdays].sort((a, b) => {
    return getDaysUntilBirthdayVal(a.date) - getDaysUntilBirthdayVal(b.date);
  });
}

function getBirthdaysThisMonth() {
  // Birthdays within the next 30 days
  return state.birthdays.filter(b => {
    const days = getDaysUntilBirthdayVal(b.date);
    return days >= 0 && days <= 30;
  }).sort((a, b) => getDaysUntilBirthdayVal(a.date) - getDaysUntilBirthdayVal(b.date));
}

function getDaysUntilBirthdayVal(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const bdate = new Date(dateStr);
  const currentYear = today.getFullYear();
  
  // Set birthday to this year
  bdate.setFullYear(currentYear);
  if (bdate < today) {
    bdate.setFullYear(currentYear + 1);
  }
  
  const diffTime = Math.abs(bdate - today);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) % 365;
}

function getDaysUntilBirthdayString(dateStr) {
  const days = getDaysUntilBirthdayVal(dateStr);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === 7) return "In 1 Week";
  return `In ${days} Days`;
}

function formatDateString(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ----------------------------------------------------
// Task Reminders Logic & Tab Routing
// ----------------------------------------------------
let taskEditId = null;

function showReminderTab(tab) {
  const bSection = document.getElementById('reminders-birthdays-section');
  const tSection = document.getElementById('reminders-tasks-section');
  const bTab = document.getElementById('btn-tab-birthdays');
  const tTab = document.getElementById('btn-tab-tasks');
  const bBtn = document.getElementById('bday-header-btn');
  const tBtn = document.getElementById('task-header-btn');
  
  if (tab === 'birthdays') {
    bSection.classList.remove('hidden');
    tSection.classList.add('hidden');
    bTab.className = "font-bold text-body-lg text-primary border-b-2 border-primary pb-xs focus:outline-none";
    tTab.className = "font-bold text-body-lg text-on-surface-variant hover:text-primary pb-xs transition-colors focus:outline-none";
    bBtn.classList.remove('hidden');
    tBtn.classList.add('hidden');
    renderBirthdays();
  } else {
    bSection.classList.add('hidden');
    tSection.classList.remove('hidden');
    bTab.className = "font-bold text-body-lg text-on-surface-variant hover:text-primary pb-xs transition-colors focus:outline-none";
    tTab.className = "font-bold text-body-lg text-primary border-b-2 border-primary pb-xs focus:outline-none";
    bBtn.classList.add('hidden');
    tBtn.classList.remove('hidden');
    renderTasks();
  }
}

function openTaskModal(isEdit = false) {
  const modal = document.getElementById('taskModal');
  const title = document.getElementById('task-modal-title');
  
  if (isEdit) {
    title.innerText = "Edit Task Reminder";
    document.getElementById('task-delete-btn').classList.remove('hidden');
  } else {
    taskEditId = null;
    title.innerText = "New Task Reminder";
    document.getElementById('task-delete-btn').classList.add('hidden');
    // Reset Form
    document.getElementById('task-title').value = "";
    document.getElementById('task-date').value = getTodayDateString();
    document.getElementById('task-time').value = "12:00";
  }
  
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeTaskModal() {
  const modal = document.getElementById('taskModal');
  modal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

function saveTask(event) {
  if (event) event.preventDefault();
  
  const titleVal = document.getElementById('task-title').value.trim();
  const dateVal = document.getElementById('task-date').value;
  const timeVal = document.getElementById('task-time').value;
  
  if (!titleVal || !dateVal || !timeVal) {
    alert("Please fill in all fields.");
    return;
  }
  
  if (taskEditId) {
    const t = state.tasks.find(x => x.id === taskEditId);
    if (t) {
      t.title = titleVal;
      t.date = dateVal;
      t.time = timeVal;
      t.notified = false; // Reset status on edit
    }
  } else {
    const newT = {
      id: Date.now(),
      title: titleVal,
      date: dateVal,
      time: timeVal,
      notified: false
    };
    state.tasks.push(newT);
  }
  
  saveState();
  closeTaskModal();
  renderTasks();
  const hash = window.location.hash.substring(1) || 'dashboard';
  if (hash === 'dashboard') renderDashboard();
}

function deleteActiveTask() {
  if (taskEditId && confirm("Are you sure you want to delete this task reminder?")) {
    state.tasks = state.tasks.filter(t => t.id !== taskEditId);
    saveState();
    closeTaskModal();
    renderTasks();
    const hash = window.location.hash.substring(1) || 'dashboard';
    if (hash === 'dashboard') renderDashboard();
  }
}

function editTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  taskEditId = id;
  openTaskModal(true);
  
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-date').value = task.date;
  document.getElementById('task-time').value = task.time;
}

function renderTasks() {
  const listContainer = document.getElementById('tasks-list');
  if (!listContainer) return;
  listContainer.innerHTML = "";
  
  state.tasks = state.tasks || [];
  
  if (state.tasks.length === 0) {
    listContainer.innerHTML = `
      <div class="col-span-full text-center p-xl border border-dashed border-outline-variant rounded-xl bg-surface-container-lowest dark:bg-slate-800">
        <p class="font-body-md text-body-md text-on-surface-variant">No custom task reminders configured.</p>
      </div>
    `;
    return;
  }
  
  // Sort tasks by date and time
  const sortedTasks = [...state.tasks].sort((a, b) => {
    const datetimeA = `${a.date}T${a.time}`;
    const datetimeB = `${b.date}T${b.time}`;
    return datetimeA.localeCompare(datetimeB);
  });
  
  sortedTasks.forEach(t => {
    const card = document.createElement('div');
    card.className = `p-md border rounded-xl flex items-center justify-between hover:border-primary/30 transition-all cursor-pointer bg-surface-container-lowest dark:bg-slate-800 border-outline-variant dark:border-slate-700 ${t.notified ? 'opacity-60' : ''}`;
    card.onclick = () => editTask(t.id);
    
    card.innerHTML = `
      <div class="flex items-center gap-md">
        <div class="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
          <span class="material-symbols-outlined">notifications_active</span>
        </div>
        <div>
          <h5 class="font-bold text-label-md">${t.title}</h5>
          <p class="text-xs text-on-surface-variant">${formatDateShort(t.date)} • ${formatTime12h(t.time).time} ${formatTime12h(t.time).ampm}</p>
        </div>
      </div>
      <div class="text-right flex items-center gap-sm">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${t.notified ? 'bg-secondary-container text-secondary' : 'bg-primary-container text-primary'}">
          ${t.notified ? 'Sent' : 'Pending'}
        </span>
        <span class="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

function checkTaskReminders() {
  if (!state.auth.loggedIn) return;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  state.tasks = state.tasks || [];
  let updated = false;
  
  state.tasks.forEach(task => {
    if (!task.notified && task.date === todayStr && task.time === currentTimeStr) {
      task.notified = true;
      updated = true;
      
      // Trigger Web Push Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("Up7 Reminder 🎯", {
          body: task.title,
          icon: 'app_icon.png'
        });
      } else {
        alert(`Up7 Reminder: ${task.title}`);
      }
    }
  });
  
  if (updated) {
    saveState();
    
    // Auto refresh active views
    const hash = window.location.hash.substring(1) || 'dashboard';
    if (hash === 'dashboard') renderDashboard();
    if (hash === 'birthdays') {
      renderBirthdays();
      renderTasks();
    }
  }
}

// ----------------------------------------------------
// Startup Initialization & PWA Install Prompter
// ----------------------------------------------------
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Show the install button/banner container
  const installContainer = document.getElementById('pwa-install-container');
  if (installContainer) {
    installContainer.classList.remove('hidden');
    installContainer.classList.add('flex');
  }
});

function handleInstallPWAClick() {
  try {
    if (!deferredPrompt) {
      alert("App is running, but browser install prompt is not ready yet. Please try again in 2-3 seconds, or click the Install icon directly in your Chrome URL bar (computer screen icon) / browser menu.");
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        const installContainer = document.getElementById('pwa-install-container');
        if (installContainer) {
          installContainer.classList.add('hidden');
          installContainer.classList.remove('flex');
        }
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
    }).catch(err => {
      alert("Error processing PWA installation choice: " + err.message);
    });
  } catch (e) {
    alert("An exception occurred while trying to trigger install: " + e.message);
  }
}

// Hide install banner if already in standalone app mode
window.addEventListener('DOMContentLoaded', () => {
  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log("Service Worker registration failed", err);
    });
  }
  
  // Setup standard routing
  const initialHash = window.location.hash.substring(1) || 'dashboard';
  navigateTo(initialHash);
  
  // Start checking alarms every second
  startAlarmChecking();
  
  // Check notifications on initial load
  checkBirthdayNotifications();
  
  // Check theme on startup
  if (state.settings.darkMode) {
    document.documentElement.classList.add('dark');
  }

  // Check if running in PWA standalone display mode
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    const installContainer = document.getElementById('pwa-install-container');
    if (installContainer) {
      installContainer.classList.add('hidden');
      installContainer.classList.remove('flex');
    }
  }
});
