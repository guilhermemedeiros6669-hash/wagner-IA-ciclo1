import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Lazy-initialize Gemini client
let aiClient = null;
function getAIClient() {
  let apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey && fs.existsSync(path.join(__dirname, '.env'))) {
    try {
      const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
      const match = envContent.match(/^GEMINI_API_KEY=(.*)$/m);
      if (match && match[1]) {
        apiKey = match[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch (_) {}
  }
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const SQUAD_G_SUPPORT_PROMPT = `
Você é o Assistente Oficial do Squad G (equipe de desenvolvimento web da FICR).

INFORMAÇÕES CHAVE DO SQUAD G:
- Integrantes: Amanda Ramos (HTML/Acessibilidade/Formulários), Guilherme Henrique (Frontend/Autenticação/UX), Aylton Oliveira (CSS/Flexbox/Navegação), Diógenes José (CSS3/UI/Design System).
- Projetos: Portal de Acesso (Amanda), Autenticação Responsiva (Guilherme), Navegação Web (Aylton), Design System CSS (Diógenes), Case Alpha Corp (redução de 40% em custos).
- Planos: Start (R$ 899 - landing page e SEO), Pro (R$ 1.899 - até 5 páginas), Enterprise (R$ 3.499 - sob medida).
- Habilidades: HTML5, CSS3, JavaScript ES6+, Git/GitHub, Metodologias Ágeis.
- Contato: Pelo formulário no site ou redes sociais da equipe.

DIRETRIZES DE RESPOSTA (OBRIGATÓRIO):
- RESPOSTAS CURTAS E RESUMIDAS: Limite sua resposta a no máximo 2 a 4 frases diretas ou tópicos curtos (máximo 40 a 60 palavras).
- Seja objetivo e vá direto ao ponto solicitado, sem introduções prolixas, enrolação ou despedidas longas.
- Use negrito (**termo**) nas palavras-chave para leitura rápida.
- Mantenha o tom profissional, amigável e conciso.
`;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat API endpoint for Gemini Support AI
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fallback inteligente conciso baseado na base de conhecimento local
function generateLocalKnowledgeReply(userMessage) {
  const msg = (userMessage || '').toLowerCase();

  if (msg.includes('projeto') || msg.includes('trabalho') || msg.includes('portfolio') || msg.includes('portfólio')) {
    return `Projetos do **Squad G**:
* **Portal de Acesso**: formulários acessíveis (Amanda);
* **Autenticação Responsiva**: interface e UX (Guilherme);
* **Navegação & Busca Web**: layout ágil em Flexbox (Aylton);
* **Design System CSS**: componentes e padrões visuais (Diógenes).
Confira detalhes na aba **Projetos**!`;
  }

  if (msg.includes('integrante') || msg.includes('equipe') || msg.includes('membro') || msg.includes('quem é') || msg.includes('quem sao') || msg.includes('quem são')) {
    return `Integrantes do **Squad G**:
* **Amanda Ramos**: Frontend, HTML e acessibilidade;
* **Guilherme Henrique**: Frontend, lógica e UX;
* **Aylton Oliveira**: Frontend, CSS e layout responsivo;
* **Diógenes José**: UI Designer e Design System.
Saiba mais na aba **Sobre Nós**!`;
  }

  if (msg.includes('preço') || msg.includes('preco') || msg.includes('quanto custa') || msg.includes('plano') || msg.includes('valor') || msg.includes('serviço') || msg.includes('servico')) {
    return `Nossos planos de desenvolvimento:
* **Start (R$ 899)**: Landing page responsiva e SEO;
* **Pro (R$ 1.899)**: Website de até 5 páginas;
* **Enterprise (R$ 3.499)**: Solução completa sob medida.
Consulte mais detalhes na aba **Serviços**!`;
  }

  if (msg.includes('contato') || msg.includes('falar') || msg.includes('contratar') || msg.includes('email') || msg.includes('e-mail') || msg.includes('mensagem')) {
    return `Para falar com o **Squad G**:
* Envie mensagem pela aba **Contato**;
* Acesse as redes sociais da equipe (LinkedIn, Instagram);
* Solicite um orçamento na aba **Serviços**.`;
  }

  if (msg.includes('habilidade') || msg.includes('tecnologia') || msg.includes('linguagem') || msg.includes('stack')) {
    return `Stack do **Squad G**:
* **HTML5 Semântico** e acessibilidade;
* **CSS3 Avançado** (Flexbox, Grid e animações);
* **JavaScript ES6+** e consumo de APIs;
* **Git/GitHub** e Scrum.
Veja níveis técnicos na aba **Habilidades**!`;
  }

  return `Olá! Posso te ajudar com:
* **Projetos** dos integrantes;
* **Equipe** e especialidades;
* **Planos & Preços** (Start, Pro, Enterprise);
* **Contato** e contratação.
Como posso ajudar?`;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida ou não fornecida.' });
    }

    const ai = getAIClient();
    if (!ai) {
      // Sem chave de API: responde com a base de conhecimento local
      const localReply = generateLocalKnowledgeReply(message);
      return res.json({ reply: localReply });
    }

    // Construção de histórico multi-turn seguro
    const contents = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item && item.text && typeof item.text === 'string') {
          contents.push({
            role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.text }]
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    let reply = null;
    let lastError = null;

    // Tentar modelos recomendados com fallback em cascata e tratamento de 503/429
    for (const modelName of GEMINI_MODELS) {
      try {
        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SQUAD_G_SUPPORT_PROMPT,
            maxOutputTokens: 200,
            temperature: 0.3
          }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout de 6s com ${modelName}`)), 6000)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);

        if (response && response.text) {
          reply = response.text;
          break;
        }
      } catch (err) {
        lastError = err;
        const errStr = String(err && (err.message || err.status || ''));
        const isUnavailable = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand') || errStr.includes('429');
        
        console.warn(`Tentativa com ${modelName} falhou (${err.status || 'erro'}): ${err.message || err}. Tentando próximo modelo...`);
        
        if (isUnavailable) {
          await sleep(250); // Breve espera antes do próximo modelo
        }
      }
    }

    // Se todos os modelos do Gemini falharam ou estão indisponíveis temporariamente (503 alta demanda), usar fallback local inteligente
    if (!reply) {
      console.warn('Modelos Gemini indisponíveis temporariamente. Acionando fallback da base de conhecimento do Squad G.');
      reply = generateLocalKnowledgeReply(message);
    }

    res.json({ reply });
  } catch (err) {
    console.error('Erro no processamento do chat:', err);
    // Mesmo em exceção inesperada, nunca deixar o usuário desassistido
    const fallbackReply = generateLocalKnowledgeReply(req.body?.message || '');
    res.json({ reply: fallbackReply });
  }
});

const squadDir = path.join(__dirname, 'squads', 'squad-G');

// Root route: serve home.html
app.get('/', (req, res) => {
  res.sendFile(path.join(squadDir, 'home.html'));
});

// Case-insensitive & hyphen/space alias resolver for static assets
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const rawPath = decodeURIComponent(req.path.replace(/^\/squads\/squad-G/, ''));
  const fullPath = path.join(squadDir, rawPath);
  
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return res.sendFile(fullPath);
  }
  
  const dirName = path.dirname(fullPath);
  const baseName = path.basename(fullPath).toLowerCase();
  const normalizedBase = baseName.replace(/[-_ ]/g, '');
  
  if (fs.existsSync(dirName)) {
    try {
      const files = fs.readdirSync(dirName);
      const match = files.find(f => {
        const fLower = f.toLowerCase();
        return fLower === baseName || fLower.replace(/[-_ ]/g, '') === normalizedBase;
      });
      if (match) {
        return res.sendFile(path.join(dirName, match));
      }
    } catch {
      // ignore
    }
  }
  next();
});

// Standard static serving for squad-G
app.use(express.static(squadDir));
app.use('/squads/squad-G', express.static(squadDir));

// Fallback to home.html for unknown HTML navigation
app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    const requestedFile = path.join(squadDir, req.path);
    if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
      return res.sendFile(requestedFile);
    }
    return res.sendFile(path.join(squadDir, 'home.html'));
  }
  next();
});

app.listen(PORT, HOST, () => {
  console.log(`Squad G server running on http://${HOST}:${PORT}`);
});
