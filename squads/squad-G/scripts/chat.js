document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("ai-chat-toggle");
  const closeBtn = document.getElementById("ai-chat-close");
  const resetBtn = document.getElementById("ai-chat-reset");
  const chatBox = document.getElementById("ai-chat-box");
  const chatForm = document.getElementById("ai-chat-form");
  const chatInput = document.getElementById("ai-chat-input");
  const submitBtn = chatForm ? chatForm.querySelector("button[type='submit']") : null;
  const messagesContainer = document.getElementById("ai-chat-messages");
  const quickSuggestions = document.getElementById("ai-chat-quick-suggestions");

  // Histórico da conversa para contexto multi-turn
  let conversationHistory = [];

  // Alternar visibilidade da janela de chat
  if (toggleBtn && chatBox) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = chatBox.classList.contains("hidden");
      if (isHidden) {
        chatBox.classList.remove("hidden");
        toggleBtn.setAttribute("aria-expanded", "true");
        if (chatInput) chatInput.focus();
        scrollToBottom();
      } else {
        chatBox.classList.add("hidden");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (closeBtn && chatBox) {
    closeBtn.addEventListener("click", () => {
      chatBox.classList.add("hidden");
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
      if (toggleBtn) toggleBtn.focus();
    });
  }

  // Tecla Escape fecha chat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && chatBox && !chatBox.classList.contains("hidden")) {
      chatBox.classList.add("hidden");
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.focus();
      }
    }
  });

  // Limpar conversa
  if (resetBtn && messagesContainer) {
    resetBtn.addEventListener("click", () => {
      conversationHistory = [];
      messagesContainer.innerHTML = `
        <div class="message ai-message">
          <p>Olá! Sou o <strong>assistente de suporte do Squad G</strong>. Como posso te ajudar com nossos projetos, serviços ou equipe hoje?</p>
        </div>
      `;
      if (quickSuggestions) quickSuggestions.style.display = "flex";
      scrollToBottom();
    });
  }

  // Tratamento de cliques em chips de sugestão rápida
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".suggestion-chip");
    if (chip) {
      const prompt = chip.getAttribute("data-prompt") || chip.textContent.trim();
      handleUserSendMessage(prompt);
    }
  });

  // Envio de formulário de chat
  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const messageText = chatInput.value.trim();
      if (!messageText) return;
      handleUserSendMessage(messageText);
    });
  }

  async function handleUserSendMessage(messageText) {
    if (!messageText) return;

    // Ocultar sugestões rápidas após primeira interação
    if (quickSuggestions) {
      quickSuggestions.style.display = "none";
    }

    // 1. Exibe a mensagem do usuário
    appendMessage(messageText, "user-message");
    if (chatInput) chatInput.value = "";
    
    // Desabilitar botão durante requisição
    if (submitBtn) submitBtn.disabled = true;

    // 2. Exibe indicador animado de "digitando..."
    const typingIndicator = appendTypingIndicator();
    scrollToBottom();

    // 3. Consulta o endpoint backend do Gemini com histórico
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history: conversationHistory
        })
      });

      const data = await response.json();
      const reply = data.reply || "Desculpe, não consegui obter uma resposta no momento.";

      // 4. Salvar histórico
      conversationHistory.push({ role: "user", text: messageText });
      conversationHistory.push({ role: "model", text: reply });
      if (conversationHistory.length > 10) {
        conversationHistory = conversationHistory.slice(-10);
      }

      // 5. Remove o indicador e renderiza a resposta da IA
      if (typingIndicator) typingIndicator.remove();
      appendAiMessage(reply);
    } catch (err) {
      console.error("Erro no chat de suporte:", err);
      if (typingIndicator) typingIndicator.remove();
      appendMessage("Desculpe, ocorreu um erro de conexão com o suporte do Squad G. Verifique sua conexão e tente novamente.", "ai-message");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (chatInput) chatInput.focus();
      scrollToBottom();
    }
  }

  function appendMessage(text, className) {
    if (!messagesContainer) return null;
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${className}`;
    const p = document.createElement("p");
    p.textContent = text;
    msgDiv.appendChild(p);
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
  }

  function appendAiMessage(rawText) {
    if (!messagesContainer) return null;
    const msgDiv = document.createElement("div");
    msgDiv.className = "message ai-message";

    // Formatar markdown simples: negrito e listas com marcadores
    const formattedHtml = formatMarkdown(rawText);
    msgDiv.innerHTML = formattedHtml;

    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
  }

  function appendTypingIndicator() {
    if (!messagesContainer) return null;
    const msgDiv = document.createElement("div");
    msgDiv.className = "message ai-message typing";
    msgDiv.innerHTML = `
      <span style="font-size:0.8rem; color:#64748b; margin-right:4px;">Squad G pensando</span>
      <div class="typing-dots">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
  }

  function formatMarkdown(text) {
    if (!text) return "";
    
    // Escapar caracteres perigosos mantendo segurança básica
    let safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Converter negrito: **texto** para <strong>texto</strong>
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Converter itens de lista: * item ou - item
    const lines = safe.split("\n");
    let inList = false;
    const outputLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        if (!inList) {
          outputLines.push("<ul>");
          inList = true;
        }
        outputLines.push(`<li>${trimmed.substring(2)}</li>`);
      } else {
        if (inList) {
          outputLines.push("</ul>");
          inList = false;
        }
        if (trimmed.length > 0) {
          outputLines.push(`<p>${trimmed}</p>`);
        }
      }
    }
    if (inList) {
      outputLines.push("</ul>");
    }

    return outputLines.join("");
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
});
