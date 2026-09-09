/* Template do relatório gerencial: só apresentação (textos, ordem e
 * visibilidade das seções). Nunca toca nos valores calculados pelo backend.
 * Persistido no navegador por propriedade. */
import type { RegimeRelatorio, SecaoId, SecaoTemplate, TemplateRelatorio } from "./types";

export interface SecaoCatalogo { id: SecaoId; rotulo: string; regime: RegimeRelatorio }

export const SECOES: readonly SecaoCatalogo[] = [
  { id: "resumo", rotulo: "Resumo executivo", regime: "ambos" },
  { id: "saldoContas", rotulo: "Saldo por conta", regime: "realizado" },
  { id: "entradasSaidas", rotulo: "Entradas e saídas realizadas", regime: "realizado" },
  { id: "resultado", rotulo: "Resultado do período", regime: "realizado" },
  { id: "compromissos", rotulo: "Compromissos a pagar e a receber", regime: "previsto" },
  { id: "categorias", rotulo: "Despesas por categoria e centro de custo", regime: "realizado" },
  { id: "operacoes", rotulo: "Operações por tipo", regime: "ambos" },
  { id: "rastreabilidade", rotulo: "Rastreabilidade e documentos", regime: "ambos" },
];

export const rotuloSecao = (id: SecaoId): string => SECOES.find((s) => s.id === id)?.rotulo ?? id;

export const TITULO_PADRAO = "Relatório financeiro gerencial";

export function templatePadrao(): TemplateRelatorio {
  return {
    titulo: TITULO_PADRAO,
    subtitulo: "",
    observacoes: "",
    secoes: SECOES.map((s) => ({ id: s.id, visivel: true })),
  };
}

export function moverSecao(t: TemplateRelatorio, id: SecaoId, direcao: -1 | 1): TemplateRelatorio {
  const i = t.secoes.findIndex((s) => s.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= t.secoes.length) return t;
  const secoes = [...t.secoes];
  [secoes[i], secoes[j]] = [secoes[j], secoes[i]];
  return { ...t, secoes };
}

export function alternarSecao(t: TemplateRelatorio, id: SecaoId): TemplateRelatorio {
  return { ...t, secoes: t.secoes.map((s) => (s.id === id ? { ...s, visivel: !s.visivel } : s)) };
}

export function editarTexto(t: TemplateRelatorio, campo: "titulo" | "subtitulo" | "observacoes", valor: string): TemplateRelatorio {
  return { ...t, [campo]: valor };
}

const pertenceAoRegime = (secao: RegimeRelatorio, regime: RegimeRelatorio) =>
  secao === "ambos" || regime === "ambos" || secao === regime;

/** Seções a renderizar: visíveis no template e aplicáveis ao regime pedido. */
export function secoesVisiveis(t: TemplateRelatorio, regime: RegimeRelatorio): SecaoId[] {
  return t.secoes
    .filter((s) => s.visivel)
    .map((s) => s.id)
    .filter((id) => {
      const cat = SECOES.find((s) => s.id === id);
      return cat != null && pertenceAoRegime(cat.regime, regime);
    });
}

const chave = (propriedadeId: number | null) => `terrano:relatorio-gerencial:template:${propriedadeId ?? "consolidado"}`;

export function salvarTemplate(propriedadeId: number | null, t: TemplateRelatorio) {
  try { localStorage.setItem(chave(propriedadeId), JSON.stringify(t)); } catch { /* storage indisponível */ }
}

/** Recarrega do navegador; ignora seções desconhecidas e completa as que faltarem, ao final. */
export function carregarTemplate(propriedadeId: number | null): TemplateRelatorio {
  const padrao = templatePadrao();
  let bruto: Partial<TemplateRelatorio> | null = null;
  try { bruto = JSON.parse(localStorage.getItem(chave(propriedadeId)) ?? "null"); } catch { bruto = null; }
  if (!bruto || typeof bruto !== "object") return padrao;
  const conhecidas = new Set<string>(SECOES.map((s) => s.id));
  const salvas: SecaoTemplate[] = Array.isArray(bruto.secoes)
    ? bruto.secoes.filter((s): s is SecaoTemplate => !!s && conhecidas.has(String(s.id))).map((s) => ({ id: s.id, visivel: s.visivel !== false }))
    : [];
  const presentes = new Set(salvas.map((s) => s.id));
  return {
    titulo: typeof bruto.titulo === "string" && bruto.titulo.trim() ? bruto.titulo : padrao.titulo,
    subtitulo: typeof bruto.subtitulo === "string" ? bruto.subtitulo : "",
    observacoes: typeof bruto.observacoes === "string" ? bruto.observacoes : "",
    secoes: [...salvas, ...padrao.secoes.filter((s) => !presentes.has(s.id))],
  };
}
