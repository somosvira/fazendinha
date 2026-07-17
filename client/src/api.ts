/* Cliente HTTP minimalista para a API do Rio Novo.
 * Backend está em outra porta; Vite faz proxy de /api → 41873 (vite.config.ts).
 */

import { buildVolumeLeite } from "./data/cockpitSupplements";
import { comPropriedade } from "./propriedadeScope";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: comPropriedade() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${path}: ${body || res.statusText}`);
  }
  return res.json();
}

/**
 * GET /api/dashboard — agregados (timeline 23m, DRE 2025/2026YTD, categorias top 12, etc.).
 *
 * Compat: o frontend foi escrito contra o mock onde `categoriasReais[i].grupo`
 * é o display da atividade ("Atv. Leiteira") e `subgrupo` é o GrupoCategoria.
 * O backend devolve `grupo = GrupoCategoria`. Reescreve aqui para casar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchDashboard(opts?: { from?: string; to?: string }): Promise<any> {
  const qs = new URLSearchParams();
  if (opts?.from) qs.set("from", opts.from);
  if (opts?.to) qs.set("to", opts.to);
  const q = qs.toString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await getJson(`/dashboard${q ? `?${q}` : ""}`);

  // saldoOpLeite não vem do backend (derivável): receita − custeio puro do leite.
  // Derivado aqui p/ todos os consumidores (Relatório Veredicto #2, projeção etc.).
  if (Array.isArray(d.receitaLeite) && Array.isArray(d.custeioLeitePuro)) {
    d.saldoOpLeite = d.receitaLeite.map((r: number, i: number) => r - d.custeioLeitePuro[i]);
  }

  const atvLabel: Record<string, string> = {
    leite: "Atv. Leiteira",
    cafe: "Plantio Café",
    outros: "Outros / Estrutural",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d.categoriasReais = (d.categoriasReais ?? []).map((c: any) => ({
    ...c,
    subgrupo: c.grupo,
    grupo: atvLabel[c.atividade] ?? c.grupo ?? "—",
  }));

  // Subcategorias REAIS = quebra por fornecedor dentro de cada categoria (única
  // dimensão disponível; o schema não tem nível de subcategoria). Os fornecedores
  // por categoria vêm do servidor em categoriasReais[].fornecedores ({nome,valor,n}).
  d.subcategorias = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of d.categoriasReais as any[]) {
    const total = c.total23m || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tops = (c.fornecedores ?? []) as any[];
    const subs = tops.map((f) => ({ nome: f.nome, fornecedor: "", lanc: f.n, share: f.valor / total }));
    const somaShare = subs.reduce((s, x) => s + x.share, 0);
    const restoN = (c.nFornecedores ?? tops.length) - tops.length;
    if (restoN > 0 && somaShare < 0.999) {
      subs.push({ nome: "Outros fornecedores", fornecedor: `${restoN} fornecedores`, lanc: 0, share: Math.max(0, 1 - somaShare) });
    }
    d.subcategorias[c.id] = subs;
  }

  // Suplementos que o backend ainda não modela (volume de leite — sem dado de rebanho).
  if (d.k2025 && d.k2026YTD) {
    d.volumeLeite = buildVolumeLeite(d.k2025, d.k2026YTD);
  }

  // Fôlego + projeção de fluxo: dados REAIS do servidor (d.projecao — Plano #2).
  // A queima é sólida; o fôlego em si depende do caixa (subestimado enquanto o
  // saldoInicial das contas for 0).
  const proj = d.projecao ?? {};
  d.folego = {
    caixa: proj.caixa ?? 0,
    queimaMensal: proj.queimaMensal ?? 0,
    queimaCusteioMensal: proj.queimaCusteioMensal ?? 0,
    queimaInvestimentoMensal: proj.queimaInvestimentoMensal ?? 0,
    folegoDias: proj.folegoDias ?? null,
    folegoMeses: proj.folegoMeses ?? null,
    baseMeses: proj.baseMeses ?? 6,
  };
  d.projecaoFluxo = { fluxoProj: proj.fluxoProj ?? [] };

  // topSetores: 3 setores (centro de custo) com maior receita no período —
  // dado REAL do servidor. Alimenta o comparativo "Maiores receitas" do Dashboard.
  d.topSetores = d.topSetores ?? [];

  return d;
}

export interface LancamentoDrill {
  data: string | null;
  valor: number;
  doc: string | null;
  descricao: string | null;
  fornecedor: string;
}

/** GET /api/dashboard/lancamentos — lançamentos reais de uma categoria (opc. de um fornecedor). */
export async function fetchLancamentos(categoriaId: number, fornecedor?: string, from?: string, to?: string): Promise<LancamentoDrill[]> {
  const qs = new URLSearchParams({ categoriaId: String(categoriaId) });
  if (fornecedor) qs.set("fornecedor", fornecedor);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await fetch(`/api/dashboard/lancamentos?${qs.toString()}`, { headers: comPropriedade() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return (d.lancamentos ?? []) as LancamentoDrill[];
}

export interface BotReply {
  resposta: string;
  toolsUsadas?: string[];
  sessao?: string | null;
}

/** POST /api/bot/ask — pergunta ao assistente. `sessao` mantém o contexto entre chamadas. */
export async function askBot(pergunta: string, sessao: string): Promise<BotReply> {
  const res = await fetch("/api/bot/ask", {
    method: "POST",
    headers: comPropriedade({ "content-type": "application/json" }),
    body: JSON.stringify({ pergunta, sessao }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 503) throw new Error(data?.erro || "Bot desligado (configure OPENAI_API_KEY no servidor).");
    throw new Error(data?.erro || `Erro ${res.status}`);
  }
  return data as BotReply;
}

export async function reclassificarCategoria(id: number, classificacao: "INVESTIMENTO" | "CUSTEIO"): Promise<void> {
  const res = await fetch(`/api/categorias/${id}/classificacao`, {
    method: "PATCH",
    headers: comPropriedade({ "content-type": "application/json" }),
    body: JSON.stringify({ classificacao }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
