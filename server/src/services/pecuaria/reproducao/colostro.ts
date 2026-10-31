import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { normalizarDetalhesParto } from "./partos.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
import type { FornecimentoColostroInput, CorrecaoColostroInput } from "./colostro.schemas.js";
function erro(mensagem: string, campo?: string): never { throw new RebanhoError("VALIDACAO", mensagem, campo); }
type Fornecimento = Prisma.FornecimentoColostroGetPayload<Record<string, never>>;
type CamposColostro = Omit<FornecimentoColostroInput, "chave" | "propriedadeId" | "criaId" | "data"> & { data?: string };
export function normalizarColostro(input: CamposColostro, data: string, anterior?: Fornecimento) {
  const horario = normalizarDetalhesParto({ ocorridoEm: input.ocorridoEm === undefined ? anterior?.ocorridoEm?.toISOString() ?? null : input.ocorridoEm, horarioEstimado: input.horarioEstimado ?? anterior?.horarioEstimado ?? false }, data);
  let quantidadeLitros = anterior?.quantidadeLitros ?? null;
  let unidadeInformada = anterior?.unidadeInformada ?? null;
  if (input.quantidade !== undefined || input.unidade !== undefined) {
    if (input.quantidade == null && input.unidade == null) { quantidadeLitros = null; unidadeInformada = null; }
    else {
      if (input.quantidade == null || !input.unidade) erro("Informe quantidade e unidade juntas", "quantidade");
      quantidadeLitros = new Prisma.Decimal(input.quantidade).div(input.unidade === "ML" ? 1000 : 1);
      if (!quantidadeLitros.isPositive() || quantidadeLitros.gt("9999999.999") || quantidadeLitros.decimalPlaces() > 3) erro("Volume deve ser positivo e ter precisão de até 1 mL", "quantidade");
      unidadeInformada = input.unidade;
    }
  }
  const metodoQualidade = input.metodoQualidade === undefined ? anterior?.metodoQualidade ?? null : input.metodoQualidade;
  const qualidadeBrix = input.qualidadeBrix === undefined ? anterior?.qualidadeBrix ?? null : input.qualidadeBrix == null ? null : new Prisma.Decimal(input.qualidadeBrix);
  const qualidadeClassificacao = input.qualidadeClassificacao === undefined ? anterior?.qualidadeClassificacao ?? null : input.qualidadeClassificacao;
  if (metodoQualidade === "REFRATOMETRO_BRIX") {
    if (qualidadeBrix == null || qualidadeBrix.lt(0) || qualidadeBrix.gt(100) || qualidadeBrix.decimalPlaces() > 2 || qualidadeClassificacao != null) erro("BRIX exige leitura de 0 a 100 e não admite classificação de colostrômetro", "qualidadeBrix");
  } else if (metodoQualidade === "COLOSTROMETRO") {
    if (!qualidadeClassificacao || !["ALTA", "MEDIA", "BAIXA"].includes(qualidadeClassificacao) || qualidadeBrix != null) erro("Colostrômetro exige classificação alta, média ou baixa", "qualidadeClassificacao");
  } else if (metodoQualidade != null || qualidadeBrix != null || qualidadeClassificacao != null) erro("A qualidade exige método explícito", "metodoQualidade");
  return { data: new Date(`${data}T00:00:00Z`), ocorridoEm: horario.ocorridoEm, horarioEstimado: horario.horarioEstimado,
    quantidadeLitros, unidadeInformada, metodoQualidade, qualidadeBrix, qualidadeClassificacao,
    tipo: input.tipo === undefined ? anterior?.tipo ?? null : input.tipo, forma: input.forma === undefined ? anterior?.forma ?? null : input.forma,
    responsavel: input.responsavel === undefined ? anterior?.responsavel ?? null : input.responsavel,
    observacao: input.observacao === undefined ? anterior?.observacao ?? null : input.observacao };
}
export async function conferirCriaTx(tx: Prisma.TransactionClient, criaId: string, propriedadeId: number, data: Date, horario?: { ocorridoEm: Date | null; horarioEstimado: boolean }) {
  const cria = await tx.criaParto.findUnique({ where: { id: criaId } });
  if (!cria?.animalId || !cria.viva) erro("Fornecimento exige cria viva cadastrada", "criaId");
  await travarAnimais(tx, [cria.animalId]);
  const parto = await tx.partoAnimal.findUnique({ where: { id: cria.partoId } });
  if (!parto || parto.status !== "VALIDO" || data < parto.data) erro("Fornecimento exige parto válido e data desde o nascimento", "data");
  if (parto.ocorridoEm && !parto.horarioEstimado && horario?.ocorridoEm && !horario.horarioEstimado
      && horario.ocorridoEm < parto.ocorridoEm)
    erro("Fornecimento não pode anteceder o horário conhecido do nascimento", "ocorridoEm");
  await conferirAnimalNoFato(tx, cria.animalId, propriedadeId, data);
  return { cria, parto, animalId: cria.animalId };
}
export async function registrarColostroTx(tx: Prisma.TransactionClient, input: FornecimentoColostroInput, usuarioId: number | null) {
  const dados = normalizarColostro(input, input.data);
  const { animalId } = await conferirCriaTx(tx, input.criaId, input.propriedadeId, dados.data, dados);
  const salvo = await tx.fornecimentoColostro.create({ data: { criaId: input.criaId, propriedadeId: input.propriedadeId, ...dados, criadoPorId: usuarioId } });
  await auditar(tx, { entidade: "FornecimentoColostro", entidadeId: salvo.id, animalId, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId, depois: salvo });
  return salvo;
}
export async function registrarColostro(input: FornecimentoColostroInput, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    await conferirCriaTx(tx, input.criaId, input.propriedadeId, new Date(input.data));
    return operacaoIdempotenteTx(tx, input, usuarioId, "FORNECIMENTO_COLOSTRO", () => registrarColostroTx(tx, input, usuarioId));
  });
}
export async function corrigirColostroTx(tx: Prisma.TransactionClient, id: string, input: CorrecaoColostroInput, usuarioId: number | null) {
    const referencia = await tx.fornecimentoColostro.findFirst({ where: { id, propriedadeId: input.propriedadeId } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Fornecimento não encontrado neste sítio");
    const cria = await tx.criaParto.findUniqueOrThrow({ where: { id: referencia.criaId } });
    if (!cria.animalId) erro("Cria do fornecimento não encontrada", "criaId");
    await travarAnimais(tx, [cria.animalId]);
    return operacaoIdempotenteTx(tx, { ...input, id }, usuarioId, "CORRECAO_COLOSTRO", async () => {
      const antes = await tx.fornecimentoColostro.findUniqueOrThrow({ where: { id } });
      if (antes.status !== "VALIDO" || antes.versao !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "Fornecimento alterado ou anulado; atualize a consulta");
      const dados = input.anular ? { status: "ANULADO" as const, anuladoEm: new Date(), motivoAnulacao: input.motivo } : normalizarColostro(input, input.data ?? antes.data.toISOString().slice(0, 10), antes);
      const alteraQuantidade = !input.anular && "quantidadeLitros" in dados &&
        (antes.quantidadeLitros == null ? dados.quantidadeLitros != null : dados.quantidadeLitros == null || !antes.quantidadeLitros.eq(dados.quantidadeLitros));
      const alteraData = !input.anular && "data" in dados && antes.data.getTime() !== dados.data.getTime();
      const alteraHorario = !input.anular && "ocorridoEm" in dados &&
        (antes.ocorridoEm?.getTime() !== dados.ocorridoEm?.getTime() || antes.horarioEstimado !== dados.horarioEstimado);
      if ((input.anular || alteraQuantidade || alteraData) && await tx.parcelaDestinoLeite.findFirst({ where: { fornecimentoColostroId: id, ativo: true }, select: { id: true } }))
        throw new RebanhoError("CONFLITO", "O fornecimento está vinculado à saída de leite; estorne o destino interno antes de corrigir data, quantidade ou anulação");
      if ((input.anular || alteraQuantidade || alteraData || alteraHorario) && await tx.alocacaoFornecimentoColostro.findFirst({ where: { fornecimentoId: id, ativo: true }, select: { id: true } }))
        throw new RebanhoError("CONFLITO", "O fornecimento está vinculado a uma origem do Bezerreiro; estorne a destinação antes de corrigir data, horário, quantidade ou anulação");
      if (!input.anular) await conferirCriaTx(tx, antes.criaId, input.propriedadeId, (dados as ReturnType<typeof normalizarColostro>).data, dados as ReturnType<typeof normalizarColostro>);
      const salvo = await tx.fornecimentoColostro.update({ where: { id, versao: antes.versao }, data: { ...dados, versao: { increment: 1 } } });
      await auditar(tx, { entidade: "FornecimentoColostro", entidadeId: id, animalId: cria.animalId, propriedadeId: input.propriedadeId, acao: input.anular ? "ANULACAO" : "CORRECAO", usuarioId, antes, depois: { ...salvo, motivo: input.motivo } });
      return salvo;
    });
}
export async function corrigirColostro(id: string, input: CorrecaoColostroInput, usuarioId: number | null) {
  return transacaoPecuaria(tx => corrigirColostroTx(tx, id, input, usuarioId));
}
export async function listarColostro(criaId: string, propriedadeId: number) {
  return prisma.fornecimentoColostro.findMany({ where: { criaId, propriedadeId }, orderBy: [{ data: "asc" }, { criadoEm: "asc" }] });
}
