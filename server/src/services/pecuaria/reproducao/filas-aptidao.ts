import type { Prisma } from "@prisma/client";
import { permiteAvaliacaoAptidao, type ElegibilidadeNaData } from "./elegibilidade.calc.js";
import { obterElegibilidadesNaDataTx } from "./elegibilidade.js";
import { FINALIDADE_APTIDAO } from "./toque-aptidao.calc.js";
import { NOME_TIPO } from "./toque-aptidao.js";

export async function carregarFilasAptidaoTx(tx: Prisma.TransactionClient, ids: string[], propriedadeId: number, referencia: Date, elegibilidadesCarregadas?: Map<string, ElegibilidadeNaData>) {
  if (!ids.length) return [];
  const [elegibilidades, tipo, agendados] = await Promise.all([
    elegibilidadesCarregadas ?? obterElegibilidadesNaDataTx(tx, ids, propriedadeId, referencia),
    tx.tipoExame.findUnique({ where: { nome: NOME_TIPO }, select: { id: true } }),
    tx.participanteVisita.findMany({ where: { animalId: { in: ids }, status: "PENDENTE", AtividadeVisita: {
      contexto: { path: ["finalidade"], equals: FINALIDADE_APTIDAO }, VisitaVeterinaria: { propriedadeId, encerradaEm: null },
    } }, include: { AtividadeVisita: { include: { VisitaVeterinaria: true } } } }),
  ]);
  return [...elegibilidades.values()].flatMap(e => {
    if (!permiteAvaliacaoAptidao(e)) return [];
    if (!e.necessidadeAptidao && !e.aptidaoClinica?.exameId) return [];
    const necessidadeId = e.necessidadeAptidao?.necessidadeId ?? `APTIDAO:${e.animalId}:${e.ciclo?.chaveCiclo ?? "INICIAL"}`;
    const visitas = agendados.filter(p => p.animalId === e.animalId && (p.snapshot as Prisma.JsonObject).necessidadeAptidaoId === necessidadeId)
      .map(p => ({ id: p.AtividadeVisita.VisitaVeterinaria.id, nome: p.AtividadeVisita.VisitaVeterinaria.nome, data: p.AtividadeVisita.VisitaVeterinaria.data.toISOString().slice(0, 10) }));
    const clinica = e.aptidaoClinica;
    const fila = visitas.length ? "AGENDAMENTO" : clinica?.retornoEm ? "RETORNO" : clinica?.estado === "APTA" || clinica?.estado === "NAO_APTA" ? "APTIDAO" : e.necessidadeAptidao?.estado ?? "MANUAL";
    return [{ animalId: e.animalId, necessidadeId, fila, tipoExameId: tipo?.id ?? null, clinica,
      necessidade: e.necessidadeAptidao, visitasAbertas: visitas, pevOriginalAte: e.pevOriginalAte }];
  });
}
