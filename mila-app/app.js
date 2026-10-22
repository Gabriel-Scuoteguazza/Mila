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

// --- CRUD NOTAS (BLOG) ---
window.addNewNote = async function() {
    const titleInput = document.getElementById('noteTitleInput');
    const contentInput = document.getElementById('noteContentInput');

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !content) return showToast('⚠️ Preencha o título e o conteúdo.');

    try {
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

// --- SENSORES E GRÁFICOS CARROSSEL ---
let sensorDataCache = []; 
let currentChartIndex = 0; 

const chartConfigs = [
    { key: 'media_postura', label: 'Postura', icon: 'ph-person-arms-spread', color: 'bg-emerald-400', unit: '%' },
    { key: 'media_luminosidade', label: 'Luminosidade', icon: 'ph-sun', color: 'bg-amber-400', unit: '%' },
    { key: 'media_estresse', label: 'Estresse', icon: 'ph-brain', color: 'bg-rose-400', unit: '%' },
    { key: 'media_forca', label: 'Força', icon: 'ph-hand-pressing', color: 'bg-blue-400', unit: '' },
    { key: 'media_temperatura_c', label: 'Temperatura', icon: 'ph-thermometer-hot', color: 'bg-orange-400', unit: '°C' }
];

function getPosturaLabel(val) {
    if (val <= 40) return "Incorreta / Ruim";
    if (val <= 79) return "Atenção / Normal";
    return "Perfeita / Bom";
}

function getLuzLabel(val) {
    if (val <= 30) return "Escuro / Ruim";
    if (val <= 70) return "Adequado / Normal";
    return "Muito Claro / Ótimo";
}

function getEstresseLabel(val) {
    if (val <= 30) return "Calmo / Relaxado";
    if (val <= 70) return "Moderado / Atenção";
    return "Alerta / Estressado";
}

function getCameraLabel(val) {
    if (val == 1) return "Atento / Focado";
    if (val == 2) return "Distraído / Celular";
    if (val == 3) return "Ausente / Fora";
    return "Desconhecido";
}

function loadSensors() {
    // 1. DADOS EM TEMPO REAL (Status Atual)
    onValue(ref(database, 'status_atual_postura'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const posturaVal = data.postura || data.media_postura || 0;
            const estresseVal = data.estresse || data.media_estresse || 0;
            const forcaVal = data.forca || data.media_forca || 0;
            const statusCam = data.foco || data.status_camera;

            if(document.getElementById('sensorPostura')) {
                document.getElementById('sensorPostura').innerText = posturaVal + '%';
                document.getElementById('sensorPosturaLabel').innerText = getPosturaLabel(parseFloat(posturaVal));
            }
            if(document.getElementById('sensorEstresse')) {
                document.getElementById('sensorEstresse').innerText = estresseVal + '%';
                document.getElementById('sensorEstresseLabel').innerText = getEstresseLabel(parseFloat(estresseVal));
            }
            if(document.getElementById('sensorForca')) {
                document.getElementById('sensorForca').innerText = forcaVal;
            }

            if (statusCam) {
                const labelEl = document.getElementById('statusCameraLabel');
                if (labelEl) {
                    labelEl.innerText = getCameraLabel(statusCam);
                    if (statusCam == 1) labelEl.className = "text-xs font-bold text-emerald-400 px-3 py-1 bg-emerald-500/20 rounded-lg border border-emerald-500/30";
                    else if (statusCam == 2) labelEl.className = "text-xs font-bold text-amber-400 px-3 py-1 bg-amber-500/20 rounded-lg border border-amber-500/30";
                    else if (statusCam == 3) labelEl.className = "text-xs font-bold text-rose-400 px-3 py-1 bg-rose-500/20 rounded-lg border border-rose-500/30";
                }
            }
        }
    });

    // 2. HISTÓRICO DIÁRIO (Gráficos e Cards de Luz/Temp)
    onValue(ref(database, 'resumos_diarios'), (snapshot) => {
        const data = snapshot.val();
        const statusEl = document.getElementById('sensorStatus');

        if (data) {
            const dates = Object.keys(data).sort().reverse(); 
            if (dates.length > 0) {
                const latest = data[dates[0]];

                // Atualiza os cards de Luz e Temperatura
                const luzVal = latest.media_luminosidade || latest.luminosidade || 0;
                if(document.getElementById('sensorLuz')) {
                    document.getElementById('sensorLuz').innerText = luzVal + '%';
                    document.getElementById('sensorLuzLabel').innerText = getLuzLabel(parseFloat(luzVal));
                }
                if(document.getElementById('sensorTemp')) {
                    document.getElementById('sensorTemp').innerText = (latest.media_temperatura_c || latest.temperatura || '--') + ' °C';
                }

                if(statusEl) {
                    statusEl.innerText = "Mesa Conectada";
                    statusEl.className = "text-emerald-400 font-bold font-mono text-sm bg-milaBgDark/80 px-5 py-2.5 rounded-xl border border-milaNeonGreen/30 shadow-neon-green";
                }

                // Alimenta o gráfico
                sensorDataCache = dates.slice(0, 7).reverse().map(date => {
                    return { 
                        date: date.split('-').slice(1).join('/'), 
                        ...data[date] 
                    };
                });

                renderChart();
            }
        } else {
            if(statusEl) {
                statusEl.innerText = "Aguardando dados...";
                statusEl.className = "text-amber-400 font-bold font-mono text-sm bg-milaBgDark/80 px-5 py-2.5 rounded-xl border border-amber-500/30";
            }
        }
    });
}

window.changeChart = function(direction) {
    currentChartIndex += direction;
    if (currentChartIndex < 0) currentChartIndex = chartConfigs.length - 1;
    if (currentChartIndex >= chartConfigs.length) currentChartIndex = 0;
    renderChart();
};

function renderChart() {
    const chartEl = document.getElementById('sensorChart');
    const titleEl = document.getElementById('chartTitle');
    const dotsContainer = document.getElementById('chartDots');

    if (!chartEl || !titleEl || !dotsContainer) return;

    const config = chartConfigs[currentChartIndex];

    titleEl.innerHTML = `<i class="ph ${config.icon} text-milaNeonGreen text-base"></i> Histórico: ${config.label}`;

    Array.from(dotsContainer.children).forEach((dot, index) => {
        dot.className = index === currentChartIndex ? `w-1.5 h-1.5 rounded-full ${config.color}` : 'w-1.5 h-1.5 rounded-full bg-milaBorder';
    });

    chartEl.style.opacity = '0';
    setTimeout(() => {
        chartEl.innerHTML = '';

        if (sensorDataCache.length === 0) {
            chartEl.innerHTML = '<div class="text-center w-full text-milaTextMuted text-[10px] pt-10">Sem dados recentes.</div>';
            chartEl.style.opacity = '1';
            return;
        }

        // Converte os valores para número e encontra o máximo real
        const valores = sensorDataCache.map(d => {
            let v = d[config.key] || d[config.key.replace('media_', '')]; 
            if (typeof v === 'string') {
                v = parseFloat(v.replace('%', '').replace('°C', '').replace(',', '.')); 
            }
            return isNaN(v) ? 0 : v;
        });

        const maxVal = Math.max(...valores, 1); 

        sensorDataCache.forEach((dayData, index) => {
            const val = valores[index];

            let heightPercent = (val / maxVal) * 100;
            if (heightPercent > 100) heightPercent = 100;
            if (heightPercent < 5) heightPercent = 5;

            chartEl.innerHTML += `
                <div class="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div class="w-full ${config.color} rounded-t opacity-80 hover:opacity-100 transition-all duration-300 relative" style="height: ${heightPercent}%">
                        <span class="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] bg-milaBgCard text-white px-1.5 py-0.5 rounded border border-milaBorder opacity-0 group-hover:opacity-100 z-10 whitespace-nowrap shadow-md">
                            ${val}${config.unit}
                        </span>
                    </div>
                    <span class="text-[7px] text-milaTextMuted mt-1">${dayData.date}</span>
                </div>
            `;
        });
        chartEl.style.opacity = '1';
    }, 150); 
}

// --- RELATÓRIO PDF ---
window.gerarRelatorioPDF = function() {
    if (sensorDataCache.length === 0) {
        return showToast('⚠️ Sem dados suficientes para gerar o relatório.');
    }

    if (!window.jspdf) {
        return showToast('⚠️ Erro: Biblioteca de PDF não carregada.');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(11, 7, 23); 
    doc.rect(0, 0, 210, 297, 'F');

    doc.setTextColor(0, 255, 157); 
    doc.setFontSize(22);
    doc.text("Relatório Semanal MILA", 105, 20, null, null, "center");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`Aluno: ${currentUserData.user.name}`, 15, 35);
    doc.text(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, 15, 42);

    const tableData = sensorDataCache.map(d => [
        d.date,
        d.media_postura ? d.media_postura + '%' : '--',
        d.media_luminosidade ? d.media_luminosidade + '%' : '--',
        d.media_estresse ? d.media_estresse + '%' : '--',
        d.media_temperatura_c ? d.media_temperatura_c + '°C' : '--'
    ]);

    doc.autoTable({
        startY: 55,
        head: [['Data', 'Postura', 'Luz', 'Estresse', 'Temp']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [168, 85, 247], textColor: 255 }, 
        styles: { fillColor: [22, 14, 46], textColor: 255, fontSize: 10 }, 
        alternateRowStyles: { fillColor: [35, 24, 69] }
    });

    doc.setFontSize(10);
    doc.setTextColor(154, 142, 184);
    doc.text("Gerado automaticamente pelo aplicativo Mila.", 105, doc.internal.pageSize.height - 10, null, null, "center");

    doc.save(`Relatorio_Mila_${new Date().getTime()}.pdf`);
    showToast('✅ Relatório baixado!');
};

// --- CÂMERA ---
window.startPostureCamera = async function() {
    const video = document.getElementById('postureWebcam'); 
    const placeholder = document.getElementById('camPlaceholder');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return showToast('❌ Seu navegador não suporta acesso à câmera.');
    }

    try { 
        const constraints = { 
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false 
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints); 

        if (video) {
            video.srcObject = stream; 
            video.classList.remove('hidden'); 
            video.onloadedmetadata = () => { video.play(); };
        }

        if (placeholder) placeholder.classList.add('hidden'); 
        showToast('📸 Câmera ativada com sucesso!');

        if (currentUser) {
            update(ref(database, `usuarios/${currentUser.uid}/user`), { cameraStatus: 'Ativa' });
        }

    } catch (err) { 
        console.error("Erro detalhado da câmera:", err.name, err.message);
        let msg = '📷 Câmera indisponível.';
        if (err.name === 'NotAllowedError') msg = '📷 Permissão negada. Verifique o cadeado na barra de endereços.';
        if (err.name === 'NotFoundError') msg = '📷 Nenhuma câmera encontrada.';
        if (err.name === 'NotReadableError') msg = '📷 A câmera está em uso por outro app.';
        showToast(msg); 
    }
};

// --- MICROFONE ---
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        const statusEl = document.getElementById('voiceStatusText');
        if(statusEl) {
            statusEl.innerText = "🎤 Escutando...";
            statusEl.classList.add('text-amber-400');
        }
        const ringEl = document.getElementById('micPulseRing');
        if(ringEl) ringEl.classList.remove('hidden');
        const waveEl = document.getElementById('soundWaveContainer');
        if(waveEl) waveEl.classList.remove('opacity-30');
    };

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const transcriptEl = document.getElementById('voiceTranscript');
        if(transcriptEl) transcriptEl.innerText = `"${text}"`;
        showToast('✅ Áudio capturado! Abrindo chat...');

        setTimeout(() => {
            window.location.href = `chat.html?q=${encodeURIComponent(text)}&autoSend=true`;
        }, 1500);
    };

    recognition.onerror = (event) => {
        console.error("Erro no microfone:", event.error);
        showToast('❌ Erro no microfone. Permita o acesso nas configurações do navegador.');
        isListening = false;
    };

    recognition.onend = () => {
        isListening = false;
        const statusEl = document.getElementById('voiceStatusText');
        if(statusEl) {
            statusEl.innerText = "Toque para falar com a Mila...";
            statusEl.classList.remove('text-amber-400');
        }
        const ringEl = document.getElementById('micPulseRing');
        if(ringEl) ringEl.classList.add('hidden');
        const waveEl = document.getElementById('soundWaveContainer');
        if(waveEl) waveEl.classList.add('opacity-30');
    };
}

window.toggleVoiceAssistant = () => {
    if (!recognition) return showToast('Seu navegador não suporta gravação de voz.');
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        })
        .catch((err) => {
            console.error(err);
            showToast('🎤 Permissão de microfone negada. Verifique as configurações do navegador.');
        });
};