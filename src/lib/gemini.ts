import type { BuildingFeature, Lead } from "../types/building";

type AIAction = "summarize" | "email" | "script";

interface AIRequest {
  action: AIAction;
  building: BuildingFeature;
  lead?: Lead;
}

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";

/**
 * AI Assistant — generates summary, outreach email, or sales script for a lead.
 * Uses Google Gemini if VITE_GEMINI_API_KEY is set; otherwise returns mock content.
 * Adapted from PYE-Prospect-Studio.
 */
export async function askAI(req: AIRequest): Promise<string> {
  if (GEMINI_KEY) {
    try {
      return await callGemini(req);
    } catch (e) {
      console.warn("Gemini call failed, using mock:", e);
    }
  }
  return mockResponse(req);
}

async function callGemini(req: AIRequest): Promise<string> {
  const prompt = buildPrompt(req);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? mockResponse(req);
}

function buildPrompt(req: AIRequest): string {
  const { action, building, lead } = req;
  const company = lead?.company || "esta empresa";
  const address = lead?.address || `${building.centroidLat.toFixed(4)}, ${building.centroidLon.toFixed(4)}`;
  const area = Math.round(building.areaSqm);
  const kwp = lead?.estimatedKwp ?? Math.round(area * 0.65 * 0.18);
  const kwh = lead?.estimatedKwhPerYear ?? Math.round(kwp * 1480);
  const savings = Math.round(kwh * 0.16);

  const context = `Empresa: ${company}
Morada: ${address}
Área coberta: ${area} m²
Potencial solar: ${kwp} kWp
Geração anual estimada: ${kwh} kWh
Poupança anual estimada: ${savings} €`;

  switch (action) {
    case "summarize":
      return `És um consultor de prospeção solar B2B em Portugal. Escreve um resumo executivo curto e profissional desta oportunidade em português europeu, com pontos-chave em bullets. Foco em valor de negócio:\n\n${context}`;
    case "email":
      return `És um vendedor sénior de soluções solares C&I. Escreve um email curto, persuasivo e personalizado (português europeu) ao CFO desta empresa, propondo uma reunião para discutir a oportunidade solar. Inclui números concretos. Máximo 150 palavras:\n\n${context}`;
    case "script":
      return `És um consultor de prospeção solar. Escreve um script de chamada telefónica de 30-60 segundos (português europeu) para abrir conversa com esta empresa sobre painéis solares. Estrutura: abertura, gancho com números, pergunta, próximo passo:\n\n${context}`;
  }
}

function mockResponse(req: AIRequest): string {
  const { action, building, lead } = req;
  const company = lead?.company || "[Empresa]";
  const address = lead?.address || `${building.centroidLat.toFixed(4)}, ${building.centroidLon.toFixed(4)}`;
  const area = Math.round(building.areaSqm);
  const kwp = lead?.estimatedKwp ?? Math.round(area * 0.65 * 0.18);
  const kwh = lead?.estimatedKwhPerYear ?? Math.round(kwp * 1480);
  const savings = Math.round(kwh * 0.16);

  switch (action) {
    case "summarize":
      return `**Resumo Executivo — ${company}**

📍 **Localização:** ${address}
📐 **Área de cobertura:** ${area.toLocaleString("pt-PT")} m²
☀️ **Potencial solar:** ${kwp} kWp
⚡ **Geração anual:** ${kwh.toLocaleString("pt-PT")} kWh
💶 **Poupança anual estimada:** ${savings.toLocaleString("pt-PT")} €

**Próximos passos:**
- Validar perfil de consumo (faturas EDP/Endesa últimos 12 meses)
- Confirmar tipo de cobertura e estrutura
- Agendar visita técnica

> _Resposta mock — define VITE_GEMINI_API_KEY no .env para usar IA real._`;

    case "email":
      return `**Assunto:** Oportunidade de poupança energética para a ${company}

Caro/a CFO,

Identificámos a vossa instalação como uma das melhores oportunidades para autoconsumo solar na vossa zona. Os números preliminares são significativos:

• Potencial: **${kwp} kWp** (cobertura de ${area.toLocaleString("pt-PT")} m²)
• Geração anual: **${kwh.toLocaleString("pt-PT")} kWh**
• Poupança estimada: **${savings.toLocaleString("pt-PT")} €/ano**

Gostaríamos de propor uma reunião curta (30 min) para apresentar uma análise detalhada e discutir modelos de financiamento (CAPEX, OPEX/PPA).

Tem 15 minutos esta semana?

Cumprimentos,
[O seu nome]

> _Resposta mock — define VITE_GEMINI_API_KEY no .env para usar IA real._`;

    case "script":
      return `**Script de chamada — ${company}**

🔹 **Abertura (10s):**
"Bom dia, [nome], sou o [seu nome] da [empresa]. Estamos a contactar empresas em [zona] sobre uma oportunidade de redução de custos energéticos significativa. Posso roubar-lhe 60 segundos?"

🔹 **Gancho (20s):**
"Identificámos a vossa cobertura industrial — cerca de ${area.toLocaleString("pt-PT")} m². Os nossos números preliminares mostram um potencial de ${kwp} kWp, que se traduz em **${savings.toLocaleString("pt-PT")} € de poupança anual** em eletricidade. Com payback típico de 4 a 6 anos."

🔹 **Pergunta:**
"Já consideraram autoconsumo solar para a vossa operação?"

🔹 **Próximo passo:**
"Gostaria de enviar-lhe uma análise técnica gratuita por email. Qual é o melhor endereço?"

> _Resposta mock — define VITE_GEMINI_API_KEY no .env para usar IA real._`;
  }
}
