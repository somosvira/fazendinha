// Gerador de "insights da semana" do plantel de corte — função PURA (sem Prisma).
// Recebe o MESMO ContextoCorte que alimenta o chat da IA (montarContextoCorte) e
// emite 2–4 cards escopados na fazenda, cada um só quando sua condição bate, com
// números reais embutidos em <b>…</b>. Espelha IaInsight do client
// (client/src/corte/types.ts): escopo/dominio/texto/acoes.

import type { ContextoCorte } from "./ia.context.js";

export interface IaInsightDTO {
  id: string;
  escopo: "fazenda" | "lote";
  dominio: "pesagem" | "sanidade" | "nutricao" | "comercial";
  loteId?: string;
  texto: string; // pode conter <b>…</b>
  acoes: { label: string; primaria?: boolean }[];
}

const b = (s: string | number) => `<b>${s}</b>`;
const fmtR$ = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

export function gerarInsightsCorte(ctx: ContextoCorte): IaInsightDTO[] {
  const out: IaInsightDTO[] = [];

  // 1) Lotes prontos pra venda (peso ≥ ~480 kg ou alvo atingido) com R$ no spot.
  if (ctx.prontosVenda.length) {
    const n = ctx.prontosVenda.length;
    const melhor = ctx.prontosVenda[0];
    const valorTotal = ctx.prontosVenda.reduce((s, l) => s + l.valorSpot, 0);
    out.push({
      id: "co-venda",
      escopo: "fazenda",
      dominio: "comercial",
      texto:
        `${b(n)} ${n === 1 ? "lote está pronto" : "lotes estão prontos"} pra venda — ` +
        `o maior é ${b(melhor.codigo)} (${melhor.nome}) com ${b(`${melhor.numCabecas} cab`)} a ${b(`${melhor.pesoMedio} kg`)}, ` +
        `${b(`${melhor.arrobasTotal} @`)} valendo ${b(fmtR$(melhor.valorSpot))} no spot. ` +
        (n > 1 ? `Somando os prontos dá ${b(fmtR$(valorTotal))}. ` : "") +
        `Rodar o break-even antes de segurar mais.`,
      acoes: [{ label: "Abrir simulador de venda", primaria: true }, { label: "Ver curva B3" }],
    });
  }

  // 2) Custo por @ — usa a economia real (agregarCustoCorte via montarContextoCorte).
  const e = ctx.economia;
  if (e && e.arrobasProduzidas > 0 && e.custoArroba > 0) {
    const spot = e.precoArrobaSpot;
    const margem = spot - e.custoArroba;
    out.push({
      id: "co-custo-arroba",
      escopo: "fazenda",
      dominio: "comercial",
      texto:
        `O custo de produção está em ${b(`${fmtR$(e.custoArroba)}/@`)} ` +
        `(${b(`${e.arrobasProduzidas} @`)} produzidas, custeio de ${b(fmtR$(e.custeioTotal))}). ` +
        `Contra o spot de ${b(`${fmtR$(spot)}/@`)}, a margem é de ${b(`${fmtR$(margem)}/@`)}. ` +
        `Números vêm dos dados do próprio módulo (suplementação + sanidade), sem ponte financeira.`,
      acoes: [{ label: "Ver custo por @", primaria: true }],
    });
  } else if (e && e.valorBiologicoEstoque > 0) {
    // Sem @ vendidas ainda: mostra o valor biológico do estoque a preço spot.
    out.push({
      id: "co-estoque-bio",
      escopo: "fazenda",
      dominio: "comercial",
      texto:
        `Ainda não há venda no período pra fechar o custo/@, mas o estoque biológico do plantel ` +
        `vale ${b(fmtR$(e.valorBiologicoEstoque))} a ${b(`${fmtR$(e.precoArrobaSpot)}/@`)} (spot). ` +
        `Assim que sair a 1ª venda, o custo por @ é calculado a partir das operações do módulo.`,
      acoes: [{ label: "Ver economia do corte", primaria: true }],
    });
  }

  // 3) GMD baixo — média do plantel abaixo da meta de recria a pasto.
  const GMD_META = 0.45;
  if (ctx.totais.gmdMedio != null && ctx.totais.gmdMedio < GMD_META) {
    const lotesBaixos = ctx.alertas.filter((a) => a.tipo === "gmd_baixo");
    out.push({
      id: "co-gmd",
      escopo: "fazenda",
      dominio: "pesagem",
      texto:
        `O GMD médio do plantel está em ${b(`${ctx.totais.gmdMedio} kg/dia`)}, abaixo da meta Embrapa ` +
        `de recria a pasto (0,45–0,50 kg/dia)` +
        `${lotesBaixos.length ? ` — ${b(lotesBaixos.length)} ${lotesBaixos.length === 1 ? "lote puxa" : "lotes puxam"} a média pra baixo (ex.: ${b(lotesBaixos[0].codigo)})` : ""}. ` +
        `Vale antecipar a transição para suplemento proteico na seca.`,
      acoes: [{ label: "Ver lotes com GMD baixo", primaria: true }],
    });
  }

  // 4) Mortalidade alta — algum lote acima do limiar Embrapa.
  const mortas = ctx.alertas.filter((a) => a.tipo === "mortalidade_alta");
  if (mortas.length) {
    const pior = mortas[0];
    out.push({
      id: "co-mortalidade",
      escopo: "lote",
      dominio: "sanidade",
      loteId: pior.codigo,
      texto:
        `${b(mortas.length)} ${mortas.length === 1 ? "lote acumula" : "lotes acumulam"} mortalidade acima da média Embrapa (3–5%) — ` +
        `${b(pior.codigo)} (${pior.nome}) com ${b(pior.detalhe.replace("mortalidade ", ""))}. ` +
        `Vale revisar protocolo de adaptação, água e cerca.`,
      acoes: [{ label: "Histórico do lote", primaria: true }],
    });
  }

  return out.slice(0, 4);
}
