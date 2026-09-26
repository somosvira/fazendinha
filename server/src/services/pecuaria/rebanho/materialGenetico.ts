import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { FinanceiroError } from "../../financeiro/regras.js";
import { listarSaldos } from "../../estoque/estoque.js";
import { criarProdutoTx } from "../../estoque/produtos.js";
import { auditar, RebanhoError, traduzirConflitoUnico, type DbPecuaria } from "./regras.js";
import type { CriarMaterialGeneticoInput, EditarMaterialGeneticoInput, ListarMaterialGeneticoQuery } from "./schemas.js";

type TipoSemen = "CONVENCIONAL" | "SEXADO_FEMEA" | "SEXADO_MACHO";

export type GenitorMaterialDTO =
  | { tipo: "ANIMAL"; id: string; nome: string | null; brinco: string }
  | { tipo: "EXTERNO"; id: string; nome: string; codigo: string | null };

export interface MaterialGeneticoDTO {
  id: string;
  tipo: "SEMEN" | "EMBRIAO";
  tipoSemen: TipoSemen | null;
  touro: GenitorMaterialDTO;
  doadora: GenitorMaterialDTO | null;
  observacao: string | null;
  produto: { id: string; nome: string; unidade: string; ativo: boolean; categoriaNome: string | null };
  /** Saldo no sítio consultado (null = produto ainda sem movimento no estoque). */
  saldo: number | null;
}

const ROTULO_SEMEN: Record<TipoSemen, string> = {
  CONVENCIONAL: "convencional",
  SEXADO_FEMEA: "sexado fêmea",
  SEXADO_MACHO: "sexado macho",
};

const includeMaterial = {
  touro: true,
  touroExterno: true,
  doadora: true,
  doadoraExterna: true,
  produto: { include: { categoria: true } },
} as const;

type MaterialComRelacoes = Prisma.MaterialGeneticoGetPayload<{ include: typeof includeMaterial }>;

function genitorDTO(animal: { id: string; nome: string | null; brinco: string } | null, externo: { id: string; nome: string; codigo: string | null } | null): GenitorMaterialDTO | null {
  if (animal) return { tipo: "ANIMAL", id: animal.id, nome: animal.nome, brinco: animal.brinco };
  if (externo) return { tipo: "EXTERNO", id: externo.id, nome: externo.nome, codigo: externo.codigo };
  return null;
}

function dto(m: MaterialComRelacoes, saldo: number | null): MaterialGeneticoDTO {
  return {
    id: m.id,
    tipo: m.tipo,
    tipoSemen: m.tipoSemen,
    touro: genitorDTO(m.touro, m.touroExterno)!,
    doadora: genitorDTO(m.doadora, m.doadoraExterna),
    observacao: m.observacao,
    produto: { id: m.produto.id, nome: m.produto.nome, unidade: m.produto.unidade, ativo: m.produto.ativo, categoriaNome: m.produto.categoria?.nome ?? null },
    saldo,
  };
}

type RefGenitor = { tipo: "ANIMAL" | "EXTERNO"; id: string };

/** Carrega o genitor e confere o sexo; devolve o nome usado para sugerir o nome do produto. */
async function resolverGenitor(db: DbPecuaria, ref: RefGenitor, sexo: "F" | "M", campo: "touro" | "doadora"): Promise<string> {
  const papel = campo === "touro" ? "O touro" : "A doadora";
  if (ref.tipo === "ANIMAL") {
    const a = await db.animal.findUnique({ where: { id: ref.id } });
    if (!a) throw new RebanhoError("NAO_ENCONTRADO", `${papel} não foi encontrado(a)`, campo);
    if (a.sexo !== sexo) throw new RebanhoError("VALIDACAO", `${papel} precisa ser ${sexo === "M" ? "macho" : "fêmea"}`, campo);
    return a.nome ? `${a.brinco} ${a.nome}` : a.brinco;
  }
  const g = await db.genitorExterno.findUnique({ where: { id: ref.id } });
  if (!g) throw new RebanhoError("NAO_ENCONTRADO", `${papel} não foi encontrado(a)`, campo);
  if (!g.ativo) throw new RebanhoError("VALIDACAO", `${papel} está inativo(a)`, campo);
  if (g.sexo !== sexo) throw new RebanhoError("VALIDACAO", `${papel} precisa ser ${sexo === "M" ? "macho" : "fêmea"}`, campo);
  return g.nome;
}

export function nomeSugerido(tipo: "SEMEN" | "EMBRIAO", touro: string, doadora: string | null, tipoSemen: TipoSemen | null): string {
  if (tipo === "EMBRIAO") return `Embrião ${touro} × ${doadora}`;
  return tipoSemen && tipoSemen !== "CONVENCIONAL" ? `Sêmen ${touro} (${ROTULO_SEMEN[tipoSemen]})` : `Sêmen ${touro}`;
}

async function saldosGeneticos(propriedadeId: number | null, produtoIds: string[]): Promise<Map<string, number>> {
  if (!produtoIds.length) return new Map();
  const saldos = await listarSaldos({ propriedadeId, produtoIds });
  return new Map(saldos.map((s) => [s.produtoId, s.saldo]));
}

export async function listarMaterialGenetico(filtros: Partial<ListarMaterialGeneticoQuery> = {}, propriedadeId: number | null = null): Promise<MaterialGeneticoDTO[]> {
  const materiais = await prisma.materialGenetico.findMany({
      where: {
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.incluirInativos ? {} : { produto: { ativo: true } }),
      },
      include: includeMaterial,
      orderBy: { produto: { nome: "asc" } },
    });
  const saldos = await saldosGeneticos(propriedadeId, materiais.map((m) => m.produtoId));
  return materiais.map((m) => dto(m, saldos.get(m.produtoId) ?? null));
}

export async function criarMaterialGenetico(input: CriarMaterialGeneticoInput, usuarioId: number | null): Promise<MaterialGeneticoDTO> {
  const tipoSemen = input.tipo === "SEMEN" ? (input.tipoSemen ?? "CONVENCIONAL") : null;
  try {
    const criado = await prisma.$transaction(async (tx) => {
      const nomeTouro = await resolverGenitor(tx, input.touro, "M", "touro");
      const nomeDoadora = input.doadora ? await resolverGenitor(tx, input.doadora, "F", "doadora") : null;

      const categoria = await tx.categoria.findUnique({ where: { id: input.produto.categoriaId } });
      if (!categoria || !categoria.ativo) throw new RebanhoError("VALIDACAO", "Categoria não encontrada ou inativa", "categoriaId");
      if (!categoria.usoGenetico) throw new RebanhoError("VALIDACAO", "Escolha uma categoria marcada como uso genético", "categoriaId");

      const produto = await criarProdutoTx(tx, {
        nome: input.produto.nome ?? nomeSugerido(input.tipo, nomeTouro, nomeDoadora, tipoSemen),
        unidade: input.tipo === "SEMEN" ? "DOSE" : "UN",
        categoriaId: categoria.id,
        centroCustoIds: input.produto.centroCustoIds ?? [],
        fornecedorIds: input.produto.fornecedorIds ?? [],
      }, usuarioId);

      const material = await tx.materialGenetico.create({
        data: {
          tipo: input.tipo,
          tipoSemen,
          touroId: input.touro.tipo === "ANIMAL" ? input.touro.id : null,
          touroExternoId: input.touro.tipo === "EXTERNO" ? input.touro.id : null,
          doadoraId: input.doadora?.tipo === "ANIMAL" ? input.doadora.id : null,
          doadoraExternaId: input.doadora?.tipo === "EXTERNO" ? input.doadora.id : null,
          produtoId: produto.id,
          observacao: input.observacao ?? null,
          criadoPorId: usuarioId,
        },
        include: includeMaterial,
      });
      await auditar(tx, { entidade: "MaterialGenetico", entidadeId: material.id, acao: "CADASTRO", usuarioId, depois: material });
      return material;
    });
    return dto(criado, null);
  } catch (erro) {
    if (erro instanceof FinanceiroError) throw new RebanhoError(erro.code === "CONFLITO" ? "CONFLITO" : "VALIDACAO", erro.message, erro.campo);
    traduzirConflitoUnico(erro, { nome: "Já existe um produto com este nome — informe outro nome" });
  }
}

export async function editarMaterialGenetico(id: string, input: EditarMaterialGeneticoInput, usuarioId: number | null): Promise<MaterialGeneticoDTO> {
  const atualizado = await prisma.$transaction(async (tx) => {
    const anterior = await tx.materialGenetico.findUnique({ where: { id } });
    if (!anterior) throw new RebanhoError("NAO_ENCONTRADO", "Material genético não encontrado");
    if (anterior.tipo === "EMBRIAO" && input.tipoSemen) throw new RebanhoError("VALIDACAO", "Tipo de sêmen só vale para sêmen", "tipoSemen");
    const material = await tx.materialGenetico.update({
      where: { id },
      data: {
        ...(input.tipoSemen !== undefined && anterior.tipo === "SEMEN" ? { tipoSemen: input.tipoSemen ?? "CONVENCIONAL" } : {}),
        ...(input.observacao !== undefined ? { observacao: input.observacao } : {}),
      },
      include: includeMaterial,
    });
    await auditar(tx, { entidade: "MaterialGenetico", entidadeId: id, acao: "EDICAO", usuarioId, antes: anterior, depois: material });
    return material;
  });
  return dto(atualizado, null);
}
