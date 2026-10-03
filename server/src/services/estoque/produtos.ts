import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { papeisDoParceiro } from "../financeiro/papeis.js";
import { auditar, FinanceiroError, traduzirConflitoUnico, type DbFinanceiro } from "../financeiro/regras.js";
import { CATEGORIA_OBRIGATORIA, type ProdutoInput, type ProdutoPatchInput } from "./produtos.schemas.js";
import { travarUsosProduto } from "./usos.js";

export const includeProduto = {
  fornecedores: {
    include: { fornecedor: { include: { papeis: true } } },
    orderBy: { fornecedor: { nome: "asc" as const } },
  },
  centrosCusto: { include: { centroCusto: true }, orderBy: { centroCusto: { nome: "asc" as const } } },
  categoria: true,
  perfilSanitarioProduto: true,
  perfilNutricionalProduto: true,
} as const;

export function produtoDTO(produto: Prisma.ProdutoGetPayload<{ include: typeof includeProduto }>) {
  return {
    id: produto.id,
    nome: produto.nome,
    unidade: produto.unidade,
    minimoEstoque: produto.minimoEstoque != null ? produto.minimoEstoque.toString() : null,
    categoriaId: produto.categoriaId ?? null,
    categoriaNome: produto.categoria?.nome ?? null,
    classificacao: produto.categoria?.classificacao ?? null,
    usoAgricola: produto.usoAgricola,
    usoGenetico: produto.usoGenetico,
    usoSanitario: produto.usoSanitario,
    usoNutricional: produto.usoNutricional,
    categoria: produto.categoria
      ? { id: produto.categoria.id, nome: produto.categoria.nome, usoAgricola: produto.categoria.usoAgricola, usoGenetico: produto.categoria.usoGenetico,
        usoSanitario: produto.categoria.usoSanitario, usoNutricional: produto.categoria.usoNutricional }
      : null,
    ativo: produto.ativo,
    rastrearPartidas: produto.rastrearPartidas,
    perfilSanitario: produto.perfilSanitarioProduto,
    perfilNutricional: produto.perfilNutricionalProduto ? { materiaSecaPercentual: produto.perfilNutricionalProduto.materiaSecaPercentual?.toString() ?? null } : null,
    centroCustoIds: produto.centrosCusto.map(({ centroCustoId }) => centroCustoId),
    centrosCusto: produto.centrosCusto.map(({ centroCusto }) => ({ id: centroCusto.id, nome: centroCusto.nome, ativo: centroCusto.ativo })),
    fornecedores: produto.fornecedores.map(({ fornecedor }) => ({ id: fornecedor.id, nome: fornecedor.nome, ativo: fornecedor.ativo })),
  };
}

async function validarFornecedores(db: DbFinanceiro, fornecedorIds: string[], permitidosInativos: Set<string>) {
  if (!fornecedorIds.length) return;
  const fornecedores = await db.parceiro.findMany({ where: { id: { in: fornecedorIds } }, include: { papeis: true } });
  const validos = new Set(fornecedores.filter((p) =>
    (p.ativo || permitidosInativos.has(p.id)) && papeisDoParceiro(p).includes("FORNECEDOR")
  ).map((p) => p.id));
  if (fornecedorIds.some((id) => !validos.has(id))) {
    throw new FinanceiroError("VALIDACAO", "Selecione somente parceiros ativos com papel de fornecedor", "fornecedorIds");
  }
}

async function validarCentrosCusto(db: DbFinanceiro, centroCustoIds: string[], permitidosInativos: Set<string>) {
  if (!centroCustoIds.length) return;
  const centros = await db.centroCusto.findMany({ where: { id: { in: centroCustoIds } } });
  const validos = new Set(centros.filter((c) => c.ativo || permitidosInativos.has(c.id)).map((c) => c.id));
  if (centroCustoIds.some((id) => !validos.has(id))) {
    throw new FinanceiroError("VALIDACAO", "Selecione somente centros de custo ativos", "centroCustoIds");
  }
}

function separarRelacoes(input: ProdutoPatchInput) {
  const { fornecedorIds, centroCustoIds, perfilSanitario, perfilNutricional, ...produto } = input;
  return { fornecedorIds, centroCustoIds, perfilSanitario, perfilNutricional, produto };
}

const USO_CAMPO = { agricola: "usoAgricola", genetico: "usoGenetico", sanitario: "usoSanitario", nutricional: "usoNutricional" } as const;

export async function listarProdutos(f?: { uso?: keyof typeof USO_CAMPO; q?: string; ativo?: boolean; incluirInativos?: boolean }) {
  const where: Prisma.ProdutoWhereInput = {};
  if (f?.uso) Object.assign(where, { [USO_CAMPO[f.uso]]: true });
  if (f?.q) where.nome = { contains: f.q, mode: "insensitive" };
  if (f?.ativo != null) where.ativo = f.ativo;
  else if (!f?.incluirInativos) where.ativo = true;
  return (await prisma.produto.findMany({ where, orderBy: [{ ativo: "desc" }, { nome: "asc" }], include: includeProduto })).map(produtoDTO);
}

export async function listarProdutosCadastro() {
  return (await prisma.produto.findMany({ include: includeProduto, orderBy: [{ ativo: "desc" }, { nome: "asc" }] })).map(produtoDTO);
}

export async function criarProduto(input: ProdutoInput, usuarioId?: number | null) {
  try {
    return await prisma.$transaction((tx) => criarProdutoTx(tx, input, usuarioId));
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}

/** Cria o produto dentro de uma transação já aberta (ex.: material genético cria o produto junto). */
export async function criarProdutoTx(tx: Prisma.TransactionClient, input: ProdutoInput, usuarioId?: number | null) {
  const { fornecedorIds = [], centroCustoIds = [], perfilSanitario, perfilNutricional, produto } = separarRelacoes(input);
  if (produto.categoriaId == null) {
    throw new FinanceiroError("VALIDACAO", CATEGORIA_OBRIGATORIA, "categoriaId");
  }
  await validarFornecedores(tx, fornecedorIds, new Set());
  await validarCentrosCusto(tx, centroCustoIds, new Set());
  if (perfilSanitario && !produto.usoSanitario) throw new FinanceiroError("VALIDACAO", "Selecione o uso sanitário para preencher esse perfil", "usoSanitario");
  if (perfilNutricional && !produto.usoNutricional) throw new FinanceiroError("VALIDACAO", "Selecione o uso nutricional para preencher esse perfil", "usoNutricional");
  const criado = await tx.produto.create({
    data: {
      ...produto,
      nome: input.nome, unidade: input.unidade,
      ...(perfilSanitario ? { perfilSanitarioProduto: { create: perfilSanitario } } : {}),
      ...(perfilNutricional ? { perfilNutricionalProduto: { create: perfilNutricional } } : {}),
      fornecedores: { create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) },
      centrosCusto: { create: centroCustoIds.map((centroCustoId) => ({ centroCustoId })) },
    },
    include: includeProduto,
  });
  const dto = produtoDTO(criado);
  await auditar(tx, { entidade: "Produto", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: dto });
  return dto;
}

export async function atualizarProduto(id: string, input: ProdutoPatchInput, usuarioId?: number | null) {
  try {
    return await prisma.$transaction(async (tx) => {
      await travarUsosProduto(tx, [id]);
      const anterior = await tx.produto.findUnique({ where: { id }, include: includeProduto });
      if (!anterior) throw new FinanceiroError("NAO_ENCONTRADO", "Produto não encontrado");
      const { fornecedorIds, centroCustoIds, perfilSanitario, perfilNutricional, produto } = separarRelacoes(input);

      // Todo produto precisa de categoria. Um produto legado sem categoria só
      // pode ser ativado/desativado sem informá-la; qualquer outra edição exige.
      const categoriaId = produto.categoriaId !== undefined ? produto.categoriaId : anterior.categoriaId;
      const soSituacao = Object.entries(input).every(([campo, valor]) => campo === "ativo" || valor === undefined);
      if (categoriaId == null && !soSituacao) {
        throw new FinanceiroError("VALIDACAO", CATEGORIA_OBRIGATORIA, "categoriaId");
      }
      if (produto.rastrearPartidas !== undefined && produto.rastrearPartidas !== anterior.rastrearPartidas) {
        throw new FinanceiroError("CONFLITO", "Use a conferência de ativação do controle de lotes. Depois de ativado, não pode ser desligado.", "rastrearPartidas");
      }
      if ((perfilSanitario || anterior.perfilSanitarioProduto) && !(produto.usoSanitario ?? anterior.usoSanitario)) throw new FinanceiroError("CONFLITO", "O perfil sanitário exige uso sanitário", "usoSanitario");
      if ((perfilNutricional || anterior.perfilNutricionalProduto) && !(produto.usoNutricional ?? anterior.usoNutricional)) throw new FinanceiroError("CONFLITO", "O perfil nutricional exige uso nutricional", "usoNutricional");
      const vinculos = [
        ["usoAgricola", "aplicações agrícolas", () => tx.operacaoAgricola.count({ where: { produtoId: id } })],
        ["usoGenetico", "material genético", () => tx.materialGenetico.count({ where: { produtoId: id } })],
        ["usoSanitario", "aplicações ou protocolos sanitários", async () => (await tx.aplicacaoProduto.count({ where: { produtoId: id } })) + (await tx.etapaProtocoloSanitario.count({ where: { produtoId: id } }))],
        ["usoNutricional", "receitas ou fechamentos nutricionais", async () => (await tx.itemDieta.count({ where: { produtoId: id } })) + (await tx.itemFechamentoConsumo.count({ where: { produtoId: id } }))],
      ] as const;
      for (const [campo, descricao, contar] of vinculos) {
        if (produto[campo] === false && await contar() > 0) throw new FinanceiroError("CONFLITO", `Uso exigido por ${descricao}. Consulte os vínculos antes de alterar.`, campo);
      }

      // Trocar a unidade muda a interpretação de tudo que já foi movimentado
      // (estoque) ou registrado em histórico (compra/venda, aplicação agrícola)
      // na unidade antiga — bloqueia se houver algum registro para esse produto.
      if (produto.unidade !== undefined && produto.unidade !== anterior.unidade) {
        const [movimentos, itensOperacao, operacoesAgricolas] = await Promise.all([
          tx.movimentoEstoque.count({ where: { produtoId: id } }),
          tx.itemOperacao.count({ where: { produtoId: id } }),
          tx.operacaoAgricola.count({ where: { produtoId: id, doseValor: { not: null } } }),
        ]);
        if (movimentos > 0 || itensOperacao > 0 || operacoesAgricolas > 0) {
          throw new FinanceiroError("VALIDACAO", "Não é possível trocar a unidade de um produto com movimentos de estoque registrados", "unidade");
        }
      }

      if (fornecedorIds !== undefined) {
        await validarFornecedores(tx, fornecedorIds, new Set(anterior.fornecedores.map((v) => v.fornecedorId)));
      }
      if (centroCustoIds !== undefined) {
        await validarCentrosCusto(tx, centroCustoIds, new Set(anterior.centrosCusto.map((v) => v.centroCustoId)));
      }

      const atualizado = await tx.produto.update({
        where: { id },
        data: {
          ...produto,
          ...(perfilSanitario ? { perfilSanitarioProduto: { upsert: { create: perfilSanitario, update: perfilSanitario } } } : {}),
          ...(perfilNutricional ? { perfilNutricionalProduto: { upsert: { create: perfilNutricional, update: perfilNutricional } } } : {}),
          ...(fornecedorIds === undefined ? {} : {
            fornecedores: { deleteMany: {}, create: fornecedorIds.map((fornecedorId) => ({ fornecedorId })) },
          }),
          ...(centroCustoIds === undefined ? {} : {
            centrosCusto: { deleteMany: {}, create: centroCustoIds.map((centroCustoId) => ({ centroCustoId })) },
          }),
        },
        include: includeProduto,
      });
      const antes = produtoDTO(anterior);
      const depois = produtoDTO(atualizado);
      await auditar(tx, { entidade: "Produto", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois });
      return depois;
    });
  } catch (erro) { traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome" }); }
}

// ── Sugestão de preço na compra ─────────────────────────────────────────────
// O cadastro não guarda preço: a sugestão vem do último item comprado do
// produto em operação confirmada, preferindo o fornecedor informado.
export interface UltimoPrecoDTO {
  valorUnitario: string;
  data: string;
  parceiro: { id: string; nome: string } | null;
}

const TIPOS_COMPRA = ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO"] as const;

export async function obterUltimoPreco(produtoId: string, f: { parceiroId?: string | null; propriedadeId?: number | null } = {}): Promise<UltimoPrecoDTO | null> {
  const buscar = (parceiroId?: string) => prisma.itemOperacao.findFirst({
    where: {
      produtoId,
      operacao: {
        tipo: { in: [...TIPOS_COMPRA] },
        status: "CONFIRMADA",
        ...(f.propriedadeId != null ? { propriedadeId: f.propriedadeId } : {}),
        ...(parceiroId != null ? { parceiroId } : {}),
      },
    },
    orderBy: [{ operacao: { data: "desc" } }, { operacao: { numero: "desc" } }],
    select: { valorUnitario: true, operacao: { select: { data: true, parceiro: { select: { id: true, nome: true } } } } },
  });
  const item = (f.parceiroId != null ? await buscar(f.parceiroId) : null) ?? await buscar();
  if (!item) return null;
  return {
    valorUnitario: item.valorUnitario.toString(),
    data: item.operacao.data.toISOString().slice(0, 10),
    parceiro: item.operacao.parceiro ? { id: item.operacao.parceiro.id, nome: item.operacao.parceiro.nome } : null,
  };
}
