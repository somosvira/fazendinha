import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { carregarVersaoTx } from "../protocolos/versoes.js";
import { criarProgramacaoReprodutivaTx, resolverIdReprodutivoTx } from "../protocolos/reproducao.js";
import { criarParticipacaoPlanejadaTx, iniciarParticipanteTx } from "./iatf.js";
import { lerDataIatf } from "./horarios.calc.js";
import { erro } from "./registros.js";

const inicioIatfSchema = z.object({
  versao: z.literal(1), protocoloId: z.string().uuid(), nomeProtocolo: z.string().min(1),
  versaoProtocolo: z.number().int().positive(), programacaoId: z.string().uuid().optional(),
  criadaPorId: z.number().int().positive().nullable().optional(),
}).strict();
export type ContextoInicioIatf = z.infer<typeof inicioIatfSchema>;
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));

/** Somente o servidor define o vínculo da programação. Preparar não cria fatos clínicos. */
export async function prepararContextoInicioIatfTx(tx: Prisma.TransactionClient, contexto: Record<string, unknown>) {
  if (contexto.inicioIatf != null || contexto.programacaoId != null)
    erro("O vínculo da programação é definido na confirmação", "contexto");
  if (typeof contexto.protocoloId !== "string") erro("Selecione o protocolo reprodutivo", "protocoloId");
  const protocoloId = await resolverIdReprodutivoTx(tx, "protocolo", contexto.protocoloId);
  const p = await carregarVersaoTx(tx, protocoloId, "REPRODUTIVO");
  if (!p.ativo || !p.publicado || !p.publicadoEm) erro("Selecione uma versão publicada e ativa do protocolo", "protocoloId");
  const inicioIatf: ContextoInicioIatf = { versao: 1, protocoloId: p.id, nomeProtocolo: p.nome, versaoProtocolo: p.versao };
  return { ...contexto, protocoloId: p.id, inicioIatf };
}

/** Chamado com animais e visita travados; o contexto é relido em cada bloco. */
export async function confirmarInicioIatfVisitaTx(tx: Prisma.TransactionClient,
  atividade: { id: string; nome: string; contexto: Prisma.JsonValue }, animalId: string,
  propriedadeId: number, dados: Record<string, unknown>, usuarioId: number | null,
) {
  if (typeof dados.inicioEfetivo !== "string") erro("Informe o início efetivo", "inicioEfetivo");
  const atual = await tx.atividadeVisita.findUniqueOrThrow({ where: { id: atividade.id } });
  const contexto = z.record(z.unknown()).parse(atual.contexto);
  const salvo = contexto.inicioIatf == null ? null : inicioIatfSchema.parse(contexto.inicioIatf);
  const protocoloInformado = salvo?.protocoloId ?? contexto.protocoloId;
  const protocoloId = typeof protocoloInformado === "string" ? await resolverIdReprodutivoTx(tx, "protocolo", protocoloInformado) : null;
  if (salvo && contexto.protocoloId !== salvo.protocoloId) erro("O protocolo da atividade diverge do início planejado", "protocoloId");
  const explicita = typeof dados.participanteIatfId === "string" && dados.participanteIatfId
    ? await resolverIdReprodutivoTx(tx, "participacao", dados.participanteIatfId) : null;
  if (!protocoloId && !explicita) erro("Atividade antiga sem protocolo: selecione uma participação explicitamente", "participanteIatfId");
  const pendencias = await tx.participacaoProtocolo.findMany({ where: {
    ...(explicita ? { id: explicita } : { animalId, propriedadeId, protocoloId: protocoloId!, inicioEfetivo: null, canceladaEm: null,
      rodada: { status: "ABERTA", propriedadeId } }),
  }, include: { rodada: true } });
  const participante = pendencias[0];
  if (explicita && (!participante || participante.animalId !== animalId || participante.propriedadeId !== propriedadeId
    || (protocoloId && participante.protocoloId !== protocoloId) || participante.canceladaEm || participante.inicioEfetivo
    || participante.rodada?.status !== "ABERTA" || participante.rodada.propriedadeId !== propriedadeId))
    erro("Participação incompatível com animal, sítio, protocolo ou início pendente", "participanteIatfId");
  if (!explicita && pendencias.length > 1) erro("Há várias participações compatíveis; escolha qual iniciar", "participanteIatfId");
  const protocolo = await carregarVersaoTx(tx, protocoloId ?? participante!.protocoloId, "REPRODUTIVO");
  if (!protocolo.ativo || !protocolo.publicado || !protocolo.publicadoEm)
    erro("O protocolo não está publicado e ativo", "protocoloId");
  let programacaoId = salvo?.programacaoId;
  if (programacaoId) {
    const programacao = await tx.programacaoProtocolo.findFirst({ where: { id: programacaoId, protocoloId: protocolo.id,
      propriedadeId, status: "ABERTA", criadoPorId: salvo!.criadaPorId } });
    if (!programacao || !Object.prototype.hasOwnProperty.call(salvo, "criadaPorId"))
      throw new RebanhoError("CONFLITO", "Programação vinculada à atividade não é compatível", "contexto");
  }
  let participacaoId = participante?.id;
  if (!participacaoId) {
    if (!programacaoId) {
      const temporal = lerDataIatf(dados.inicioEfetivo);
      const programa = await criarProgramacaoReprodutivaTx(tx, { data: { propriedadeId, protocoloId: protocolo.id,
        nome: atividade.nome, inicioPrevisto: temporal.instante, precisaoTemporal: temporal.precisao, criadoPorId: usuarioId } });
      programacaoId = programa.id;
      const inicioIatf: ContextoInicioIatf = { versao: 1, protocoloId: protocolo.id, nomeProtocolo: protocolo.nome,
        versaoProtocolo: protocolo.versao, programacaoId, criadaPorId: usuarioId };
      await tx.atividadeVisita.update({ where: { id: atividade.id }, data: { contexto: json({ ...contexto, protocoloId: protocolo.id, inicioIatf }) } });
      await auditar(tx, { entidade: "ProgramacaoIatf", entidadeId: programa.id, propriedadeId, acao: "CRIACAO", usuarioId,
        depois: { programacao: programa, atividadeVisitaId: atividade.id } });
    }
    participacaoId = (await criarParticipacaoPlanejadaTx(tx, programacaoId, animalId, dados.inicioEfetivo, usuarioId)).id;
  }
  return iniciarParticipanteTx(tx, participacaoId, propriedadeId, dados.inicioEfetivo, usuarioId, dados.cienciaSanitaria === true);
}
