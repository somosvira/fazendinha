/* Cliente HTTP minimalista para a API do Rio Novo.
 * Backend está em outra porta; Vite faz proxy de /api → 41873 (vite.config.ts).
 */

import { buildSubcategorias, buildVolumeLeite, fornecedores } from "./data/cockpitSupplements";
import { buildFolego, buildProjecaoLeite, buildProjecaoFluxo } from "./data/projecao";
import { orcamento, buildProdutividade } from "./data/gestao";
import { buildCompromissos, buildRuptura } from "./data/ruptura";
import { anomalias, historicoPreco, analisePreco } from "./data/anomalias";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
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
export async function fetchDashboard(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await getJson("/dashboard");

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

  // Suplementos que o backend ainda não modela (subcategorias, fornecedores,
  // volume de leite). Casados por nome de categoria — ver cockpitSupplements.ts.
  d.subcategorias = buildSubcategorias(d.categoriasReais);
  d.fornecedores = fornecedores;
  if (d.k2025 && d.k2026YTD) {
    d.volumeLeite = buildVolumeLeite(d.k2025, d.k2026YTD);
  }

  // Derivados do cockpit v3 (fôlego, break-even, fluxo, ruptura). Calculados a
  // partir das séries do payload — ver data/projecao.ts e data/ruptura.ts.
  d.folego = buildFolego(d);
  d.projecaoLeite = buildProjecaoLeite(d);
  d.projecaoFluxo = buildProjecaoFluxo(d, d.projecaoLeite);
  d.compromissos = buildCompromissos();
  d.rupturaCaixa = buildRuptura(d, d.folego);

  // Gestão (orçado×realizado, produtividade do rebanho) — definidos fora do BPO.
  d.orcamento = orcamento;
  d.produtividade = buildProdutividade();

  // Vigilância da IA (anomalias + histórico de preço por insumo).
  d.anomalias = anomalias;
  d.historicoPreco = historicoPreco;
  d.analisePreco = analisePreco;

  return d;
}

export async function reclassificarCategoria(id: number, classificacao: "INVESTIMENTO" | "CUSTEIO"): Promise<void> {
  const res = await fetch(`/api/categorias/${id}/classificacao`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ classificacao }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
