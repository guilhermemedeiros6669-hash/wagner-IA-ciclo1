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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat API endpoint for Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida ou não fornecida.' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.json({
        reply: 'Olá! Sou o assistente virtual do Squad G. Para ativar respostas inteligentes em tempo real com o modelo Gemini, configure a variável de ambiente GEMINI_API_KEY no menu de configurações.'
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message,
      config: {
        systemInstruction: 'Você é o assistente virtual inteligente do Squad G (equipe de desenvolvimento de software da FICR formada por Amanda, Aylton, Diógenes e Guilherme). Responda com simpatia, concisão e profissionalismo em português do Brasil sobre a equipe, seus projetos, habilidades e serviços.'
      }
    });

    const reply = response.text || 'Desculpe, não consegui obter uma resposta.';
    res.json({ reply });
  } catch (err) {
    console.error('Erro na API do Gemini:', err);
    res.status(500).json({
      reply: 'Desculpe, ocorreu um erro ao consultar o modelo Gemini. Verifique a chave de API ou tente novamente mais tarde.'
    });
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
