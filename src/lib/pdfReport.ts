/**
 * Per-lead PDF proposal/report. jsPDF (~150KB) is dynamically imported so it
 * only loads when the user actually generates a report. Output is downloaded
 * via a Blob (works in both the Tauri webview and the browser dev server).
 */
import type { BuildingFeature, Lead } from "../types/building";
import { computeFinance, formatEur } from "./solarFinance";
import { estimatePeakPower } from "./pvgis";
import { getDisplayCompany } from "./leadAutoFill";

const BRAND: [number, number, number] = [249, 115, 22]; // #f97316
const INK: [number, number, number] = [30, 31, 48];
const MUTED: [number, number, number] = [120, 130, 150];

export async function generateLeadPdf(building: BuildingFeature, lead?: Lead): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 16;
  let y = 0;

  const company = getDisplayCompany(building, lead);
  const kwp = lead?.estimatedKwp ?? estimatePeakPower(building.areaSqm);
  const annualKwh = lead?.estimatedKwhPerYear ?? Math.round(kwp * 1480);
  const fin = computeFinance("capex", { systemKwp: kwp, annualKwh });

  // Header band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PYE Prospector", M, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Análise de Potencial Solar — Proposta de Prospeção", M, 20);
  y = 38;

  // Company block
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(company === "(sem nome — verificar)" ? "Edifício (empresa a confirmar)" : company, M, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const addr = lead?.address ?? `${building.centroidLat.toFixed(5)}, ${building.centroidLon.toFixed(5)}`;
  doc.text(addr, M, y);
  y += 5;
  const contactLine = [lead?.telephone, lead?.email, lead?.website].filter(Boolean).join("  ·  ");
  if (contactLine) { doc.text(contactLine, M, y); y += 5; }
  y += 4;

  // Key metrics grid
  const metrics: [string, string][] = [
    ["Área de cobertura", `${building.areaSqm.toLocaleString("pt-PT")} m²`],
    ["Potência instalável", `${kwp.toFixed(1)} kWp`],
    ["Geração anual", `${(annualKwh / 1000).toFixed(1)} MWh/ano`],
    ["Investimento estimado", formatEur(fin.capexEur)],
    ["Poupança anual", formatEur(fin.year1SavingsEur)],
    ["Retorno (payback)", Number.isFinite(fin.paybackYears) ? `${fin.paybackYears} anos` : "—"],
    ["VAL (25 anos)", formatEur(fin.npvEur)],
    ["TIR", Number.isFinite(fin.irrPct) ? `${fin.irrPct}%` : "—"],
    ["CO₂ evitado / ano", `${fin.co2TonnesPerYear} t`],
  ];

  const colW = (W - 2 * M) / 3;
  const rowH = 20;
  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = M + col * colW;
    const by = y + row * rowH;
    doc.setDrawColor(225, 228, 235);
    doc.setFillColor(247, 248, 250);
    doc.roundedRect(bx, by, colW - 4, rowH - 4, 2, 2, "FD");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7.5);
    doc.text(m[0].toUpperCase(), bx + 3, by + 6);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(m[1], bx + 3, by + 13);
    doc.setFont("helvetica", "normal");
  });
  y += Math.ceil(metrics.length / 3) * rowH + 6;

  // Monthly generation bars
  if (lead?.monthlyKwh && lead.monthlyKwh.length === 12) {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Geração mensal estimada (kWh)", M, y);
    y += 6;
    const max = Math.max(...lead.monthlyKwh);
    const chartW = W - 2 * M;
    const barW = chartW / 12;
    const chartH = 32;
    const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    lead.monthlyKwh.forEach((v, i) => {
      const h = max > 0 ? (v / max) * chartH : 0;
      const bx = M + i * barW;
      doc.setFillColor(...BRAND);
      doc.rect(bx + 1, y + chartH - h, barW - 2, h, "F");
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.text(months[i], bx + barW / 2 - 1, y + chartH + 4);
    });
    y += chartH + 12;
  }

  // Footer
  doc.setDrawColor(225, 228, 235);
  doc.line(M, 280, W - M, 280);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7.5);
  doc.text(
    "Estimativa para prospeção comercial — não constitui proposta vinculativa. Dados: OpenStreetMap, PVGIS (Comissão Europeia).",
    M, 285,
  );
  doc.text(new Date().toLocaleDateString("pt-PT"), W - M, 285, { align: "right" });

  // Download
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = company.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "lead";
  a.href = url;
  a.download = `PYE_${safe}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
