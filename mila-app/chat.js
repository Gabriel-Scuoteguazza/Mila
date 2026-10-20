// chat.js - Versão Definitiva
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `
Você é a "Corujinha Mila", uma assistente de estudos inteligente e motivadora.
Sua diretriz principal é ser EXCLUSIVAMENTE EDUCACIONAL.
- Ajude com dúvidas de matérias, resumos, técnicas de estudo e organização.
- NUNCA responda perguntas fora do contexto de educação.
- Seja clara, encorajadora e use no máximo 3 parágrafos.

REGRA DE FORMATAÇÃO CRÍTICA:
- Escreva em texto puro. 
- NUNCA utilize asteriscos (**) para negrito.
- NUNCA utilize cifrões ($) ou barras invertidas (\) para fórmulas matemáticas (LaTeX).
- Escreva equações de forma simples, por exemplo: "cos(x + 127°)" em vez de "\(\cos(x + 127^\circ)\)".
`;

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const historyList = document.getElementById('historyList');

let chatHistory = [];
let currentChatId = null;
const STORAGE_KEY = 'mila_chat_history';

// --- HISTÓRICO ---
function loadHistoryFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) chatHistory = JSON.parse(stored);
    } catch (e) { chatHistory = []; }
    renderHistorySidebar();
}

function saveHistoryToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory)); } catch (e) {}
}

function renderHistorySidebar() {
    historyList.innerHTML = '';
    if (chatHistory.length === 0) {
        historyList.innerHTML = '<p style="font-size:10px; color:var(--text-muted); text-align:center; margin-top:20px;">Nenhuma conversa anterior.</p>';
        return;
    }
    [...chatHistory].reverse().forEach(chat => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const userMsg = chat.messages.find(m => m.role === 'user');
        const title = userMsg ? userMsg.text : 'Nova conversa';
        div.innerHTML = `<h4>${title}</h4><p>${chat.date}</p>`;
        div.onclick = () => loadChat(chat.id);
        historyList.appendChild(div);
    });
}

window.startNewChat = function() {
    currentChatId = null;
    chatMessages.innerHTML = `
        <div class="message ai-message">
            <div class="message-content">
                Olá! Sou a Corujinha Mila. 🦉 Estou aqui para te ajudar com dúvidas de matérias, resumos e técnicas de estudo. O que vamos aprender hoje?
            </div>
        </div>
    `;
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
};

function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;
    currentChatId = chatId;
    chatMessages.innerHTML = '';
    chat.messages.forEach(msg => appendMessageToDOM(msg.role === 'user' ? 'user' : 'ai', msg.text, false));
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

// --- MENSAGENS ---
function appendMessageToDOM(role, text, saveToHistory = true) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerHTML = text.replace(/\n/g, '<br>');
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (saveToHistory) {
        if (!currentChatId) {
            currentChatId = Date.now().toString();
            chatHistory.push({ id: currentChatId, date: new Date().toLocaleString('pt-BR'), messages: [] });
        }
        const currentChat = chatHistory.find(c => c.id === currentChatId);
        if (currentChat) {
            currentChat.messages.push({ role, text });
            saveHistoryToStorage();
            renderHistorySidebar();
        }
    }
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'ai-message');
    loadingDiv.id = 'loading-msg';
    loadingDiv.innerHTML = `<div class="message-content"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- CHAMADA À API ---
async function sendMessage() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    chatInput.value = '';
    sendBtn.disabled = true;

    appendMessageToDOM('user', userText, true);
    showLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nPergunta do Aluno: " + userText }] }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error("Erro da API:", err);
            throw new Error(err.error?.message || "Falha na API");
        }

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;

        document.getElementById('loading-msg').remove();
        appendMessageToDOM('ai', aiText, true);

    } catch (error) {
        console.error("Erro na IA:", error);
        document.getElementById('loading-msg').remove();
        appendMessageToDOM('ai', "Erro: " + error.message, true);
    } finally {
        sendBtn.disabled = false;
        chatInput.focus();
    }
}

// --- INICIALIZAÇÃO E VERIFICAÇÃO DA URL ---
document.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromStorage();

    // Verifica se há uma pergunta na URL (vinda do microfone ou pesquisa)
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');

    if (queryParam) {
        // Se veio algo, cria um chat novo e preenche
        window.startNewChat(); 

        // Preenche o input
        if(chatInput) {
            chatInput.value = queryParam;
            chatInput.focus();

            // Feedback visual
            if(window.showToast) window.showToast('🎤 Texto transcrito! Pressione Enter para enviar.');
        }

        // Limpa a URL para não recarregar a pergunta se o usuário der F5
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        // Se não veio nada, só carrega a tela inicial normal
        window.startNewChat();
    }
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });