// Regras puras do catálogo de produtos do sistema (docs/produtos.md: Herança, Categoria financeira sugerida).
import { UnidadeMedida } from "@prisma/client";
import { UNIDADES } from "./unidades.js";

export type UsosProduto = { usoSanitario: boolean; usoNutricional: boolean; usoGenetico: boolean };
export type OrigemCampo = "catalogo" | "fazenda";

/** Nome gravado no Produto adotado: "<nome> (<apresentação>)" quando houver apresentação. */
export function nomeCompletoCatalogo(item: { nome: string; apresentacao?: string | null }): string {
  const nome = item.nome.trim();
  const apresentacao = item.apresentacao?.trim();
  return apresentacao ? `${nome} (${apresentacao})` : nome;
}

/**
 * Categoria sugerida: categorias ativas cujas flags de uso contêm todas as flags do item
 * (item com mais de um uso = interseção). Exatamente uma → id; zero, várias ou item sem uso → null.
 */
export function sugerirCategoriaId(item: UsosProduto, categorias: ReadonlyArray<UsosProduto & { id: string; ativo?: boolean }>): string | null {
  const flags = (["usoSanitario", "usoNutricional", "usoGenetico"] as const).filter((f) => item[f]);
  if (!flags.length) return null;
  const candidatas = categorias.filter((c) => c.ativo !== false && flags.every((f) => c[f]));
  return candidatas.length === 1 ? candidatas[0].id : null;
}

type Ref = { id: string; nome: string; ativo: boolean };
type CampoHerdavel = { apresentacao: string | null; fabricanteId: string | null; fabricante: Ref | null; classificacaoTecnicaId: string | null; classificacaoTecnica: Ref | null };

/**
 * Valor efetivo dos campos herdáveis: valor do Produto se não nulo, senão o do item do catálogo.
 * Produto manual (sem catálogo) usa só os próprios valores e tudo é "fazenda".
 */
export function camposEfetivos(
  proprio: CampoHerdavel & { nomeAlterado: boolean },
  catalogo: CampoHerdavel | null,
) {
  const origem = (valor: unknown): OrigemCampo => (catalogo && valor == null ? "catalogo" : "fazenda");
  const fabricanteHerdado = catalogo && proprio.fabricanteId == null;
  const classificacaoHerdada = catalogo && proprio.classificacaoTecnicaId == null;
  return {
    apresentacao: proprio.apresentacao ?? catalogo?.apresentacao ?? null,
    fabricanteId: fabricanteHerdado ? catalogo.fabricanteId : proprio.fabricanteId,
    fabricante: fabricanteHerdado ? catalogo.fabricante : proprio.fabricante,
    classificacaoTecnicaId: classificacaoHerdada ? catalogo.classificacaoTecnicaId : proprio.classificacaoTecnicaId,
    classificacaoTecnica: classificacaoHerdada ? catalogo.classificacaoTecnica : proprio.classificacaoTecnica,
    origemCampos: {
      nome: (catalogo && !proprio.nomeAlterado ? "catalogo" : "fazenda") as OrigemCampo,
      apresentacao: origem(proprio.apresentacao),
      fabricante: origem(proprio.fabricanteId),
      classificacaoTecnica: origem(proprio.classificacaoTecnicaId),
    },
  };
}

/** Unidade do Produto a partir do rótulo da linha (ex.: "kg") ou do próprio código ("KG"). */
export function unidadePorRotulo(rotulo: string | null | undefined): UnidadeMedida | undefined {
  const texto = rotulo?.trim();
  if (!texto) return undefined;
  for (const [codigo, { rotulo: r }] of Object.entries(UNIDADES) as [UnidadeMedida, { rotulo: string }][]) {
    if (codigo === texto.toUpperCase() || r.toLocaleLowerCase() === texto.toLocaleLowerCase()) return codigo;
  }
  return undefined;
}

/**
 * Efeito de um PATCH sobre os campos de nome de um produto adotado.
 * - restaurarNome: volta ao nome do catálogo e nomeAlterado = false;
 * - nome diferente do atual: nomeAlterado = true;
 * - produto manual: sem efeito (nomeAlterado não se aplica).
 */
export function efeitoNomePatch(
  anterior: { nome: string; produtoCatalogoId: string | null },
  input: { nome?: string; restaurarNome?: boolean },
  nomeCatalogo: string | null,
): { nome?: string; nomeAlterado?: boolean } {
  if (!anterior.produtoCatalogoId) return input.nome === undefined ? {} : { nome: input.nome };
  if (input.restaurarNome) return { nome: nomeCatalogo ?? anterior.nome, nomeAlterado: false };
  if (input.nome === undefined) return {};
  return input.nome === anterior.nome ? { nome: input.nome } : { nome: input.nome, nomeAlterado: true };
}
