import { preverAutomacoesAdesao } from "./automacao.js";
import { z } from "zod";
import { transacaoPecuaria } from "../transacao.js";
import { AvisoAptidaoProgramacao } from "../reproducao/elegibilidade.js";
import { conferirDisponibilidadeTx } from "../reproducao/registros.js";
import { dataDisponibilidadeIatf, lerDataIatf } from "../reproducao/horarios.calc.js";
import { RebanhoError } from "../rebanho/regras.js";
import { previaParticipacaoIndividualSchema } from "./operacao.schemas.js";
import { preverParticipacaoIndividual } from "./operacao.js";

export const previaProgramacaoSchema = previaParticipacaoIndividualSchema.omit({ tipo: true, animalId: true }).extend({
  aptidaoComoAviso: z.boolean().optional(),
  cienciaSanitaria: z.boolean().optional(),
  animaisIds: z.array(z.string().uuid()).min(1).max(100).refine(ids => new Set(ids).size === ids.length, "Selecione animais distintos"),
});
/** Mesma versão e início para o grupo: consulta o calendário uma vez, sem escrever fatos. */
export async function preverProgramacaoColetiva(entrada: unknown) {
  const input = previaProgramacaoSchema.parse(entrada);
  const { animaisIds, cienciaSanitaria, aptidaoComoAviso, ...calendario } = input;
  const referencia = dataDisponibilidadeIatf(lerDataIatf(input.inicioReferencia));
  const { participantes, avisosAptidao } = await transacaoPecuaria(async tx => {
    const encontrados = await tx.animal.findMany({
      where: { id: { in: animaisIds }, localizacoes: { some: { propriedadeId: input.propriedadeId, ate: null } }, baixas: { none: { estornadaEm: null } } },
      select: { id: true, brinco: true, nome: true },
    });
    const porId = new Map(encontrados.map(animal => [animal.id, animal]));
    const participantes = [];
    const avisosAptidao: { animalId: string; mensagem: string }[] = [];
    for (const id of animaisIds) {
      const animal = porId.get(id);
      if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Um ou mais animais não estão disponíveis neste sítio. Atualize a seleção.");
      try {
        await conferirDisponibilidadeTx(tx, id, input.propriedadeId, referencia, "IATF", cienciaSanitaria);
      } catch (erro) {
        if (!(erro instanceof RebanhoError)) throw erro;
        const identificacao = animal.nome ? `${animal.brinco} · ${animal.nome}` : animal.brinco;
        const mensagem = `${identificacao}: ${erro.message}`;
        if (!aptidaoComoAviso || !(erro instanceof AvisoAptidaoProgramacao)) {
          throw new RebanhoError(erro.code, mensagem, erro.campo);
        }
        avisosAptidao.push({ animalId: id, mensagem });
      }
      participantes.push(animal);
    }
    return { participantes, avisosAptidao };
  });
  const previa = await preverParticipacaoIndividual({ ...calendario, tipo: "REPRODUTIVO", animalId: animaisIds[0] });
  const automaticas = await preverAutomacoesAdesao({ propriedadeId: input.propriedadeId, protocoloId: input.protocoloId, animais: [{animalId: animaisIds[0], inicioPrevisto: input.inicioReferencia}] });
  const itens = previa.itens.map(e => { const automatica = automaticas.itens.find(a => a.etapaId === e.id); return automatica ? {...e, previstaPara: automatica.programadaPara, precisaoTemporal: "HORA" as const} : e; });
  return { protocolo: {nome:previa.protocolo.nome,versao:previa.protocolo.versao}, itens, total: previa.total, pagina: previa.pagina, porPagina: previa.porPagina, participantes, avisosAptidao,
    avisos: [] };
}
