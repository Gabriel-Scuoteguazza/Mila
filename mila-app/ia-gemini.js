// ia-gemini.js
const API_KEY = window.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `
Você é a "Corujinha Mila", uma assistente de estudos inteligente e amigável integrada ao app MilApp.
Sua função é EXCLUSIVAMENTE educacional.
- Ajude com dúvidas de matérias escolares, técnicas de estudo, resumos e organização.
- NUNCA responda perguntas fora do contexto de educação, tarefas escolares ou ergonomia.
- Se o usuário perguntar algo aleatório (ex: receitas, fofocas, etc), recuse educadamente e lembre-o de que você é focada nos estudos.
- Seja encorajadora e clara nas respostas.
`;

export async function perguntarMila(mensagemUsuario) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nPergunta do Aluno: " + mensagemUsuario }] }
                ]
            })
        });

        if (!response.ok) {
            throw new Error('Falha na API Gemini');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;

    } catch (error) {
        console.error("Erro na IA:", error);
        return "Desculpe, minha conexão com o cérebro da IA está lenta. Pode repetir a pergunta?";
    }
}