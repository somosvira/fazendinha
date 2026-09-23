// Rótulos PT-BR e formatação pura para a UI do rebanho. Sem I/O.
import type { Aptidao, Categoria, PapelReprodutivo, Situacao, TipoSaida } from "../types";

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  BEZERRA: "Bezerra",
  NOVILHA: "Novilha",
  VACA: "Vaca",
  BEZERRO: "Bezerro",
  GARROTE: "Garrote",
  TOURO: "Touro",
};

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
  SAIU: "Saiu",
};

export const ROTULO_TIPO_SAIDA: Record<TipoSaida, string> = {
  VENDA: "Venda",
  ABATE: "Abate",
  MORTE: "Morte",
  DOACAO: "Doação",
  CADASTRO_INDEVIDO: "Cadastro indevido",
  OUTRO: "Outro",
};

export function rotuloCategoria(c: Categoria): string {
  return ROTULO_CATEGORIA[c] ?? c;
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
export function rotuloTipoSaida(t: string): string {
  return (ROTULO_TIPO_SAIDA as Record<string, string>)[t] ?? t;
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
