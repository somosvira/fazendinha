import { Prisma } from "@prisma/client";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { criarOcorrenciaTx } from "../sanidade/ocorrencias.js";
import { registrarPesagemTx, editarPesagemTx } from "../rebanho/animais.js";
import type { CorrecaoPartoAmpliadaInput, PartoAmpliadoInput } from "./partos.schemas.js";

function erro(mensagem: string, campo?: string): never { throw new RebanhoError("VALIDACAO", mensagem, campo); }
type DetalhesParto = Pick<PartoAmpliadoInput, "tipo" | "desfecho" | "induzido" | "dificuldade" | "assistenciaDescricao" | "ocorridoEm" | "horarioEstimado" | "retencaoPlacenta">;
type PartoPersistido = Prisma.PartoAnimalGetPayload<Record<string, never>>;
/** Compatibilidade antiga informa somente o que o código legado comprovava. */
export function normalizarDetalhesParto(input: DetalhesParto, data: string, anterior?: PartoPersistido) {
  const tipoLegado = input.tipo;
  const desfecho = input.desfecho !== undefined ? input.desfecho : tipoLegado ? (tipoLegado === "ABORTO" ? "ABORTO" : "NASCIMENTO") : anterior?.desfecho ?? null;
  const dificuldade = input.dificuldade !== undefined ? input.dificuldade : tipoLegado === "NORMAL" ? false : tipoLegado === "DISTOCICO" ? true : anterior?.dificuldade ?? null;
  if (tipoLegado && input.desfecho != null && (tipoLegado === "ABORTO") !== (input.desfecho === "ABORTO")) erro("Tipo e desfecho do parto são incompatíveis", "desfecho");
  if ((tipoLegado === "NORMAL" && dificuldade === true) || (tipoLegado === "DISTOCICO" && dificuldade === false)) erro("Tipo e dificuldade do parto são incompatíveis", "dificuldade");
  const tipo = desfecho === "ABORTO" ? "ABORTO" : (tipoLegado === "NATIMORTO" || (!tipoLegado && anterior?.tipo === "NATIMORTO")) ? "NATIMORTO" : dificuldade === true ? "DISTOCICO" : dificuldade === false ? "NORMAL" : tipoLegado ?? anterior?.tipo ?? "NASCIMENTO";
  const ocorridoEm = input.ocorridoEm === undefined ? anterior?.ocorridoEm ?? null : input.ocorridoEm ? new Date(input.ocorridoEm) : null;
  const horarioEstimado = input.horarioEstimado ?? anterior?.horarioEstimado ?? false;
  if (horarioEstimado && !ocorridoEm) erro("Horário estimado exige informar o horário do parto", "horarioEstimado");
  if (ocorridoEm) {
    if (!Number.isFinite(ocorridoEm.getTime())) erro("Horário do parto inválido", "ocorridoEm");
    const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ocorridoEm);
    const obter = (tipo: string) => partes.find(p => p.type === tipo)?.value;
    if (`${obter("year")}-${obter("month")}-${obter("day")}` !== data) erro("O horário deve pertencer à data do parto em São Paulo", "ocorridoEm");
    if (ocorridoEm > new Date()) erro("Horário do parto não pode estar no futuro", "ocorridoEm");
  }
  return { tipo, desfecho, dificuldade, ocorridoEm, horarioEstimado, induzido: input.induzido === undefined ? anterior?.induzido ?? null : input.induzido,
    assistenciaDescricao: input.assistenciaDescricao === undefined ? anterior?.assistenciaDescricao ?? null : input.assistenciaDescricao,
    retencaoPlacenta: input.retencaoPlacenta === undefined ? anterior?.retencaoPlacenta ?? null : input.retencaoPlacenta };
}

export async function lerPartoTx(tx: Prisma.TransactionClient, id: string) {
  const parto = await tx.partoAnimal.findUniqueOrThrow({ where: { id }, include: {
    ocorrenciasRetencaoPlacenta: { include: { doenca: { select: { id: true, nome: true } } }, orderBy: { inicio: "asc" } },
    examesPosParto: { include: { resultados: { where: { vigente: true } } }, orderBy: { data: "asc" } },
    vinculosPesagem: { include: { pesagem: true }, orderBy: { criadoEm: "asc" } },
  } });
  return { ...parto, crias: await tx.criaParto.findMany({ where: { partoId: id }, include: { fornecimentosColostro: { where: { propriedadeId: parto.propriedadeId ?? -1 }, orderBy: [{ data: "asc" }, { criadoEm: "asc" }] } }, orderBy: { ordem: "asc" } }) };
}

/** A transação já deve ter travado matriz/crias. Desvínculos nunca apagam os fatos clínicos. */
export async function aplicarRetencaoPartoTx(tx: Prisma.TransactionClient, parto: PartoPersistido, input: Pick<CorrecaoPartoAmpliadaInput, "ocorrenciaRetencao">, usuarioId: number | null) {
  const acao = input.ocorrenciaRetencao;
  if (!acao) {
    if (parto.retencaoPlacenta !== true && await tx.ocorrenciaSanitaria.count({ where: { partoRetencaoPlacentaId: parto.id, status: "VALIDO" } })) erro("Desvincule explicitamente a ocorrência antes de alterar a retenção", "retencaoPlacenta");
    return;
  }
  if (acao.acao !== "DESVINCULAR" && parto.retencaoPlacenta !== true) erro("Vincular ocorrência exige retenção de placenta Sim", "retencaoPlacenta");
  let ocorrencia;
  if (acao.acao === "CRIAR") {
    if (new Date(acao.inicio) < parto.data) erro("Ocorrência não pode anteceder o parto", "ocorrenciaRetencao");
    ocorrencia = await criarOcorrenciaTx(tx, { animalId: parto.animalId, propriedadeId: parto.propriedadeId!, doencaId: acao.doencaId, inicio: acao.inicio, observacao: acao.observacao }, usuarioId);
  } else ocorrencia = await tx.ocorrenciaSanitaria.findUnique({ where: { id: acao.ocorrenciaId } });
  if (!ocorrencia || ocorrencia.animalId !== parto.animalId || ocorrencia.propriedadeId !== parto.propriedadeId || ocorrencia.status !== "VALIDO" || ocorrencia.inicio < parto.data) erro("Ocorrência incompatível com animal, sítio ou cronologia do parto", "ocorrenciaRetencao");
  if (acao.acao === "DESVINCULAR") {
    if (ocorrencia.partoRetencaoPlacentaId !== parto.id) erro("A ocorrência não está vinculada a este parto", "ocorrenciaRetencao");
  } else if (ocorrencia.partoRetencaoPlacentaId && ocorrencia.partoRetencaoPlacentaId !== parto.id) erro("Ocorrência já vinculada a outro parto", "ocorrenciaRetencao");
  if (acao.acao !== "DESVINCULAR") await conferirAnimalNoFato(tx, parto.animalId, parto.propriedadeId!, ocorrencia.inicio);
  const depois = await tx.ocorrenciaSanitaria.update({ where: { id: ocorrencia.id }, data: { partoRetencaoPlacentaId: acao.acao === "DESVINCULAR" ? null : parto.id } });
  await auditar(tx, { entidade: "OcorrenciaSanitaria", entidadeId: ocorrencia.id, animalId: parto.animalId, propriedadeId: parto.propriedadeId, acao: acao.acao === "DESVINCULAR" ? "DESVINCULO_RP_PARTO" : "VINCULO_RP_PARTO", usuarioId, antes: ocorrencia, depois: { ...depois, ...(acao.acao === "DESVINCULAR" ? { motivo: acao.motivo } : {}) } });
  if (parto.retencaoPlacenta !== true && await tx.ocorrenciaSanitaria.count({ where: { partoRetencaoPlacentaId: parto.id, status: "VALIDO" } })) erro("Restam ocorrências vinculadas incompatíveis com a declaração de retenção", "retencaoPlacenta");
}

type AcaoPeso = NonNullable<CorrecaoPartoAmpliadaInput["pesoMatriz"]>;
export async function aplicarPesoPartoTx(tx: Prisma.TransactionClient, parto: PartoPersistido, acao: AcaoPeso | undefined, usuarioId: number | null, cria?: { id: string; animalId: string | null }) {
  if (!acao) return;
  const sujeito = cria ? "CRIA" : "MATRIZ";
  const animalId = cria?.animalId ?? (cria ? null : parto.animalId);
  if (!animalId) erro("Cria sem animal conserva peso no registro do nascimento", "pesosCrias");
  if (acao.acao === "REGISTRAR" && cria && acao.data !== parto.data.toISOString().slice(0, 10)) erro("Peso de nascimento exige a data do parto", "pesosCrias");
  if (acao.acao === "CORRIGIR") {
    const vinculo = await tx.vinculoPesagemParto.findFirst({ where: {
      id: acao.vinculoId, partoId: parto.id, sujeito, criaId: cria?.id ?? null, revogadoEm: null,
    }, include: { pesagem: true } });
    if (!vinculo || vinculo.pesagem.animalId !== animalId) erro("Pesagem vinculada não encontrada", "pesosCrias");
    if (new Date(acao.data) < parto.data || (cria && acao.data !== parto.data.toISOString().slice(0, 10)))
      erro("Data da pesagem incompatível com o parto", "pesosCrias");
    await conferirAnimalNoFato(tx, animalId, parto.propriedadeId!, new Date(acao.data));
    await editarPesagemTx(tx, vinculo.pesagemId, { data: acao.data, pesoKg: acao.pesoKg, observacao: acao.observacao }, usuarioId);
    return;
  }
  if (acao.acao === "DESVINCULAR") {
    const anterior = await tx.vinculoPesagemParto.findFirst({ where: { id: acao.vinculoId, partoId: parto.id, sujeito, criaId: cria?.id ?? null, revogadoEm: null } });
    if (!anterior) erro("Vínculo de pesagem ativo não encontrado", "pesoMatriz");
    const depois = await tx.vinculoPesagemParto.update({ where: { id: anterior.id }, data: { revogadoEm: new Date(), revogadoPorId: usuarioId, motivoRevogacao: acao.motivo } });
    await auditar(tx, { entidade: "VinculoPesagemParto", entidadeId: anterior.id, animalId, propriedadeId: parto.propriedadeId, acao: "REVOGACAO", usuarioId, antes: anterior, depois });
    return;
  }
  let pesagem;
  if (acao.acao === "REGISTRAR") {
    if (new Date(acao.data) < parto.data) erro("Pesagem vinculada não pode anteceder o parto", "pesoMatriz");
    pesagem = await registrarPesagemTx(tx, { animalId, data: acao.data, pesoKg: acao.pesoKg, tipo: cria ? "NASCIMENTO" : "ROTINA", origem: "MANUAL", observacao: acao.observacao }, usuarioId);
  } else pesagem = await tx.pesagem.findUnique({ where: { id: acao.pesagemId } });
  if (!pesagem || pesagem.animalId !== animalId || pesagem.data < parto.data) erro("Pesagem incompatível com o animal ou data do parto", "pesoMatriz");
  if (cria && (pesagem.data.getTime() !== parto.data.getTime() || pesagem.tipo !== "NASCIMENTO")) erro("Peso de nascimento exige a data do parto e tipo Nascimento", "pesosCrias");
  await conferirAnimalNoFato(tx, animalId, parto.propriedadeId!, pesagem.data);
  const existentes = await tx.vinculoPesagemParto.findMany({ where: { partoId: parto.id, sujeito, criaId: cria?.id ?? null, revogadoEm: null } });
  if (existentes.some(v => v.pesagemId === pesagem.id)) return;
  if (existentes.length) erro("Desvincule a pesagem atual antes de substituir o vínculo", "pesoMatriz");
  if (await tx.vinculoPesagemParto.count({ where: { pesagemId: pesagem.id, revogadoEm: null } })) erro("A pesagem já possui outro vínculo de parto ativo", "pesoMatriz");
  const vinculo = await tx.vinculoPesagemParto.create({ data: { partoId: parto.id, pesagemId: pesagem.id, criaId: cria?.id ?? null, sujeito, criadoPorId: usuarioId } });
  await auditar(tx, { entidade: "VinculoPesagemParto", entidadeId: vinculo.id, animalId, propriedadeId: parto.propriedadeId, acao: "REGISTRO", usuarioId, depois: vinculo });
}

export async function corrigirPesosCriasTx(tx: Prisma.TransactionClient, parto: PartoPersistido, input: CorrecaoPartoAmpliadaInput, usuarioId: number | null) {
  for (const alteracao of input.pesosCrias ?? []) {
    const cria = await tx.criaParto.findFirst({ where: { id: alteracao.criaId, partoId: parto.id } });
    if (!cria) erro("Cria não pertence ao parto", "pesosCrias");
    if (cria.animalId) {
      if (alteracao.pesoKg !== undefined) erro("Peso da cria viva exige uma pesagem vinculada", "pesosCrias");
      await aplicarPesoPartoTx(tx, parto, alteracao.peso, usuarioId, cria);
    } else {
      if (alteracao.peso) erro("Cria sem animal conserva peso no registro do nascimento", "pesosCrias");
      if (alteracao.pesoKg === undefined) continue;
      const snapshot = cria.filiacaoSnapshot as Prisma.JsonObject;
      const salva = await tx.criaParto.update({ where: { id: cria.id }, data: { filiacaoSnapshot: { ...snapshot, pesoKg: alteracao.pesoKg } as Prisma.InputJsonValue } });
      await auditar(tx, { entidade: "CriaParto", entidadeId: cria.id, animalId: parto.animalId, propriedadeId: parto.propriedadeId, acao: "CORRECAO_PESO_NASCIMENTO", usuarioId, antes: cria, depois: { ...salva, motivo: input.motivo } });
    }
  }
}
