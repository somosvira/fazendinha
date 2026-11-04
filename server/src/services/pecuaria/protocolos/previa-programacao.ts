import { preverAutomacoesAdesao } from "./automacao.js";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { previaParticipacaoIndividualSchema } from "./operacao.schemas.js";
import { preverParticipacaoIndividual } from "./operacao.js";

export const previaProgramacaoSchema = previaParticipacaoIndividualSchema.omit({ tipo: true, animalId: true }).extend({
  animaisIds: z.array(z.string().uuid()).min(1).max(100).refine(ids => new Set(ids).size === ids.length, "Selecione animais distintos"),
});
/** Mesma versão e início para o grupo: consulta o calendário uma vez, sem escrever fatos. */
export async function preverProgramacaoColetiva(entrada: unknown) {
  const input = previaProgramacaoSchema.parse(entrada);
  const animais = await prisma.animal.findMany({
    where: { id: { in: input.animaisIds }, localizacoes: { some: { propriedadeId: input.propriedadeId, ate: null } }, baixas: { none: { estornadaEm: null } } },
    select: { id: true, brinco: true, nome: true },
  });
  if (animais.length !== input.animaisIds.length) throw new RebanhoError("NAO_ENCONTRADO", "Um ou mais animais não estão disponíveis neste sítio. Atualize a seleção.");
  const { animaisIds, ...calendario } = input;
  const previa = await preverParticipacaoIndividual({ ...calendario, tipo: "REPRODUTIVO", animalId: animaisIds[0] });
  const automaticas = await preverAutomacoesAdesao({ propriedadeId: input.propriedadeId, protocoloId: input.protocoloId, animais: [{animalId: animaisIds[0], inicioPrevisto: input.inicioReferencia}] });
  const itens = previa.itens.map(e => { const automatica = automaticas.itens.find(a => a.etapaId === e.id); return automatica ? {...e, previstaPara: automatica.programadaPara, precisaoTemporal: "HORA" as const} : e; });
  return { protocolo: {nome:previa.protocolo.nome,versao:previa.protocolo.versao}, itens, total: previa.total, pagina: previa.pagina, porPagina: previa.porPagina, participantes: animais,
    avisos: ["A conferência não inclui animais nem registra atendimentos. Elegibilidade e disponibilidade serão verificadas novamente ao confirmar."] };
}
