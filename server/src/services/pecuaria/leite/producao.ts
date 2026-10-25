import { Prisma } from "@prisma/client";
import { auditar, hojeFazendaDate, RebanhoError, travarAnimais, type DbPecuaria } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { transacaoPecuaria } from "../transacao.js";
import { buscarConfiguracaoLeiteTx, configuracaoDTO, conferirSitioLeiteTx, garantirConfiguracaoLeiteTx, travarRotinaLeiteTx } from "./configuracoes.js";
import { evidenciaFinalidadeLeite, resolverFinalidadeLeite } from "./finalidade.calc.js";
import { contextoAnimalLeite, lactacaoVigenteLeite, type AnimalContextoLeite } from "./populacao.calc.js";
import { conferirCorrecaoMedicao, medicaoMudou, resumirProducao } from "./producao.calc.js";
import { salvarFolhaSchema, type SalvarFolhaInput } from "./schemas.js";
import type { AnimalFolhaLeiteDTO, ConfiguracaoOrdenhaDTO, FolhaLeiteDTO, MedicaoLeiteDTO } from "./contratos.js";
import { exigirSessaoLeiteEditavelTx } from "./estoque.js";
import { preSelecionarOrigensGerais } from "./origens-automaticas.calc.js";
export type { FolhaLeiteDTO } from "./contratos.js";

const incluirEntrada = { movimento: { select: { produtoId: true, quantidade: true } }, classificacoes: { orderBy: { versao: "desc" as const }, take: 1 } };
const incluirDia = {
  configuracao: { include: { ordenhas: { orderBy: { ordem: "asc" as const } } } },
  sessoes: { orderBy: { ordem: "asc" as const }, include: { entradasEstoque: { include: incluirEntrada } } },
  participantes: { include: { medicoes: { include: { origensEstoque: { where: { ativo: true }, include: { entrada: { include: incluirEntrada } } } } } }, orderBy: [{ brinco: "asc" as const }, { animalId: "asc" as const }] },
};
type Dia = Prisma.DiaProducaoLeiteGetPayload<{ include: typeof incluirDia }>;
type ContextoParticipante = ReturnType<typeof contextoAnimalLeite>;
const dataTexto = (data: Date) => data.toISOString().slice(0, 10);
function comporFolha(propriedadeId: number, dataOperacional: string, configuracao: ConfiguracaoOrdenhaDTO, animais: AnimalFolhaLeiteDTO[], dia?: Dia): FolhaLeiteDTO {
  const ativos = animais.filter(a => !a.excluidoEm), excluidos = animais.filter(a => a.excluidoEm);
  return { id: dia?.id ?? null, propriedadeId, dataOperacional, versao: dia?.versao ?? 0, congelada: Boolean(dia), configuracao,
    animais: ativos, animaisExcluidos: excluidos, impedimentos: [],
    sessoes: configuracao.ordenhas.map(o => ({ ...o, id: dia?.sessoes.find(s => s.posicaoId === o.posicaoId)?.id ?? null,
      versao: dia?.sessoes.find(s => s.posicaoId === o.posicaoId)?.versao ?? 0,
      entradasEstoque: (dia?.sessoes.find(s => s.posicaoId === o.posicaoId)?.entradasEstoque ?? []).map(e => ({ entradaId: e.id, produtoId: e.movimento.produtoId, natureza: e.classificacoes[0]?.natureza ?? "NAO_INFORMADA", quantidadeLitros: e.movimento.quantidade.toNumber(), status: e.status })),
      totais: resumirProducao(ativos.flatMap(a => a.medicoes.filter(m => m.posicaoId === o.posicaoId)), ativos.length) })),
    totais: resumirProducao(ativos.flatMap(a => a.medicoes), ativos.length * configuracao.ordenhas.length) };
}
export function folhaLeiteDTO(dia: Dia): FolhaLeiteDTO {
  // A configuração e os participantes são snapshots; não consultamos o sítio/lactação atuais.
  const configuracao = configuracaoDTO(dia.configuracao, dia.propriedadeId);
  const animais: AnimalFolhaLeiteDTO[] = dia.participantes.map(p => {
    const medicoes: MedicaoLeiteDTO[] = dia.sessoes.map(s => {
      const m = p.medicoes.find(m => m.sessaoId === s.id);
      const entrada = m?.origensEstoque?.[0]?.entrada;
      return { confirmacaoEstoque: entrada ? { entradaId: entrada.id, produtoId: entrada.movimento.produtoId, natureza: entrada.classificacoes[0]?.natureza ?? "NAO_INFORMADA" } : null, id: m?.id ?? null, posicaoId: s.posicaoId, estado: (m?.estado ?? "PENDENTE") as MedicaoLeiteDTO["estado"],
        litros: m?.litros?.toNumber() ?? null, motivo: m?.motivo ?? null, versao: m?.versao ?? 0 };
    });
    const finalidade = evidenciaFinalidadeLeite(p, dataTexto(dia.dataOperacional));
    return { finalidade, participanteId: p.id, animalId: p.animalId, brinco: p.brinco, nome: p.nome, lactacaoId: p.lactacaoId,
      localizacaoId: p.localizacaoId, pendencias: [...(Array.isArray(p.pendencias) ? p.pendencias.filter((p): p is string => typeof p === "string") : []), ...(finalidade.estado === "PENDENTE_CONCILIACAO" ? ["FINALIDADE_NAO_COMPROVADA"] : [])],
      excluidoEm: p.excluidoEm?.toISOString() ?? null, motivoExclusao: p.motivoExclusao, medicoes, totais: resumirProducao(medicoes) };
  });
  return comporFolha(dia.propriedadeId, dataTexto(dia.dataOperacional), configuracao, animais, dia);
}
async function carregarAnimaisTx(tx: DbPecuaria, propriedadeId: number, data: Date, explicitos: string[] = []) {
  return tx.animal.findMany({ where: { OR: [
    { sexo: "F", localizacoes: { some: { propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } },
      { baixasQueFecharam: { some: { data, estornadaEm: null } } }] } } },
    ...(explicitos.length ? [{ id: { in: explicitos } }] : []),
  ] }, include: { destinos: true, localizacoes: true, baixas: { where: { estornadaEm: null } } }, orderBy: [{ brinco: "asc" }, { id: "asc" }] });
}
async function populacaoTx(tx: DbPecuaria, animais: AnimalContextoLeite[], propriedadeId: number, data: Date, explicitos: string[] = []) {
  const lactacoes = await tx.lactacaoAnimal.findMany({ where: { animalId: { in: animais.map(a => a.id) } } });
  const obrigatorios = new Set(explicitos);
  const populacao: ContextoParticipante[] = [];
  for (const animal of animais) {
    if (!obrigatorios.has(animal.id) && !lactacoes.some(l => l.animalId === animal.id && lactacaoVigenteLeite(l, data))) continue;
    const finalidade = resolverFinalidadeLeite(animal.destinos, data, animal.baixas);
    if (!finalidade.elegivel && !obrigatorios.has(animal.id)) continue;
    populacao.push(contextoAnimalLeite(animal, lactacoes, propriedadeId, data));
  }
  if (explicitos.some(id => !populacao.some(p => p.animalId === id)))
    throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio na data");
  return populacao;
}
export async function consultarOrigensAutomaticasGeraisTx(tx: DbPecuaria, propriedadeId: number, data: Date) {
  const animais = await carregarAnimaisTx(tx, propriedadeId, data);
  const lactacoes = await tx.lactacaoAnimal.findMany({ where: { animalId: { in: animais.map(a => a.id) } } });
  return preSelecionarOrigensGerais(animais, lactacoes, propriedadeId, data);
}
function medicaoPendente(posicaoId: string): MedicaoLeiteDTO {
  return { id: null, posicaoId, estado: "PENDENTE", litros: null, motivo: null, versao: 0, confirmacaoEstoque: null };
}
export async function consultarFolha(propriedadeId: number, dataOperacional: string): Promise<FolhaLeiteDTO> {
  return transacaoPecuaria(async tx => {
    await conferirSitioLeiteTx(tx, propriedadeId);
    const data = new Date(`${dataOperacional}T00:00:00Z`);
    const dia = await tx.diaProducaoLeite.findUnique({ where: { propriedadeId_dataOperacional: { propriedadeId, dataOperacional: data } }, include: incluirDia });
    if (dia && (dia.participantes.length || dia.configuracao.fonteProducao !== "GERAL")) return folhaLeiteDTO(dia);
    const configuracao = configuracaoDTO(await buscarConfiguracaoLeiteTx(tx, propriedadeId, data), propriedadeId);
    const populacao = await populacaoTx(tx, await carregarAnimaisTx(tx, propriedadeId, data), propriedadeId, data);
    const animais = populacao.map(p => {
      const medicoes = configuracao.ordenhas.map(o => medicaoPendente(o.posicaoId));
      return { ...p, finalidade: evidenciaFinalidadeLeite(p, dataOperacional), participanteId: null, excluidoEm: null, motivoExclusao: null, medicoes, totais: resumirProducao(medicoes) };
    });
    const folha = comporFolha(propriedadeId, dataOperacional, configuracao, animais, dia ?? undefined);
    const candidatos = await carregarAnimaisTx(tx, propriedadeId, data);
    folha.impedimentos = candidatos.flatMap(a => {
      const f = resolverFinalidadeLeite(a.destinos, data, a.baixas);
      return f.elegivel ? [] : [{ animalId: a.id, brinco: a.brinco, nome: a.nome, codigo: f.codigo, motivo: f.motivo }];
    });
    return folha;
  });
}
export async function listarCandidatos(propriedadeId: number, dataOperacional: string, busca = "", pagina = 1) {
  return transacaoPecuaria(async tx => {
    await conferirSitioLeiteTx(tx, propriedadeId);
    const data = new Date(`${dataOperacional}T00:00:00Z`);
    const filtro = busca.toLocaleLowerCase("pt-BR");
    const animais = (await carregarAnimaisTx(tx, propriedadeId, data)).filter(a => !filtro ||
      a.brinco.toLocaleLowerCase("pt-BR").includes(filtro) || a.nome?.toLocaleLowerCase("pt-BR").includes(filtro));
    const lactacoes = await tx.lactacaoAnimal.findMany({ where: { animalId: { in: animais.map(a => a.id) } } });
    const elegiveis: ContextoParticipante[] = [];
    const impedimentos: { animalId: string; brinco: string; nome: string | null; codigo: string; motivo: string }[] = [];
    for (const animal of animais) {
      try { elegiveis.push(contextoAnimalLeite(animal, lactacoes, propriedadeId, data)); }
      catch (erro) {
        if (!(erro instanceof RebanhoError)) throw erro;
        impedimentos.push({ animalId: animal.id, brinco: animal.brinco, nome: animal.nome, codigo: resolverFinalidadeLeite(animal.destinos, data, animal.baixas).codigo ?? "CONTEXTO_INCOMPATIVEL", motivo: erro.message });
      }
    }
    return { itens: elegiveis.slice((pagina - 1) * 10, pagina * 10).map(p => ({ ...p, finalidade: evidenciaFinalidadeLeite(p, dataOperacional) })), total: elegiveis.length, pagina, porPagina: 10,
      impedimentos: impedimentos.slice(0, 10), totalImpedidos: impedimentos.length };
  });
}
async function adicionarParticipanteTx(tx: Prisma.TransactionClient, dia: Dia, contexto: ContextoParticipante, usuarioId: number | null) {
  const participante = await tx.participanteProducaoLeite.create({ data: { ...contexto, diaId: dia.id, criadoPorId: usuarioId } });
  await tx.medicaoLeite.createMany({ data: dia.sessoes.map(s => ({ diaId: dia.id, sessaoId: s.id, participanteId: participante.id, criadoPorId: usuarioId })) });
  return participante;
}
function exigirMotivoPopulacao(input: SalvarFolhaInput) {
  if (!input.motivoCorrecao) throw new RebanhoError("VALIDACAO", "Explique a inclusão, exclusão ou conciliação da população guardada", "motivoCorrecao");
}
/** Guardas de estoque atuam somente nas sessões efetivamente alteradas. */
export async function salvarFolhaTx(tx: Prisma.TransactionClient, input: SalvarFolhaInput, usuarioId: number | null): Promise<FolhaLeiteDTO> {
  const data = new Date(`${input.dataOperacional}T00:00:00Z`);
  return operacaoIdempotenteTx(tx, input, usuarioId, "SALVAR_FOLHA_LEITE", async () => {
  if (data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "A produção deve ter data até hoje", "dataOperacional");
  const identidadeDia = { propriedadeId: input.propriedadeId, dataOperacional: data };
  const referencia = await tx.diaProducaoLeite.findUnique({ where: { propriedadeId_dataOperacional: identidadeDia }, include: incluirDia });
  const explicitos = [...new Set([...input.animaisAdicionar, ...input.medicoes.map(m => m.animalId), ...(referencia?.participantes.map(p => p.animalId) ?? [])])];
  let candidatos = await carregarAnimaisTx(tx, input.propriedadeId, data, explicitos);
  await travarAnimais(tx, candidatos.map(a => a.id));
  candidatos = await carregarAnimaisTx(tx, input.propriedadeId, data, explicitos);
  await travarRotinaLeiteTx(tx, input.propriedadeId);
  await conferirSitioLeiteTx(tx, input.propriedadeId, true);
    let dia = await tx.diaProducaoLeite.findUnique({ where: { propriedadeId_dataOperacional: identidadeDia }, include: incluirDia });
    if ((dia?.versao ?? 0) !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "A folha mudou; recarregue antes de guardar", "versaoEsperada");
    const nova = dia === null;
    const antes = dia ? folhaLeiteDTO(dia) : null;
    const alteradas = new Set<string>();
    const sessoesConferidas = new Set<string>();
    if (!dia) {
      if (input.animaisExcluir.length) throw new RebanhoError("VALIDACAO", "Não há população guardada para excluir");
      const configuracao = await garantirConfiguracaoLeiteTx(tx, input.propriedadeId, data, usuarioId);
      dia = await tx.diaProducaoLeite.create({ data: { ...identidadeDia, configuracaoId: configuracao.id, criadoPorId: usuarioId,
        sessoes: { create: configuracao.ordenhas.map(o => ({ posicaoId: o.posicaoId, nome: o.nome, ordem: o.ordem, horario: o.horario })) } }, include: incluirDia });
      const populacao = await populacaoTx(tx, candidatos, input.propriedadeId, data, input.animaisAdicionar);
      for (const contexto of populacao) await adicionarParticipanteTx(tx, dia, contexto, usuarioId);
      dia = await tx.diaProducaoLeite.findUniqueOrThrow({ where: { id: dia.id }, include: incluirDia });
    } else if (input.animaisAdicionar.length || input.animaisExcluir.length) {
      exigirMotivoPopulacao(input);
      for (const sessao of [...dia.sessoes].sort((a, b) => a.id.localeCompare(b.id))) {
        await exigirSessaoLeiteEditavelTx(tx, sessao.id);
        sessoesConferidas.add(sessao.id);
      }
      const adicionais = await populacaoTx(tx, candidatos.filter(a => input.animaisAdicionar.includes(a.id)), input.propriedadeId, data, input.animaisAdicionar);
      for (const contexto of adicionais) {
        const anterior = dia.participantes.find(p => p.animalId === contexto.animalId);
        const evidencia = anterior && evidenciaFinalidadeLeite(anterior, input.dataOperacional).estado === "COMPROVADA" && anterior.finalidadeId === contexto.finalidadeId
          ? { finalidadeId: anterior.finalidadeId, finalidadeSnapshot: anterior.finalidadeSnapshot ?? Prisma.JsonNull } : { finalidadeId: contexto.finalidadeId, finalidadeSnapshot: contexto.finalidadeSnapshot };
        const depois = anterior ? await tx.participanteProducaoLeite.update({ where: { id: anterior.id }, data: { ...contexto, ...evidencia, excluidoEm: null, motivoExclusao: null } })
          : await adicionarParticipanteTx(tx, dia, contexto, usuarioId);
        await auditar(tx, { entidade: "ParticipanteProducaoLeite", entidadeId: depois.id, animalId: contexto.animalId, propriedadeId: input.propriedadeId,
          acao: anterior ? "CONCILIACAO_REINCLUSAO" : "INCLUSAO", usuarioId, antes: anterior, depois: { ...depois, motivo: input.motivoCorrecao } });
      }
      for (const animalId of input.animaisExcluir) {
        const anterior = dia.participantes.find(p => p.animalId === animalId && !p.excluidoEm);
        if (!anterior) throw new RebanhoError("VALIDACAO", "Animal não faz parte da população ativa desta folha");
        const depois = await tx.participanteProducaoLeite.update({ where: { id: anterior.id }, data: { excluidoEm: new Date(), motivoExclusao: input.motivoCorrecao } });
        await auditar(tx, { entidade: "ParticipanteProducaoLeite", entidadeId: anterior.id, animalId, propriedadeId: input.propriedadeId,
          acao: "EXCLUSAO", usuarioId, antes: anterior, depois });
      }
      dia.sessoes.forEach(s => alteradas.add(s.id));
      dia = await tx.diaProducaoLeite.findUniqueOrThrow({ where: { id: dia.id }, include: incluirDia });
    }
    // O registro geral cria apenas dia/sessões. A população individual nasce no primeiro controle.
    if (!dia.participantes.length && dia.configuracao.fonteProducao === "GERAL" && input.medicoes.length) {
      const populacao = await populacaoTx(tx, candidatos, input.propriedadeId, data, input.animaisAdicionar);
      for (const contexto of populacao) await adicionarParticipanteTx(tx, dia, contexto, usuarioId);
      dia = await tx.diaProducaoLeite.findUniqueOrThrow({ where: { id: dia.id }, include: incluirDia });
    }
    for (const inputMedicao of input.medicoes) {
      const participante = dia.participantes.find(p => p.animalId === inputMedicao.animalId && !p.excluidoEm);
      const sessao = dia.sessoes.find(s => s.posicaoId === inputMedicao.posicaoId);
      if (!participante || !sessao) throw new RebanhoError("VALIDACAO", "Animal ou ordenha não pertence à folha; faça a inclusão explícita quando necessária");
      const anterior = participante.medicoes.find(m => m.sessaoId === sessao.id);
      if (!anterior) throw new RebanhoError("CONFLITO", "Célula da folha indisponível; recarregue os dados");
      if (!medicaoMudou(anterior, inputMedicao)) continue;
      conferirCorrecaoMedicao(anterior, input.motivoCorrecao);
      if (!nova && !sessoesConferidas.has(sessao.id)) {
        await exigirSessaoLeiteEditavelTx(tx, sessao.id);
        sessoesConferidas.add(sessao.id);
      }
      if (inputMedicao.estado !== "PENDENTE") {
        const animal = candidatos.find(a => a.id === participante.animalId);
        if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
        const [contexto] = await populacaoTx(tx, [animal], input.propriedadeId, data, [animal.id]);
        const evidencia = evidenciaFinalidadeLeite(participante, input.dataOperacional);
        if (evidencia.estado !== "COMPROVADA" || participante.finalidadeId !== contexto.finalidadeId) {
          exigirMotivoPopulacao(input);
          if (participante.medicoes.some(m => m.origensEstoque?.length))
            throw new RebanhoError("CONFLITO", "A finalidade histórica da medição precisa de conciliação; regularize as confirmações antes de alterar a folha", "finalidade");
          await tx.participanteProducaoLeite.update({ where: { id: participante.id }, data: { finalidadeId: contexto.finalidadeId, finalidadeSnapshot: contexto.finalidadeSnapshot } });
          await auditar(tx, { entidade: "ParticipanteProducaoLeite", entidadeId: participante.id, animalId: animal.id, propriedadeId: input.propriedadeId,
            acao: "CONCILIACAO_FINALIDADE", usuarioId, antes: participante, depois: { ...contexto, motivo: input.motivoCorrecao } });
        }
      }
      const depois = await tx.medicaoLeite.update({ where: { id: anterior.id, versao: anterior.versao }, data: { estado: inputMedicao.estado,
        litros: inputMedicao.litros == null ? null : new Prisma.Decimal(inputMedicao.litros), motivo: inputMedicao.motivo || null,
        versao: { increment: 1 }, atualizadoPorId: usuarioId } });
      alteradas.add(sessao.id);
      await auditar(tx, { entidade: "MedicaoLeite", entidadeId: anterior.id, animalId: participante.animalId, propriedadeId: input.propriedadeId,
        acao: anterior.estado === "PENDENTE" ? "MEDICAO" : "CORRECAO", usuarioId, antes: anterior, depois: { ...depois, motivoCorrecao: input.motivoCorrecao ?? null } });
    }
    if (!nova && alteradas.size) {
      await tx.sessaoOrdenha.updateMany({ where: { id: { in: [...alteradas] } }, data: { versao: { increment: 1 } } });
      await tx.diaProducaoLeite.update({ where: { id: dia.id, versao: input.versaoEsperada }, data: { versao: { increment: 1 } } });
    }
    const salva = folhaLeiteDTO(await tx.diaProducaoLeite.findUniqueOrThrow({ where: { id: dia.id }, include: incluirDia }));
    if (nova || alteradas.size) await auditar(tx, { entidade: "DiaProducaoLeite", entidadeId: dia.id, propriedadeId: input.propriedadeId,
      acao: nova ? "RASCUNHO_INICIAL" : "RASCUNHO_ATUALIZADO", usuarioId, antes, depois: { ...salva, motivoCorrecao: input.motivoCorrecao ?? null } });
    return salva;
  });
}
export async function salvarFolha(input: SalvarFolhaInput, usuarioId: number | null) {
  const validado = salvarFolhaSchema.parse(input);
  return transacaoPecuaria(tx => salvarFolhaTx(tx, validado, usuarioId));
}

/** Identifica origens sem atribuir litros individuais a uma aferição geral. */
export async function conferirAnimaisOrigemGeralTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date, ids: string[]) {
  const candidatos = await carregarAnimaisTx(tx, propriedadeId, data, ids);
  const escolhidos = candidatos.filter(a => ids.includes(a.id));
  if (escolhidos.length !== ids.length) throw new RebanhoError("VALIDACAO", "Confira os animais de origem neste sítio e data");
  return populacaoTx(tx, escolhidos, propriedadeId, data, ids);
}
