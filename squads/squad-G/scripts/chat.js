document.addEventListener("DOMContentLoaded", () => {
    // Configurações da API do Google Gemini
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
    const toggleBtn = document.getElementById("ai-chat-toggle");
    const closeBtn = document.getElementById("ai-chat-close");
    const chatBox = document.getElementById("ai-chat-box");
    const chatForm = document.getElementById("ai-chat-form");
    const chatInput = document.getElementById("ai-chat-input");
    const messagesContainer = document.getElementById("ai-chat-messages");
  
    // Abrir e fechar a janela do chat
    if (toggleBtn && closeBtn && chatBox) {
      toggleBtn.addEventListener("click", () => chatBox.classList.toggle("hidden"));
      closeBtn.addEventListener("click", () => chatBox.classList.add("hidden"));
    }
  
    // Função para chamar a API do Gemini
    async function fetchGeminiResponse(userPrompt) {
      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: "Você é o assistente virtual inteligente do Squad G (equipe de desenvolvimento de software da FICR). Responda com clareza, simpatia e concisão em português do Brasil."
            }
          ]
        }
      };
  
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
  
        if (!response.ok) {
          throw new Error(`Erro na API: ${response.status}`);
        }
  
        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
        return replyText || "Desculpe, não consegui processar sua resposta no momento.";
      } catch (error) {
        console.error("Erro ao conectar com a API do Gemini:", error);
        return "Desculpe, ocorreu um erro ao se comunicar com a IA. Verifique sua chave de API ou conexão.";
      }
    }
  
    // Envio de mensagens
    if (chatForm) {
      chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        if (!messageText) return;
  
        // 1. Exibe a mensagem do usuário
        appendMessage(messageText, "user-message");
        chatInput.value = "";
  
        // 2. Exibe indicador de "digitando..."
        const typingIndicator = appendMessage("Pensando...", "ai-message typing");
  
        // 3. Busca a resposta real da API do Gemini
        const aiResponse = await fetchGeminiResponse(messageText);
  
        // 4. Remove o indicador e adiciona a resposta final
        if (typingIndicator) typingIndicator.remove();
        appendMessage(aiResponse, "ai-message");
      });
    }
  
    function appendMessage(text, className) {
      const msgDiv = document.createElement("div");
      msgDiv.className = `message ${className}`;
      
      const p = document.createElement("p");
      p.textContent = text;
      
      msgDiv.appendChild(p);
      messagesContainer.appendChild(msgDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      return msgDiv;
    }
  });