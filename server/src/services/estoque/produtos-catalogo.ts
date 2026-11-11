// Catálogo de produtos do sistema: consulta, busca unificada e adoção (docs/produtos.md).
// A aplicação só lê ProdutoCatalogo; a única escrita derivada é o Produto da fazenda criado na adoção.
import { randomUUID } from "node:crypto";
import type { Prisma, UnidadeMedida } from "@prisma/client";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError } from "../financeiro/regras.js";
import { inicioDePalavra } from "../../lib/busca-palavras.js";
import { normalizarNomeCatalogo } from "./catalogos.js";
import { includeProduto, produtoDTO } from "./produtos.js";
import { CATEGORIA_OBRIGATORIA } from "./produtos.schemas.js";
import { nomeCompletoCatalogo, sugerirCategoriaId, type UsosProduto } from "./produtos-catalogo.calc.js";
import { PRODUTO_OU_CATALOGO, type BuscaProdutos, type ConsultaCatalogoProdutos } from "./produtos-catalogo.schemas.js";

type Db = Prisma.TransactionClient;
export type ProdutoExistente = { id: string; nome: string };

/**
 * Erro de domínio do catálogo/adoção: um FinanceiroError (mesmo mapeamento HTTP dos fluxos que adotam)
 * com `produtoExistente` no conflito de nome. Criado por fábrica, sem subclasse, para não depender da
 * classe no carregamento do módulo (vários testes substituem financeiro/regras.js parcialmente).
 */
export type ProdutoCatalogoError = FinanceiroError & { produtoExistente?: ProdutoExistente };
export function erroProdutoCatalogo(code: FinanceiroError["code"], message: string, campo?: string, produtoExistente?: ProdutoExistente): ProdutoCatalogoError {
  return Object.assign(new FinanceiroError(code, message, campo), produtoExistente ? { produtoExistente } : {});
}

/** Complemento do corpo de erro HTTP: expõe o produto existente do conflito de nome. */
export function detalheErroProduto(e: unknown): { produtoExistente?: ProdutoExistente } {
  const existente = e instanceof Error ? (e as Partial<ProdutoCatalogoError>).produtoExistente : undefined;
  return existente ? { produtoExistente: existente } : {};
}

/** Prefixa o campo do erro com a linha do fluxo (ex.: `itens.2.`), preservando o erro original. */
export function prefixarCampoErro(e: unknown, prefixo: string, campoPadrao = "produtoCatalogoId") {
  if (e instanceof Error && "campo" in e && "code" in e) (e as { campo?: string }).campo = `${prefixo}${(e as { campo?: string }).campo ?? campoPadrao}`;
  return e;
}

const USO_CAMPO = { genetico: "usoGenetico", sanitario: "usoSanitario", nutricional: "usoNutricional" } as const;
const ref = { select: { id: true, nome: true, ativo: true } } as const;
const includeResumo = { fabricante: ref, classificacaoTecnica: ref } as const;
type ItemResumo = Prisma.ProdutoCatalogoGetPayload<{ include: typeof includeResumo }>;
type CategoriaUso = UsosProduto & { id: string };

const categoriasComUso = (db: Pick<Db, "categoria">): Promise<CategoriaUso[]> => db.categoria.findMany({
  where: { ativo: true, OR: [{ usoSanitario: true }, { usoNutricional: true }, { usoGenetico: true }] },
  select: { id: true, usoSanitario: true, usoNutricional: true, usoGenetico: true },
});

function resumoCatalogo(item: ItemResumo, categorias: CategoriaUso[]) {
  return {
    id: item.id,
    nome: item.nome,
    apresentacao: item.apresentacao ?? null,
    nomeCompleto: nomeCompletoCatalogo(item),
    fabricante: item.fabricante ? { id: item.fabricante.id, nome: item.fabricante.nome } : null,
    classificacaoTecnica: item.classificacaoTecnica ? { id: item.classificacaoTecnica.id, nome: item.classificacaoTecnica.nome } : null,
    unidadeSugerida: item.unidadeSugerida,
    usoSanitario: item.usoSanitario,
    usoNutricional: item.usoNutricional,
    usoGenetico: item.usoGenetico,
    categoriaSugeridaId: sugerirCategoriaId(item, categorias),
  };
}
export type ProdutoCatalogoResumo = ReturnType<typeof resumoCatalogo>;

/** Busca por início de palavra no nome normalizado do item ou do fabricante. */
function filtroBusca(busca: string): Prisma.ProdutoCatalogoWhereInput {
  const termo = normalizarNomeCatalogo(busca);
  if (!termo) return {};
  const doItem = inicioDePalavra("nomeNormalizado", termo).OR ?? [];
  return { OR: [...doItem, ...doItem.map(c => ({ fabricante: c }))] };
}
const ordemCatalogo = [{ nomeNormalizado: "asc" as const }, { apresentacao: "asc" as const }, { id: "asc" as const }];

/** Aba de consulta do catálogo: itens ativos, paginados, indicando o produto da fazenda que já o adotou. */
export async function listarCatalogo(input: ConsultaCatalogoProdutos) {
  return prisma.$transaction(async (tx) => {
    const where: Prisma.ProdutoCatalogoWhereInput = { ativo: true, ...filtroBusca(input.busca) };
    const total = await tx.produtoCatalogo.count({ where });
    const pagina = Math.min(input.pagina, Math.max(1, Math.ceil(total / input.porPagina)));
    const [itens, categorias] = await Promise.all([
      tx.produtoCatalogo.findMany({ where, include: { ...includeResumo, produtoDaFazenda: { select: { id: true } } }, orderBy: ordemCatalogo, skip: (pagina - 1) * input.porPagina, take: input.porPagina }),
      categoriasComUso(tx),
    ]);
    return { itens: itens.map((i) => ({ ...resumoCatalogo(i, categorias), produtoId: i.produtoDaFazenda?.id ?? null })), total, pagina, porPagina: input.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}

/** Ficha do item: legível mesmo inativo (produtos que o adotaram continuam a lê-lo). */
export async function detalheCatalogo(id: string) {
  const [item, categorias] = await Promise.all([
    prisma.produtoCatalogo.findUnique({ where: { id }, include: {
      ...includeResumo,
      principiosAtivos: { include: { principioAtivo: ref }, orderBy: { ordem: "asc" } },
      produtoDaFazenda: { select: { id: true, nome: true } },
    } }),
    categoriasComUso(prisma),
  ]);
  if (!item) throw erroProdutoCatalogo("NAO_ENCONTRADO", "Item do catálogo não encontrado");
  return {
    ...resumoCatalogo(item, categorias),
    classificacaoTecnica: item.classificacaoTecnica,
    fabricante: item.fabricante,
    ativo: item.ativo,
    fonte: item.fonte,
    versaoCatalogo: item.versaoCatalogo,
    principiosAtivos: item.principiosAtivos.map((p) => ({ id: p.principioAtivo.id, nome: p.principioAtivo.nome, ordem: p.ordem })),
    produtoDaFazenda: item.produtoDaFazenda,
  };
}

/** Busca dos seletores: Meus produtos (ativos) e itens ativos do catálogo ainda não adotados. */
export async function buscarProdutos(input: BuscaProdutos) {
  const uso = input.uso ? { [USO_CAMPO[input.uso]]: true } : {};
  const meusWhere: Prisma.ProdutoWhereInput = { ativo: true, ...uso, ...inicioDePalavra("nome", input.q ?? "", { insensitive: true }) };
  const catalogoWhere: Prisma.ProdutoCatalogoWhereInput = { ativo: true, produtoDaFazenda: { is: null }, ...uso, ...filtroBusca(input.q) };
  const [meus, catalogo, categorias] = await Promise.all([
    prisma.produto.findMany({ where: meusWhere, include: includeProduto, orderBy: [{ nome: "asc" }, { id: "asc" }], take: input.limite }),
    prisma.produtoCatalogo.findMany({ where: catalogoWhere, include: includeResumo, orderBy: ordemCatalogo, take: input.limite }),
    categoriasComUso(prisma),
  ]);
  return { meus: meus.map(produtoDTO), catalogo: catalogo.map((i) => resumoCatalogo(i, categorias)) };
}

export type SugestoesAdocao = { unidade?: UnidadeMedida; categoriaId?: string | null; usuarioId?: number | null };

/**
 * Cria (ou reaproveita) o Produto da fazenda vinculado ao item do catálogo, dentro da transação da operação.
 * Concorrência: o INSERT ... ON CONFLICT DO NOTHING cobre as duas unicidades (produtoCatalogoId e nome);
 * a releitura por produtoCatalogoId resolve adoções simultâneas para a mesma linha, e um nome já usado
 * por outro Produto vira conflito que identifica o existente (sem fusão).
 */
export async function adotarProdutoCatalogoTx(tx: Db, produtoCatalogoId: string, sugestoes: SugestoesAdocao = {}): Promise<string> {
  const vinculado = await tx.produto.findUnique({ where: { produtoCatalogoId }, select: { id: true } });
  if (vinculado) return vinculado.id;
  const item = await tx.produtoCatalogo.findUnique({ where: { id: produtoCatalogoId } });
  if (!item) throw erroProdutoCatalogo("NAO_ENCONTRADO", "Item do catálogo não encontrado", "produtoCatalogoId");
  if (!item.ativo) throw erroProdutoCatalogo("VALIDACAO", "Este item saiu do catálogo. Escolha outro produto.", "produtoCatalogoId");

  let categoriaId = sugestoes.categoriaId ?? null;
  if (categoriaId) {
    if (!await tx.categoria.findFirst({ where: { id: categoriaId, ativo: true }, select: { id: true } }))
      throw new FinanceiroError("VALIDACAO", "Selecione uma categoria ativa", "categoriaId");
  } else categoriaId = sugerirCategoriaId(item, await categoriasComUso(tx));
  if (!categoriaId) throw new FinanceiroError("VALIDACAO", CATEGORIA_OBRIGATORIA, "categoriaId");

  const nome = nomeCompletoCatalogo(item);
  const unidade = sugestoes.unidade ?? item.unidadeSugerida;
  const inseridos = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO public."Produto" ("id", "nome", "unidade", "categoriaId", "usoSanitario", "usoNutricional", "usoGenetico", "produtoCatalogoId", "nomeAlterado", "updatedAt")
    VALUES (${randomUUID()}, ${nome}, ${unidade}::"UnidadeMedida", ${categoriaId}, ${item.usoSanitario}, ${item.usoNutricional}, ${item.usoGenetico}, ${produtoCatalogoId}::uuid, false, now())
    ON CONFLICT DO NOTHING
    RETURNING "id"`;
  if (inseridos.length) {
    const criado = await tx.produto.findUniqueOrThrow({ where: { id: inseridos[0].id }, include: includeProduto });
    await auditar(tx, { entidade: "Produto", entidadeId: criado.id, acao: "CRIADO", usuarioId: sugestoes.usuarioId, motivo: "Adoção de item do catálogo", depois: produtoDTO(criado) });
    return criado.id;
  }
  const concorrente = await tx.produto.findUnique({ where: { produtoCatalogoId }, select: { id: true } });
  if (concorrente) return concorrente.id;
  const homonimo = await tx.produto.findUnique({ where: { nome }, select: { id: true, nome: true } });
  throw erroProdutoCatalogo("CONFLITO", `Já existe um produto da fazenda chamado “${nome}”. Use esse produto ou renomeie-o antes de usar o item do catálogo.`, "produtoCatalogoId", homonimo ?? undefined);
}

export type ResolucaoProdutoInput = { produtoId?: string | null; produtoCatalogoId?: string | null; unidade?: UnidadeMedida; categoriaId?: string | null };

/** Devolve o produtoId efetivo: o informado ou o da adoção do item do catálogo. Exatamente um dos dois. */
export async function resolverProdutoIdTx(tx: Db, input: ResolucaoProdutoInput, usuarioId?: number | null): Promise<string> {
  const temProduto = input.produtoId != null, temCatalogo = input.produtoCatalogoId != null;
  if (temProduto === temCatalogo) throw new FinanceiroError("VALIDACAO", PRODUTO_OU_CATALOGO, "produtoId");
  if (temProduto) return input.produtoId!;
  return adotarProdutoCatalogoTx(tx, input.produtoCatalogoId!, { unidade: input.unidade, categoriaId: input.categoriaId, usuarioId });
}
