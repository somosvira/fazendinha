// Rótulos PT-BR e formatação pura para a UI do rebanho. Sem I/O.
import type { Aptidao, CategoriaDTO, ClasseMotivoBaixa, PapelReprodutivo, Situacao, TipoBaixa } from "../types";

export const ROTULO_APTIDAO: Record<Aptidao, string> = {
  LEITE: "Leite",
  CORTE: "Corte",
};

export const ROTULO_PAPEL_REPRODUTIVO: Record<PapelReprodutivo, string> = {
  NENHUM: "—",
  RECEPTORA: "Receptora",
  DOADORA: "Doadora",
};

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ATIVO: "Ativo",
  BAIXADO: "Baixado",
};

export const ROTULO_TIPO_BAIXA: Record<TipoBaixa, string> = {
  VENDA: "Venda",
  ABATE: "Abate",
  MORTE: "Morte",
  DOACAO: "Doação",
  EXTRAVIO: "Extravio",
  CADASTRO_INDEVIDO: "Cadastro indevido",
};

export const ROTULO_CLASSE_MOTIVO: Record<ClasseMotivoBaixa, string> = {
  DESCARTE_VOLUNTARIO: "Descarte voluntário",
  DESCARTE_INVOLUNTARIO: "Descarte involuntário",
  MORTE: "Morte",
};

/** Classes de motivo aceitas por cada tipo de baixa — espelha
 *  server/src/services/pecuaria/rebanho/motivos.ts. VENDA/ABATE/DOACAO aceitam
 *  descarte (voluntário ou involuntário); MORTE só aceita motivos de morte;
 *  EXTRAVIO e CADASTRO_INDEVIDO não têm motivo de catálogo. */
export const CLASSES_POR_TIPO: Record<TipoBaixa, ClasseMotivoBaixa[]> = {
  VENDA: ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO"],
  ABATE: ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO"],
  DOACAO: ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO"],
  MORTE: ["MORTE"],
  EXTRAVIO: [],
  CADASTRO_INDEVIDO: [],
};

/** Um motivo da classe `classe` pode ser escolhido para uma baixa do tipo `tipo`? */
export function motivoAceito(tipo: TipoBaixa, classe: ClasseMotivoBaixa): boolean {
  return CLASSES_POR_TIPO[tipo].includes(classe);
}

export function rotuloAptidao(a: Aptidao | null): string {
  return a ? ROTULO_APTIDAO[a] ?? a : "—";
}
export function rotuloPapelReprodutivo(p: PapelReprodutivo | null): string {
  return p ? ROTULO_PAPEL_REPRODUTIVO[p] ?? p : "—";
}
export function rotuloSituacao(s: Situacao): string {
  return ROTULO_SITUACAO[s] ?? s;
}
export function rotuloTipoBaixa(t: string): string {
  return (ROTULO_TIPO_BAIXA as Record<string, string>)[t] ?? t;
}
export function rotuloClasseMotivo(c: string): string {
  return (ROTULO_CLASSE_MOTIVO as Record<string, string>)[c] ?? c;
}
export function rotuloSexo(s: "F" | "M"): string {
  return s === "F" ? "Fêmea" : "Macho";
}

/** Rótulo de uma categoria numa lista/select: "Nome" — ou "Nome (F)"/"Nome (M)" quando o nome se
 *  repete em outra categoria da lista (ex.: "Em crescimento" existe para fêmeas e machos). */
export function rotuloOpcaoCategoria(categorias: Pick<CategoriaDTO, "nome" | "sexo">[], categoria: Pick<CategoriaDTO, "nome" | "sexo">): string {
  const duplicado = categorias.filter((c) => c.nome === categoria.nome).length > 1;
  return duplicado ? `${categoria.nome} (${categoria.sexo})` : categoria.nome;
}

/** Formata meses inteiros (idade calculada no servidor) como "2a 3m". */
export function formatarIdade(idadeMeses: number): string {
  const meses = Math.max(0, Math.trunc(idadeMeses));
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (anos === 0) return `${restoMeses}m`;
  if (restoMeses === 0) return `${anos}a`;
  return `${anos}a ${restoMeses}m`;
}

/** dd/mm/aaaa a partir de "aaaa-mm-dd". */
export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}
