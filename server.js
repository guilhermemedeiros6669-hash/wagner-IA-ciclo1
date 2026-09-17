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

const SQUAD_G_SUPPORT_PROMPT = `
Você é o Assistente Oficial de Suporte e Atendimento com Inteligência Artificial do Squad G.
O Squad G é uma equipe de desenvolvimento web e software formada na FICR (Faculdade Imaculada Conceição do Recife).

Informações detalhadas sobre o Squad G para responder aos usuários:

1. A Equipe e seus Membros:
   - Amanda Ramos: Integrante da equipe de desenvolvimento Frontend e HTML. Especialista em estruturação de formulários, acessibilidade e interfaces limpas. Criou o projeto "Portal de Acesso e Cadastro".
   - Guilherme Henrique (25 anos): Desenvolvedor Frontend e HTML, focado em lógica de validação, interfaces modernas e experiência do usuário. Criou o projeto "Sistema de Autenticação e Login Responsivo".
   - Aylton Oliveira (20 anos): Desenvolvedor Frontend e CSS, com grande habilidade em layout responsivo, flexbox e navegação intuitiva. Criou o projeto "Interface de Navegação e Busca Web".
   - Diógenes José (34 anos): Desenvolvedor Frontend e UI Designer da equipe de CSS, focado em padronização visual, hierarquia tipográfica e Design System em CSS3. Criou o projeto "Design System & Biblioteca de Componentes CSS".

2. Projetos Desenvolvidos:
   - Portal de Cadastro e Login (Amanda): Sistema completo de entrada de usuários com validações, semântica HTML5 e campos acessíveis.
   - Sistema de Autenticação Responsivo (Guilherme): Interface de autenticação moderna adaptável a qualquer dispositivo (desktop, tablet e mobile).
   - Interface de Navegação e Busca Web (Aylton): Estrutura de navegação limpa inspirada nos principais mecanismos de busca da web.
   - Design System e Biblioteca de Componentes (Diógenes): Conjunto reutilizável de botões, cartões, formulários e paleta de cores harmoniosa em CSS3.
   - Case de Sucesso (Alpha Corp): Otimização operacional e financeira que gerou 40% de redução em custos operacionais e aumentou a produtividade da equipe em 25%.

3. Serviços Oferecidos pelo Squad G:
   - Plano Start (R$ 899,00): Ideal para pequenos negócios, landing page responsiva, formulário de contato integrado e SEO básico.
   - Plano Pro (R$ 1.899,00): Portfólio ou website institucional completo (até 5 páginas), animações modernas, design personalizado e otimização para mobile.
   - Plano Enterprise (R$ 3.499,00): Solução personalizada completa, suporte prioritário, design system sob medida e integração com APIs.

4. Habilidades Técnicas:
   - HTML5 Semântico, CSS3 Moderno (Flexbox, Grid, Animações), JavaScript ES6+, Git/GitHub, Metodologias Ágeis (Scrum), UI/UX Design e Responsividade Mobile-First.

5. Contato:
   - Podem entrar em contato pelo formulário na página de Contato ou através de redes sociais (LinkedIn, Instagram) e e-mail institucional da equipe.

Diretrizes de Atendimento do Suporte:
- Seja muito educado, acolhedor, profissional e prestativo.
- Responda em português do Brasil com clareza e concisão.
- Utilize tópicos com marcadores (* ou -) e destaques em negrito (**termo**) para tornar a resposta fácil de ler.
- Se o usuário perguntar sobre preços ou como contratar, apresente os planos e direcione para a página de Serviços ou Contato.
`;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat API endpoint for Gemini Support AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida ou não fornecida.' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.json({
        reply: 'Olá! Sou o assistente virtual do Squad G. Para ativar respostas inteligentes em tempo real com o modelo Gemini, configure a variável de ambiente GEMINI_API_KEY no menu de configurações.'
      });
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

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: SQUAD_G_SUPPORT_PROMPT
        }
      });
    } catch (modelErr) {
      // Fallback para gemini-3.6-flash se necessário
      console.warn('Tentando fallback para gemini-3.6-flash devido a:', modelErr.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
        config: {
          systemInstruction: SQUAD_G_SUPPORT_PROMPT
        }
      });
    }

    const reply = response.text || 'Desculpe, não consegui obter uma resposta.';
    res.json({ reply });
  } catch (err) {
    console.error('Erro na API do Gemini:', err);
    res.status(500).json({
      reply: 'Desculpe, ocorreu um erro ao consultar o suporte do Squad G. Verifique a chave de API ou tente novamente em instantes.'
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
