import type { z } from "zod";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import type { parceiroSchema, patchParceiroSchema } from "./schemas.js";
import { papeisDoParceiro, papeisLegados, tipoLegado } from "./papeis.js";
import type { PapelParceiro, TipoParceiro } from "@prisma/client";

const CONFLITOS = { documento: "Já existe um parceiro com este CPF/CNPJ" };

type ContagensParceiro = { operacoes: number; compromissos: number; transacoes: number };

const totalReferencias = (contagens: ContagensParceiro) => contagens.operacoes + contagens.compromissos + contagens.transacoes;

function comReferencias<T extends { tipo: TipoParceiro; papeis?: { papel: PapelParceiro }[] }>(parceiro: T, contagens: ContagensParceiro) {
  return { ...parceiro, papeis: papeisDoParceiro(parceiro), referencias: totalReferencias(contagens) };
}

function validarPreferencias(dados: { condicaoPagamentoPreferida?: string | null; prazosPagamento?: number[] }) {
  if (dados.condicaoPagamentoPreferida === "A_PRAZO" && !dados.prazosPagamento?.length) {
    throw new FinanceiroError("VALIDACAO", "Informe os prazos da sugestão de pagamento", "prazosPagamento");
  }
}

/* `referencias` = operações + compromissos + transações ligadas ao parceiro;
 * a UI usa para explicar o impacto de desativar. */
export async function listarParceiros(incluirInativos = false) {
  const lista = await prisma.parceiro.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { nome: "asc" },
    include: { papeis: true, _count: { select: { operacoes: true, compromissos: true, transacoes: true } } },
  });
  return lista.map(({ _count, ...parceiro }) => comReferencias(parceiro, _count));
}

export async function criarParceiro(input: z.infer<typeof parceiroSchema> & { usuarioId?: number | null }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const { usuarioId, papeis, tipo, ...dados } = input;
      validarPreferencias(dados);
      const selecionados = papeis ?? papeisLegados(tipo ?? "FORNECEDOR");
      const parceiro = await tx.parceiro.create({ data: { ...dados, tipo: tipoLegado(selecionados), papeis: { create: selecionados.map((papel) => ({ papel })) } }, include: { papeis: true } });
      await auditar(tx, { entidade: "Parceiro", entidadeId: parceiro.id, acao: "CRIADO", usuarioId, depois: parceiro });
      return comReferencias(parceiro, { operacoes: 0, compromissos: 0, transacoes: 0 });
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}

export async function atualizarParceiro(id: number, input: z.infer<typeof patchParceiroSchema>, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const encontrado = await tx.parceiro.findUnique({
        where: { id },
        include: { papeis: true, _count: { select: { operacoes: true, compromissos: true, transacoes: true } } },
      });
      if (!encontrado) throw new FinanceiroError("NAO_ENCONTRADO", "Parceiro não encontrado");
      const { _count, ...anterior } = encontrado;
      const { papeis, tipo, ...dados } = input;
      validarPreferencias({ ...anterior, ...dados });
      const selecionados = papeis ?? (tipo ? papeisLegados(tipo) : undefined);
      const parceiro = await tx.parceiro.update({ where: { id }, data: {
        ...dados,
        ...(selecionados ? { tipo: tipoLegado(selecionados), papeis: { deleteMany: {}, create: selecionados.map((papel) => ({ papel })) } } : {}),
      }, include: { papeis: true } });
      await auditar(tx, { entidade: "Parceiro", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes: anterior, depois: parceiro });
      return comReferencias(parceiro, _count);
    });
  } catch (e) { traduzirConflitoUnico(e, CONFLITOS); }
}
