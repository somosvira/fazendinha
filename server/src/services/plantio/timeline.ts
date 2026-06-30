import { prisma } from "../../db.js";
import type { EventoTimeline } from "./mock.js";
import type { CriarOperacaoInput } from "./schemas.js";

export class PlantioEventoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MES_FECHADO", message: string) {
    super(message);
  }
}

// ── Builder da timeline tecida do talhão ─────────────────────────────────────
// Espelha rebanho/timeline.ts: lê as 5 tabelas de eventos estruturados do
// talhão, mapeia cada linha para o DTO editorial (EventoTimeline) e ordena por
// data DESC. A forma do DTO casa com client/src/plantio/types.ts.

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
const num = (x: any) => (x != null ? Number(x) : undefined);

// Domínio derivado do tipo de operação agrícola.
function dominioDaOperacao(tipo: string): EventoTimeline["dominio"] {
  if (/ADUBACAO|CALAGEM|GESSAGEM/.test(tipo)) return "nutricao";
  if (/APLICACAO|MONITORAMENTO_MIP/.test(tipo)) return "fitossanidade";
  return "fenologia"; // podas, desbrota, roçagem, irrigação, replantio, capina
}

// Título humano legível a partir do tipo da operação.
const TITULO_OPERACAO: Record<string, string> = {
  ADUBACAO_SOLO: "Adubação de solo",
  ADUBACAO_FOLIAR: "Adubação foliar",
  CALAGEM: "Calagem",
  GESSAGEM: "Gessagem",
  APLICACAO_FUNGICIDA: "Aplicação fungicida",
  APLICACAO_INSETICIDA: "Aplicação inseticida",
  APLICACAO_HERBICIDA: "Aplicação herbicida",
  ROCAGEM_MECANICA: "Roçagem mecânica",
  CAPINA_MANUAL: "Capina manual",
  PODA_RECEPA: "Poda de recepa",
  PODA_DECOTE: "Poda de decote",
  PODA_ESQUELETAMENTO: "Esqueletamento",
  PODA_DESPONTE: "Desponte",
  DESBROTA: "Desbrota",
  IRRIGACAO: "Irrigação",
  REPLANTIO: "Replantio",
  AMOSTRAGEM_SOLO: "Amostragem de solo",
  AMOSTRAGEM_FOLIAR: "Amostragem foliar",
  MONITORAMENTO_MIP: "Monitoramento MIP",
};

const METODO_TITULO: Record<string, string> = {
  DERRICA_PANO: "derriça no pano",
  DERRICA_MECANIZADA: "derriça mecanizada",
  SELETIVA: "colheita seletiva",
  VARRICAO: "varrição",
};

const ORDINAL = ["", "1ª", "2ª", "3ª", "4ª", "5ª", "6ª"];

export function operacaoToTimeline(o: any): EventoTimeline {
  return {
    id: `op-${o.id}`,
    talhaoId: String(o.talhaoId),
    data: iso(o.data),
    dominio: dominioDaOperacao(o.tipo),
    titulo: TITULO_OPERACAO[o.tipo] ?? "Operação agrícola",
    detalhe: o.produto ?? o.observacao ?? undefined,
    responsavel: o.responsavel ?? undefined,
  };
}

export function inspecaoToTimeline(i: any): EventoTimeline {
  // Alerta quando há incidência relevante registrada (ferrugem ≥5% ou broca ≥3%).
  const ferr = num(i.ferrugem);
  const broca = num(i.broca);
  const alerta = (ferr != null && ferr >= 5) || (broca != null && broca >= 3) || undefined;
  const partes = [
    ferr != null ? `ferrugem ${ferr}%` : null,
    num(i.bichoMineiro) != null ? `bicho-mineiro ${num(i.bichoMineiro)}%` : null,
    broca != null ? `broca ${broca}%` : null,
  ].filter(Boolean);
  return {
    id: `insp-${i.id}`,
    talhaoId: String(i.talhaoId),
    data: iso(i.data),
    dominio: "fitossanidade",
    titulo: "Inspeção MIP",
    detalhe: partes.length ? partes.join(" · ") : i.observacao ?? undefined,
    alerta,
    responsavel: i.responsavel ?? undefined,
  };
}

export function amostraSoloToTimeline(s: any): EventoTimeline {
  const partes = [
    num(s.pH) != null ? `pH ${num(s.pH)}` : null,
    num(s.v) != null ? `V ${num(s.v)}%` : null,
  ].filter(Boolean);
  return {
    id: `sol-${s.id}`,
    talhaoId: String(s.talhaoId),
    data: iso(s.data),
    dominio: "nutricao",
    titulo: "Análise de solo",
    detalhe: partes.length ? partes.join(" · ") : s.observacao ?? undefined,
  };
}

export function amostraFoliarToTimeline(f: any): EventoTimeline {
  const partes = [
    num(f.nFoliar) != null ? `N ${num(f.nFoliar)}%` : null,
    num(f.kFoliar) != null ? `K ${num(f.kFoliar)}%` : null,
  ].filter(Boolean);
  return {
    id: `fol-${f.id}`,
    talhaoId: String(f.talhaoId),
    data: iso(f.data),
    dominio: "nutricao",
    titulo: "Análise foliar",
    detalhe: partes.length ? partes.join(" · ") : f.observacao ?? undefined,
  };
}

export function passadaToTimeline(p: any): EventoTimeline {
  const ord = ORDINAL[p.numero] ?? `${p.numero}ª`;
  const metodo = METODO_TITULO[p.metodo] ?? "passada";
  const sacas = num(p.sacasBeneficiadas);
  return {
    id: `col-${p.id}`,
    talhaoId: String(p.talhaoId),
    data: iso(p.data),
    dominio: "colheita",
    titulo: `${ord} passada — ${metodo}`,
    detalhe: p.observacao ?? undefined,
    impacto: sacas != null && sacas > 0 ? `≈ ${sacas} sc beneficiadas` : undefined,
    responsavel: p.responsavel ?? undefined,
  };
}

// Cria uma OperacaoAgricola e devolve o evento já no formato da timeline, para
// a OperacaoForm do cliente reaproveitar direto na lista. Respeita
// FechamentoMensal (regra do domínio): não registra em mês de caixa fechado.
export async function criarOperacao(talhaoId: number, input: CriarOperacaoInput): Promise<EventoTimeline> {
  if (!(await prisma.talhao.findUnique({ where: { id: talhaoId }, select: { id: true } }))) {
    throw new PlantioEventoError("NAO_ENCONTRADO", "talhão não encontrado");
  }
  const data = new Date(input.data);
  const fechado = await prisma.fechamentoMensal.findUnique({
    where: { ano_mes: { ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } },
  });
  if (fechado) throw new PlantioEventoError("MES_FECHADO", "mês fechado — operação não pode ser registrada");

  const o = await prisma.operacaoAgricola.create({
    data: {
      talhaoId,
      // Domínio é derivado do tipo (server-authoritative): nunca diverge do que a
      // timeline reconstrói na leitura. O input.dominio do cliente é ignorado aqui.
      dominio: dominioDaOperacao(input.tipo).toUpperCase() as CriarOperacaoInput["dominio"],
      tipo: input.tipo,
      data,
      responsavel: input.responsavel ?? null,
      produto: input.produto ?? null,
      observacao: input.observacao ?? null,
      doseValor: input.doseValor ?? null,
      doseUnidade: input.doseUnidade ?? null,
      pragaAlvo: input.pragaAlvo ?? null,
    },
  });
  return operacaoToTimeline(o);
}

export async function montarTimeline(talhaoId: number): Promise<EventoTimeline[]> {
  const [ops, insps, solos, foliares, passadas] = await Promise.all([
    prisma.operacaoAgricola.findMany({ where: { talhaoId } }),
    prisma.inspecaoMIP.findMany({ where: { talhaoId } }),
    prisma.amostraSolo.findMany({ where: { talhaoId } }),
    prisma.amostraFoliar.findMany({ where: { talhaoId } }),
    prisma.passadaColheita.findMany({ where: { talhaoId } }),
  ]);
  return [
    ...ops.map(operacaoToTimeline),
    ...insps.map(inspecaoToTimeline),
    ...solos.map(amostraSoloToTimeline),
    ...foliares.map(amostraFoliarToTimeline),
    ...passadas.map(passadaToTimeline),
  ].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
