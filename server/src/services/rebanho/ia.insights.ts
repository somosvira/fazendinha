// Gerador de "insights da semana" do rebanho — função PURA (sem Prisma).
// Recebe o MESMO ContextoRebanho que alimenta o chat da IA (montarContexto) e
// emite 2–4 cards escopados na fazenda, cada um só quando sua condição bate,
// com números reais embutidos em <b>…</b>. Espelha a forma de IaInsight do
// client (client/src/rebanho/types.ts): escopo/dominio/texto/acoes.

import type { ContextoRebanho } from "./ia.context.js";

export interface IaInsightDTO {
  id: string;
  escopo: "rebanho" | "animal";
  dominio: "reproducao" | "sanidade" | "nutricao" | "producao";
  animalId?: string;
  texto: string; // pode conter <b>…</b>
  acoes: { label: string; primaria?: boolean }[];
}

const b = (s: string | number) => `<b>${s}</b>`;
const apelido = (numero: string, nome: string | null) => `${nome ?? "Sem nome"} #${numero}`;

export function gerarInsightsRebanho(ctx: ContextoRebanho): IaInsightDTO[] {
  const out: IaInsightDTO[] = [];

  // 1) Vacas a secar (janela dos próximos 30 dias, inclui atrasadas).
  if (ctx.aSecar.length) {
    const n = ctx.aSecar.length;
    const primeira = ctx.aSecar[0];
    out.push({
      id: "rb-secar",
      escopo: "rebanho",
      dominio: "reproducao",
      texto:
        `${b(n)} ${n === 1 ? "vaca prenhe entra" : "vacas prenhes entram"} na janela de secagem dos próximos 30 dias — ` +
        `a mais urgente é ${b(apelido(primeira.numero, primeira.nome))}, secar até ${b(primeira.previsaoSecagem)}. ` +
        `Secar no ponto certo protege o período seco e a próxima lactação.`,
      acoes: [{ label: "Ver vacas a secar", primaria: true }, { label: "Agendar secagem" }],
    });
  }

  // 2) CCS/mastite em alerta (≥ 400 mil cél/mL). Card no animal mais crítico.
  if (ctx.ccsAlto.length) {
    const pior = ctx.ccsAlto[0];
    const n = ctx.ccsAlto.length;
    const subindo = ctx.ccsAlto.filter((a) => a.tendencia === "subindo").length;
    out.push({
      id: "rb-ccs",
      escopo: "animal",
      dominio: "sanidade",
      animalId: pior.numero,
      texto:
        `${b(n)} ${n === 1 ? "vaca está" : "vacas estão"} com CCS alto (≥ 400 mil cél/mL)` +
        `${subindo ? `, ${b(subindo)} com tendência de subida` : ""}. ` +
        `A pior é ${b(apelido(pior.numero, pior.nome))} — ${b(`${pior.ccs} mil`)}${pior.tendencia ? ` e ${pior.tendencia}` : ""}. ` +
        `Risco de mastite subclínica: candidata a cultura no próximo controle.`,
      acoes: [{ label: "Ver vacas com CCS alto", primaria: true }, { label: "Agendar cultura" }],
    });
  }

  // 3) Vazias atrasadas (DEL > 90 / PEV estourado) → prenhez.
  if (ctx.vaziasAtrasadas.length) {
    const n = ctx.vaziasAtrasadas.length;
    const primeira = ctx.vaziasAtrasadas[0];
    const pct = ctx.prenhezPct;
    out.push({
      id: "rb-vazias",
      escopo: "rebanho",
      dominio: "reproducao",
      texto:
        `${b(n)} ${n === 1 ? "vaca vazia passou" : "vacas vazias passaram"} do período voluntário de espera (DEL > 90)` +
        `${pct != null ? ` — a prenhez do rebanho está em ${b(`${pct}%`)}` : ""}. ` +
        `Ex.: ${b(apelido(primeira.numero, primeira.nome))} com ${b(`${primeira.del ?? "—"} DEL`)}. ` +
        `Cada dia aberto além do ideal empurra o IEP e custa leite.`,
      acoes: [{ label: "Ver vazias atrasadas", primaria: true }, { label: "Programar IATF" }],
    });
  }

  // 4) Partos previstos (gestação avançada) → preparar maternidade.
  if (ctx.partosPrevistos.length) {
    const n = ctx.partosPrevistos.length;
    const primeira = ctx.partosPrevistos[0];
    out.push({
      id: "rb-partos",
      escopo: "rebanho",
      dominio: "reproducao",
      texto:
        `${b(n)} ${n === 1 ? "vaca está" : "vacas estão"} com gestação avançada e parto previsto em breve — ` +
        `a mais adiantada é ${b(apelido(primeira.numero, primeira.nome))} com ${b(`${primeira.diasGestacao ?? "—"} dias`)}. ` +
        `Vale preparar a maternidade e revisar o manejo de pré-parto.`,
      acoes: [{ label: "Ver partos previstos", primaria: true }],
    });
  }

  return out.slice(0, 4);
}
