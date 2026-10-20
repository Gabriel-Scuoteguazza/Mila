import { database, auth } from './firebase-config.js';
import { ref, onValue, set, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let currentUserData = null;
let recognition = null;
let isListening = false;
let currentMoodDate = new Date(); 

// --- UTILITÁRIOS ---
window.showToast = function(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
};

window.navigateTo = function(screenId) {
    if (!currentUser && screenId !== 'mila-auth') return showToast('🔒 Faça login.');
    document.querySelectorAll('.mila-screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('flex');
        target.classList.remove('screen-transition');
        void target.offsetWidth;
        target.classList.add('screen-transition');
    }
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.replace('text-milaNeonGreen', 'text-milaTextMuted'));
    const activeNav = document.getElementById('nav-' + screenId);
    if (activeNav) activeNav.classList.replace('text-milaTextMuted', 'text-milaNeonGreen');

    if (screenId === 'mila-perfil') renderMoodCalendar();
    if (screenId === 'mila-agenda') renderNotes();
};

// --- AUTENTICAÇÃO ---
window.switchAuthTab = function(tab) {
    document.getElementById('tabLoginBtn').className = tab === 'login' ? "flex-1 py-2 rounded-lg bg-milaNeonGreen text-milaBgDark font-bold" : "flex-1 py-2 rounded-lg text-slate-400";
    document.getElementById('tabRegisterBtn').className = tab === 'register' ? "flex-1 py-2 rounded-lg bg-milaNeonGreen text-milaBgDark font-bold" : "flex-1 py-2 rounded-lg text-slate-400";
    document.getElementById('formLogin').classList.toggle('hidden', tab !== 'login');
    document.getElementById('formRegister').classList.toggle('hidden', tab !== 'register');
};

window.handleUserAuth = async function(event, type) {
    event.preventDefault();
    const btn = type === 'login' ? document.getElementById('loginBtn') : document.getElementById('registerBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span>';

    const email = type === 'login' ? document.getElementById('loginEmail').value : document.getElementById('regEmail').value;
    const password = type === 'login' ? document.getElementById('loginPassword').value : document.getElementById('regPassword').value;

    try {
        if (type === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const name = document.getElementById('regName').value;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const initialData = {
                user: { name, email, avatarUrl: '', bio: '', xp: 0, streak: 1, lastLogin: new Date().toISOString() },
                tasks: [], notes: {}, searchHistory: [], moods: {}
            };
            await set(ref(database, `usuarios/${user.uid}`), initialData);
        }
    } catch (error) {
        showToast('❌ Erro: ' + error.message);
        btn.innerHTML = originalHTML;
    }
};

window.handleLogout = () => signOut(auth);

// --- OBSERVADOR DE ESTADO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('bottomNav').classList.remove('hidden');
        document.getElementById('mila-auth').classList.add('hidden');

        const snap = await get(ref(database, `usuarios/${user.uid}`));
        if (snap.exists()) {
            currentUserData = snap.val();

            const today = new Date().toISOString().split('T')[0];
            const lastLogin = currentUserData.user.lastLogin ? currentUserData.user.lastLogin.split('T')[0] : null;
            let streak = currentUserData.user.streak || 0;

            if (lastLogin !== today) {
                const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                streak = (lastLogin === yesterday.toISOString().split('T')[0]) ? streak + 1 : 1;
                await update(ref(database, `usuarios/${user.uid}/user`), { streak, lastLogin: new Date().toISOString() });
                currentUserData.user.streak = streak;
            }

            updateUI();
            loadSensors();
            renderTasks();
            renderNotes();
            renderSearchHistory();

            const todayMood = currentUserData.moods ? currentUserData.moods[today] : null;
            if (todayMood) updateMoodIcon(todayMood);
        }
    } else {
        currentUser = null;
        document.getElementById('bottomNav').classList.add('hidden');
        document.getElementById('mila-auth').classList.remove('hidden');
    }
});

function updateUI() {
    if (!currentUserData) return;
    const u = currentUserData.user;

    document.getElementById('userNameDisplay').innerText = u.name;
    document.getElementById('profileName').innerText = u.name;
    document.getElementById('profileEmail').innerText = u.email;
    document.getElementById('userStreak').innerText = u.streak || 1;
    document.getElementById('userLevelBadge').innerText = `Nível ${Math.floor((u.xp || 0) / 300) + 1}`;
    document.getElementById('dashBioDisplay').innerText = u.bio || "Sua bio aparecerá aqui...";
    document.getElementById('profileBioText').innerText = `"${u.bio || 'Sem bio definida.'}"`;
    if(document.getElementById('profileBioInput')) document.getElementById('profileBioInput').value = u.bio || '';

    if (u.avatarUrl) {
        document.getElementById('dashAvatarImg').src = u.avatarUrl;
        document.getElementById('dashAvatarImg').classList.remove('hidden');
        document.getElementById('dashAvatarIcon').classList.add('hidden');
        document.getElementById('profileAvatarImg').src = u.avatarUrl;
        document.getElementById('profileAvatarImg').classList.remove('hidden');
        document.getElementById('profileAvatarIcon').classList.add('hidden');
    }
}

// --- LÓGICA DE HUMOR ---
window.recordMood = async function(mood) {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const moods = currentUserData.moods || {};
    moods[today] = mood;
    await update(ref(database, `usuarios/${currentUser.uid}`), { moods });
    currentUserData.moods = moods;
    updateMoodIcon(mood);
    showToast(`😊 Humor registrado: ${mood}`);
    if(document.getElementById('mila-perfil').classList.contains('hidden') === false) renderMoodCalendar();
};

function updateMoodIcon(mood) {
    const iconEl = document.getElementById('dashMoodIcon');
    if (!iconEl) return;
    if (mood === 'Excelente') { iconEl.innerHTML = '🚀'; iconEl.className = 'text-lg'; }
    else if (mood === 'Normal') { iconEl.innerHTML = '😐'; iconEl.className = 'text-lg'; }
    else if (mood === 'Cansado') { iconEl.innerHTML = '💤'; iconEl.className = 'text-lg'; }
    else { iconEl.className = 'hidden'; }
}

window.changeMoodMonth = function(offset) {
    currentMoodDate.setMonth(currentMoodDate.getMonth() + offset);
    renderMoodCalendar();
};

function renderMoodCalendar() {
    const grid = document.getElementById('moodCalendarGrid');
    const label = document.getElementById('moodMonthLabel');
    if (!grid || !label) return;

    const dayHeaders = Array.from(grid.children).slice(0, 7);
    grid.innerHTML = '';
    dayHeaders.forEach(h => grid.appendChild(h));

    const year = currentMoodDate.getFullYear();
    const month = currentMoodDate.getMonth();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    label.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const moods = currentUserData.moods || {};

    for (let i = 0; i < firstDay; i++) grid.innerHTML += `<span></span>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const mood = moods[dateStr];

        let bgClass = "bg-milaBgDark/40";
        if (mood === 'Excelente') bgClass = "bg-emerald-500/80 text-milaBgDark font-bold shadow-neon-green";
        if (mood === 'Normal') bgClass = "bg-amber-500/80 text-milaBgDark font-bold shadow-[0_0_10px_rgba(245,158,11,0.5)]";
        if (mood === 'Cansado') bgClass = "bg-rose-500/80 text-white font-bold shadow-[0_0_10px_rgba(244,63,94,0.5)]";

        grid.innerHTML += `<div class="w-6 h-6 mx-auto rounded-full flex items-center justify-center ${bgClass}">${day}</div>`;
    }
}

// --- PERFIL ---
window.uploadAvatar = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result;
        await update(ref(database, `usuarios/${currentUser.uid}/user`), { avatarUrl: base64Image });
        currentUserData.user.avatarUrl = base64Image;
        updateUI();
        showToast('📸 Foto atualizada!');
    };
    reader.readAsDataURL(file);
};

window.saveProfileBio = async function() {
    const bio = document.getElementById('profileBioInput').value;
    await update(ref(database, `usuarios/${currentUser.uid}/user`), { bio });
    currentUserData.user.bio = bio;
    updateUI();
    showToast('💾 Bio salva!');
};

// --- CRUD TAREFAS ---
function renderTasks() {
    const container = document.getElementById('taskListContainer');
    if (!container) return;
    container.innerHTML = '';
    const tasks = currentUserData.tasks || [];
    document.getElementById('dashTaskCount').innerText = `${tasks.filter(t => !t.done).length} matérias ativas`;

    tasks.forEach(task => {
        container.innerHTML += `
            <div class="p-3.5 rounded-xl border flex items-center justify-between ${task.done ? 'bg-milaBgDark/60 border-milaBorder/40 opacity-60' : 'bg-milaBgCard/60 border-milaBorder/60'}">
                <div class="flex items-center gap-3">
                    <button onclick="toggleTask('${task.id}')" class="w-6 h-6 rounded-full border-2 border-milaNeonGreen flex items-center justify-center ${task.done ? 'bg-milaNeonGreen text-milaBgDark' : 'text-transparent'}">
                        <i class="ph ph-check text-xs"></i>
                    </button>
                    <div>
                        <h5 class="text-xs font-bold text-white ${task.done ? 'line-through' : ''}">${task.title}</h5>
                        <p class="text-[10px] text-milaTextMuted mt-0.5">${task.time || ''}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editTask('${task.id}')" class="text-slate-400 hover:text-milaNeonGreen"><i class="ph ph-pencil-simple"></i></button>
                    <button onclick="deleteTask('${task.id}')" class="text-slate-400 hover:text-rose-400"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
    });
}

window.openAddTaskModal = () => {
    document.getElementById('modalTaskTitle').innerText = "Nova Matéria";
    document.getElementById('editTaskId').value = "";
    document.getElementById('newTaskTitle').value = "";
    document.getElementById('newTaskTime').value = "";
    document.getElementById('addTaskModal').classList.remove('hidden');
};

window.editTask = function(id) {
    const task = currentUserData.tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('modalTaskTitle').innerText = "Editar Matéria";
    document.getElementById('editTaskId').value = id;
    document.getElementById('newTaskTitle').value = task.title;
    document.getElementById('newTaskTime').value = task.time || "";
    document.getElementById('addTaskModal').classList.remove('hidden');
};

window.closeAddTaskModal = () => document.getElementById('addTaskModal').classList.add('hidden');

window.saveNewTask = async function() {
    const id = document.getElementById('editTaskId').value;
    const title = document.getElementById('newTaskTitle').value;
    const time = document.getElementById('newTaskTime').value;
    if (!title) return showToast('Digite o nome da matéria.');

    if (id) {
        currentUserData.tasks = currentUserData.tasks.map(t => t.id === id ? { ...t, title, time } : t);
    } else {
        const newTask = { id: Date.now().toString(), title, time, done: false };
        currentUserData.tasks = [...(currentUserData.tasks || []), newTask];
    }

    await update(ref(database, `usuarios/${currentUser.uid}`), { tasks: currentUserData.tasks });
    closeAddTaskModal();
    renderTasks();
    showToast('✅ Matéria salva!');
};

window.toggleTask = async function(id) {
    const tasks = currentUserData.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    await update(ref(database, `usuarios/${currentUser.uid}`), { tasks });
    currentUserData.tasks = tasks;
    renderTasks();
};

window.deleteTask = async function(id) {
    const tasks = currentUserData.tasks.filter(t => t.id !== id);
    await update(ref(database, `usuarios/${currentUser.uid}`), { tasks });
    currentUserData.tasks = tasks;
    renderTasks();
};

// --- CRUD NOTAS (BLOG) - VERSÃO CORRIGIDA ---
window.addNewNote = async function() {
    const titleInput = document.getElementById('noteTitleInput');
    const contentInput = document.getElementById('noteContentInput');

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !content) return showToast('⚠️ Preencha o título e o conteúdo.');

    try {
        const notesRef = ref(database, `usuarios/${currentUser.uid}/notes`);
        const newNoteId = Date.now().toString();
        const newNote = { id: newNoteId, title: title, content: content, date: new Date().toLocaleDateString('pt-BR') };

        currentUserData.notes = { ...(currentUserData.notes || {}), [newNoteId]: newNote };

        await update(ref(database, `usuarios/${currentUser.uid}`), { notes: currentUserData.notes });

        titleInput.value = '';
        contentInput.value = '';

        renderNotes();
        showToast('✅ Postagem publicada!');
    } catch (error) {
        console.error(error);
        showToast('❌ Erro ao salvar.');
    }
};

function renderNotes() {
    const list = document.getElementById('notesHistoryList');
    if (!list) return;
    list.innerHTML = '';

    const notesObj = currentUserData.notes || {};
    const notesArray = Object.values(notesObj);

    if (notesArray.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 border border-dashed border-milaBorder/50 rounded-xl bg-milaBgDark/30">
                <i class="ph ph-article text-3xl text-milaTextMuted mb-2 opacity-50"></i>
                <p class="text-[11px] text-milaTextMuted">Nenhuma anotação publicada ainda.</p>
            </div>`;
        return;
    }

    notesArray.sort((a, b) => b.id - a.id);

    notesArray.forEach(note => {
        list.innerHTML += `
            <div class="bg-[#160e2e] border border-milaBorder/40 rounded-2xl overflow-hidden shadow-lg group transition-all hover:border-milaNeonGreen/40 relative mb-3">
                <div class="p-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[9px] font-bold bg-milaPurple/20 text-milaPurple px-2 py-1 rounded-full border border-milaPurple/30 uppercase tracking-wider">
                            Anotação
                        </span>
                        <span class="text-[10px] text-milaTextMuted flex items-center gap-1">
                            <i class="ph ph-calendar-blank"></i> ${note.date}
                        </span>
                    </div>

                    <h3 class="text-sm font-bold text-white mb-2 leading-tight">${note.title}</h3>
                    <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">${note.content}</p>

                    <div class="mt-3 pt-3 border-t border-milaBorder/30 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onclick="editNote('${note.id}')" class="text-slate-400 hover:text-milaNeonGreen flex items-center gap-1 text-[10px] font-bold bg-milaBgDark px-2 py-1 rounded border border-milaBorder/50">
                            <i class="ph ph-pencil-simple"></i> Editar
                        </button>
                        <button onclick="deleteNote('${note.id}')" class="text-slate-400 hover:text-rose-400 flex items-center gap-1 text-[10px] font-bold bg-milaBgDark px-2 py-1 rounded border border-milaBorder/50">
                            <i class="ph ph-trash"></i> Apagar
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

window.editNote = function(id) {
    const note = currentUserData.notes[id];
    if (!note) return;

    document.getElementById('editNoteId').value = id;
    document.getElementById('editNoteTitle').value = note.title;
    document.getElementById('editNoteText').value = note.content;

    document.getElementById('editNoteModal').classList.remove('hidden');
};

window.updateNote = async function() {
    const id = document.getElementById('editNoteId').value;
    const newTitle = document.getElementById('editNoteTitle').value.trim();
    const newContent = document.getElementById('editNoteText').value.trim();

    if (!newTitle || !newContent) return showToast('Preencha todos os campos.');

    currentUserData.notes[id] = { ...currentUserData.notes[id], title: newTitle, content: newContent };

    await update(ref(database, `usuarios/${currentUser.uid}`), { notes: currentUserData.notes });
    document.getElementById('editNoteModal').classList.add('hidden');
    renderNotes();
    showToast('✅ Postagem atualizada!');
};

window.deleteNote = async function(id) {
    delete currentUserData.notes[id];
    await update(ref(database, `usuarios/${currentUser.uid}`), { notes: currentUserData.notes });
    renderNotes();
};

// --- SENSORES ---
function loadSensors() {
    onValue(ref(database, 'resumos_diarios'), (snapshot) => {
        const data = snapshot.val();
        const chartEl = document.getElementById('sensorChart');
        const statusEl = document.getElementById('sensorStatus');

        if (data) {
            const dates = Object.keys(data).sort().reverse(); 
            if (dates.length > 0) {
                const latest = data[dates[0]];

                document.getElementById('sensorForca').innerText = latest.media_forca || '--';
                document.getElementById('sensorLuz').innerText = latest.media_luminosidade || '--';
                document.getElementById('sensorTemp').innerText = (latest.media_temperatura_c || '--') + ' °C';
                document.getElementById('sensorUmid').innerText = (latest.media_umidade_pct || '--') + ' %';

                document.getElementById('sensorPostura').innerText = latest.media_postura ? latest.media_postura + '°' : '--';

                statusEl.innerText = latest.presenca_recente ? "Mesa Ativa" : "Mesa Ausente";
                statusEl.className = latest.presenca_recente ? "text-emerald-400 font-bold font-mono text-sm bg-milaBgDark/80 px-5 py-2.5 rounded-xl border border-milaNeonGreen/30 shadow-neon-green" : "text-rose-400 font-bold font-mono text-sm bg-milaBgDark/80 px-5 py-2.5 rounded-xl border border-rose-500/30";

                chartEl.innerHTML = '';
                dates.slice(0, 7).reverse().forEach(date => {
                    const dayData = data[date];
                    const valorBase = dayData.media_forca || 0;
                    const heightPercent = Math.min((valorBase / 1000) * 100, 100); 

                    chartEl.innerHTML += `
                        <div class="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div class="w-full bg-milaNeonGreen rounded-t opacity-80 hover:opacity-100 transition-all" style="height: ${heightPercent}%">
                                <span class="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] bg-milaBgCard text-white px-1 rounded opacity-0 group-hover:opacity-100">${valorBase}</span>
                            </div>
                            <span class="text-[7px] text-milaTextMuted mt-1">${date.split('-').slice(1).join('/')}</span>
                        </div>
                    `;
                });
            }
        }
    });
}

// --- MICROFONE ---
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        document.getElementById('voiceStatusText').innerText = "🎤 Escutando...";
        document.getElementById('voiceStatusText').classList.add('text-amber-400');
        document.getElementById('micPulseRing').classList.remove('hidden');
        document.getElementById('soundWaveContainer').classList.remove('opacity-30');
    };

    recognition.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('voiceTranscript').innerText = `"${text}"`;

        setTimeout(() => {
            window.location.href = `chat.html?q=${encodeURIComponent(text)}`;
        }, 1500);
    };

    recognition.onend = () => {
        isListening = false;
        document.getElementById('voiceStatusText').innerText = "Toque para falar com a Mila...";
        document.getElementById('voiceStatusText').classList.remove('text-amber-400');
        document.getElementById('micPulseRing').classList.add('hidden');
        document.getElementById('soundWaveContainer').classList.add('opacity-30');
    };
}

window.toggleVoiceAssistant = () => {
    if (!recognition) return showToast('Seu navegador não suporta gravação de voz.');
    if (isListening) recognition.stop();
    else recognition.start();
};

window.goToChat = async function() {
    const query = document.getElementById('searchQueryInput').value.trim();
    if (!query) return showToast('Digite algo para pesquisar.');

    const newSearch = { id: Date.now().toString(), query, date: new Date().toLocaleString() };
    const history = [...(currentUserData.searchHistory || []), newSearch];
    await update(ref(database, `usuarios/${currentUser.uid}`), { searchHistory: history });
    currentUserData.searchHistory = history;
    renderSearchHistory();

    window.location.href = `chat.html?q=${encodeURIComponent(query)}`;
};

function renderSearchHistory() {
    const list = document.getElementById('searchHistoryList');
    if (!list) return;
    list.innerHTML = '';
    (currentUserData.searchHistory || []).reverse().slice(0, 5).forEach(item => {
        list.innerHTML += `
            <div onclick="window.location.href='chat.html?q=${encodeURIComponent(item.query)}'" class="p-3 bg-milaBgCard/60 border border-milaBorder/50 rounded-xl cursor-pointer hover:border-milaNeonGreen/50">
                <h5 class="text-xs font-bold text-white">${item.query}</h5>
                <p class="text-[9px] text-milaTextMuted mt-0.5">${item.date}</p>
            </div>`;
    });
}

// --- POMODORO PERSONALIZÁVEL ---
let pomodoroInterval = null;
let pomodoroMinutes = 25;
let pomodoroSeconds = 25 * 60;
let pomodoroRunning = false;

window.changePomodoroTime = function(change) {
    if (pomodoroRunning) return showToast('Pause o timer para alterar.');
    pomodoroMinutes += change;
    if (pomodoroMinutes < 5) pomodoroMinutes = 5;
    if (pomodoroMinutes > 60) pomodoroMinutes = 60;
    pomodoroSeconds = pomodoroMinutes * 60;
    document.getElementById('pomodoroMode').innerText = `${pomodoroMinutes} min`;
    document.getElementById('pomodoroDisplay').innerText = `${String(pomodoroMinutes).padStart(2, '0')}:00`;
};

window.togglePomodoro = () => {
    const btn = document.getElementById('btnPomodoroStart');
    if (!pomodoroRunning) {
        pomodoroRunning = true;
        btn.innerText = "Pausar";
        btn.className = "py-2 px-6 bg-amber-400 text-milaBgDark font-bold text-xs rounded-xl shadow-neon-green btn-hover-glow";
        pomodoroInterval = setInterval(() => {
            if (pomodoroSeconds > 0) {
                pomodoroSeconds--;
                document.getElementById('pomodoroDisplay').innerText = `${Math.floor(pomodoroSeconds/60).toString().padStart(2, '0')}:${(pomodoroSeconds%60).toString().padStart(2, '0')}`;
            } else {
                clearInterval(pomodoroInterval); pomodoroRunning = false; btn.innerText = "Iniciar";
                btn.className = "py-2 px-6 bg-milaNeonGreen text-milaBgDark font-bold text-xs rounded-xl shadow-neon-green btn-hover-glow";
                showToast('⏰ Tempo de estudo concluído!');
            }
        }, 1000);
    } else {
        pomodoroRunning = false; clearInterval(pomodoroInterval);
        btn.innerText = "Continuar"; btn.className = "py-2 px-6 bg-milaNeonGreen text-milaBgDark font-bold text-xs rounded-xl shadow-neon-green btn-hover-glow";
    }
};

window.resetPomodoro = () => {
    clearInterval(pomodoroInterval); pomodoroRunning = false; pomodoroSeconds = pomodoroMinutes * 60;
    document.getElementById('pomodoroDisplay').innerText = `${String(pomodoroMinutes).padStart(2, '0')}:00`;
    const btn = document.getElementById('btnPomodoroStart');
    btn.innerText = "Iniciar"; btn.className = "py-2 px-6 bg-milaNeonGreen text-milaBgDark font-bold text-xs rounded-xl shadow-neon-green btn-hover-glow";
};

// --- OUTRAS FUNÇÕES ---
window.startPostureCamera = async function() {
    const video = document.getElementById('postureWebcam'); const placeholder = document.getElementById('camPlaceholder');
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); video.srcObject = stream; video.classList.remove('hidden'); placeholder.classList.add('hidden'); } 
    catch (err) { showToast('📷 Câmera indisponível.'); }
};