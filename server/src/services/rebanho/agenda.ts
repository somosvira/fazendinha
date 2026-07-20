import { prisma } from "../../db.js";
import { montarAgenda, type ItemAgenda, type ItemAgendaIn } from "./agenda.calc.js";
import { listarProgramacoes } from "./iatf-lote.js";

const iso = (x: Date) => new Date(x).toISOString().slice(0, 10);
const hojeUTC = () => new Date().toISOString().slice(0, 10);

// Agenda unificada de manejos futuros: junta as vacinas agendadas pendentes + a próxima etapa
// de cada programação IATF de lote. Só uma VISÃO — o registro continua nas telas de origem.
export async function obterAgenda(propriedadeId: number | null, dias?: number): Promise<ItemAgenda[]> {
  const hoje = hojeUTC();
  const escopoAnimal = propriedadeId == null ? {} : { propriedadeId };

  // Fonte 1: vacinas agendadas ainda não aplicadas.
  const vacinas = await prisma.vacinaAgendada.findMany({
    where: { aplicadaEm: null, animal: escopoAnimal },
    select: { vacina: true, dataPrevista: true, animal: { select: { numero: true } } },
  });
  const itensVacina: ItemAgendaIn[] = vacinas.map((v) => ({
    tipo: "VACINA", data: iso(v.dataPrevista), titulo: v.vacina, alvo: `#${v.animal.numero}`,
  }));

  // Fonte 2: próxima etapa de cada programação IATF de lote (só as não concluídas).
  const programacoes = await listarProgramacoes(propriedadeId);
  const itensIatf: ItemAgendaIn[] = programacoes
    .filter((p) => !p.concluido && p.proxima != null)
    .map((p) => ({
      tipo: "IATF",
      data: p.proxima!.data,
      titulo: `${p.proxima!.rotulo} — ${p.proxima!.acao}`,
      alvo: p.grupoNome ?? p.nome ?? p.protocoloNome,
    }));

  let itens = montarAgenda([...itensVacina, ...itensIatf], hoje);
  // Janela opcional: mantém atrasados sempre; corta futuros além de `dias`.
  if (dias != null && dias > 0) {
    itens = itens.filter((i) => i.status === "atrasado" || i.diasParaData <= dias);
  }
  return itens;
}
