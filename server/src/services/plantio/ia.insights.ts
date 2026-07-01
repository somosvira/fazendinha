// Gerador de "insights da semana" da lavoura — função PURA (sem Prisma).
// Recebe o MESMO ContextoPlantio que alimenta o chat da IA (montarContextoPlantio)
// e emite 2–4 cards escopados na lavoura, cada um só quando sua condição bate,
// com números reais embutidos em <b>…</b>. Espelha IaInsight do client
// (client/src/plantio/types.ts): escopo/dominio/texto/acoes.

import type { ContextoPlantio } from "./ia.context.js";

export interface IaInsightDTO {
  id: string;
  escopo: "lavoura" | "talhao";
  dominio: "fenologia" | "fitossanidade" | "nutricao" | "colheita";
  talhaoId?: string;
  texto: string; // pode conter <b>…</b>
  acoes: { label: string; primaria?: boolean }[];
}

const b = (s: string | number) => `<b>${s}</b>`;
const fmtBR = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const cod = (codigo: string, nome: string | null) => (nome ? `${nome} (${codigo})` : codigo);

export function gerarInsightsPlantio(ctx: ContextoPlantio): IaInsightDTO[] {
  const out: IaInsightDTO[] = [];

  // 1) Ferrugem alta (≥ 5%) — lista os códigos dos talhões em alerta.
  if (ctx.alertaFerrugem.length) {
    const n = ctx.alertaFerrugem.length;
    const pior = ctx.alertaFerrugem[0];
    const codigos = ctx.alertaFerrugem.slice(0, 4).map((a) => a.codigo).join(", ");
    const subindo = ctx.alertaFerrugem.filter((a) => a.tendencia === "subindo").length;
    out.push({
      id: "pl-ferrugem",
      escopo: "lavoura",
      dominio: "fitossanidade",
      texto:
        `${b(n)} ${n === 1 ? "talhão está" : "talhões estão"} com ferrugem ≥ 5% (${codigos})` +
        `${subindo ? ` — ${b(subindo)} com a curva subindo` : ""}. ` +
        `O pico é o ${b(cod(pior.codigo, pior.nome))} com ${b(`${pior.ferrugem}%`)}. ` +
        `Vale acelerar a próxima aplicação nos suscetíveis antes que a colheita feche o calendário.`,
      acoes: [{ label: "Ver talhões em alerta", primaria: true }, { label: "Programar fungicida" }],
    });
  }

  // 2) Prontos pra colher (cereja ≥ 60%, fora de colheita).
  if (ctx.prontosColher.length) {
    const n = ctx.prontosColher.length;
    const pico = ctx.prontosColher[0];
    const codigos = ctx.prontosColher.slice(0, 4).map((a) => a.codigo).join(", ");
    out.push({
      id: "pl-colheita",
      escopo: "lavoura",
      dominio: "colheita",
      texto:
        `${b(n)} ${n === 1 ? "talhão passou" : "talhões passaram"} de 60% de cereja e ${n === 1 ? "está pronto" : "estão prontos"} pra derriça (${codigos}). ` +
        `O mais maduro é o ${b(cod(pico.codigo, pico.nome))} com ${b(`${pico.maturacaoCereja}% cereja`)}. ` +
        `Começar pelos mecanizáveis libera o pano para os manuais depois.`,
      acoes: [{ label: "Ver calendário de colheita", primaria: true }, { label: "Simular cronograma" }],
    });
  }

  // 3) Custo por saca — quando há benefício computável no período.
  if (ctx.custo.custoSaca != null && ctx.custo.custoSaca > 0) {
    const top = ctx.custo.breakdown[0];
    out.push({
      id: "pl-custo",
      escopo: "lavoura",
      dominio: "nutricao",
      texto:
        `O custo do café está em ${b(`R$ ${fmtBR(ctx.custo.custoSaca)}/saca`)} nos últimos ${ctx.custo.periodoMeses} meses ` +
        `(${b(`${ctx.custo.sacasPeriodo} sc`)} beneficiadas, custeio de ${b(`R$ ${fmtBR(ctx.custo.custeioTotal)}`)}). ` +
        `${top ? `A maior fatia é ${b(top.categoria)} (${top.pct}%). ` : ""}` +
        `Compare com o preço da saca pra saber se a safra fecha no azul.`,
      acoes: [{ label: "Ver custo por saca", primaria: true }],
    });
  }

  // 4) Análises vencidas (foliar > 120d / solo > 365d ou nunca feitas).
  const foliar = ctx.foliarVencida.length;
  const solo = ctx.soloVencido.length;
  if (foliar || solo) {
    const partes: string[] = [];
    if (foliar) partes.push(`${b(foliar)} com foliar vencida`);
    if (solo) partes.push(`${b(solo)} com solo vencido`);
    const alvo = ctx.foliarVencida[0] ?? ctx.soloVencido[0];
    out.push({
      id: "pl-analises",
      escopo: "lavoura",
      dominio: "nutricao",
      texto:
        `Análises de fertilidade atrasadas: ${partes.join(" e ")}. ` +
        `${alvo ? `Ex.: ${b(cod(alvo.codigo, alvo.nome))}. ` : ""}` +
        `Sem foliar e solo em dia, a adubação pós-colheita anda no escuro — a janela é curta em junho.`,
      acoes: [{ label: "Ver análises pendentes", primaria: true }],
    });
  }

  return out.slice(0, 4);
}
