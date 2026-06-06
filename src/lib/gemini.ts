import type { BuildingFeature, Lead } from "../types/building";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";

export interface CompanyInfo {
  name?: string;
  phone?: string;
  website?: string;
  email?: string;
  nif?: string;
  confidence: "high" | "medium" | "low";
  /** URL of the source Gemini used (from search grounding), if any. */
  sourceUrl?: string;
}

export interface GeminiLookupHints {
  address?: string;
  /** Nearest named OSM feature from Nominatim (often the business). */
  nominatimName?: string;
  /** Strongest nearby OSM business name, if any. */
  osmHint?: string;
}

/**
 * Ask Gemini (with Google Search grounding) what company operates at a location
 * in Portugal. Grounding turns the model from a guesser into a real look-up that
 * can read Maps/registry pages. Returns null if nothing confident is found.
 */
export async function lookupCompanyWithGemini(
  lat: number,
  lon: number,
  hints: GeminiLookupHints = {},
): Promise<CompanyInfo | null> {
  if (!GEMINI_KEY) return null;
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
  ];

  const lines = [
    `Coordenadas: ${lat.toFixed(5)}, ${lon.toFixed(5)} (Portugal).`,
    hints.address ? `Morada aproximada: "${hints.address}".` : "",
    hints.nominatimName ? `Local mais próximo no mapa: "${hints.nominatimName}".` : "",
    hints.osmHint ? `Negócio próximo conhecido: "${hints.osmHint}".` : "",
  ].filter(Boolean).join("\n");

  const prompt = `Usa a Pesquisa Google para identificar a empresa ou negócio C&I que opera nesta localização em Portugal.
${lines}

Procura no Google Maps e em registos de empresas portuguesas. Devolve APENAS um objeto JSON:
{"name":"Nome da Empresa","phone":"+351XXXXXXXXX","website":"https://...","nif":"XXXXXXXXX","confidence":"high|medium|low"}
- confidence "high" só se confirmaste numa fonte (Maps/site/registo).
- NIF só se o encontraste explicitamente (9 dígitos).
- Se não conseguires identificar, devolve {"confidence":"low"}.
- Responde SÓ com o JSON.`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0, maxOutputTokens: 400 },
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 429 || res.status === 404 || res.status === 400) continue;
      if (!res.ok) continue;
      const data = await res.json();
      const cand = data?.candidates?.[0];
      const text: string = cand?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join("") ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      let parsed: CompanyInfo;
      try {
        parsed = JSON.parse(jsonMatch[0]) as CompanyInfo;
      } catch {
        continue;
      }
      if (!parsed.name && parsed.confidence === "low") return null;
      // Capture grounding source URL for trust
      const groundingUrl = cand?.groundingMetadata?.groundingChunks?.[0]?.web?.uri;
      if (groundingUrl) parsed.sourceUrl = groundingUrl;
      return parsed;
    } catch {
      // try next model
    }
  }
  return null;
}

type AIAction = "summarize" | "email" | "script";

interface AIRequest {
  action: AIAction;
  building: BuildingFeature;
  lead?: Lead;
}

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

  // Try models in order — fall back to next if quota / not-found
  const models = [
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
  ];

  let lastError = "";
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 429 || res.status === 404) {
        lastError = `${model} → ${res.status}`;
        continue;
      }
      if (!res.ok) {
        lastError = `${model} → HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      lastError = `${model} → empty response`;
    } catch (e) {
      lastError = `${model} → ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  throw new Error(`Todos os modelos Gemini falharam. Último: ${lastError}`);
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
