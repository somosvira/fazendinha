import type { Prisma } from "@prisma/client";

// Caracteres que abrem uma palavra dentro de um nome: "Vacina (Frasco 50 ml)", "Soro-Mix", "Sal/Mineral".
const SEPARADORES = [" ", "(", "-", "/", ".", ",", ";", ":"] as const;

/**
 * Busca por início de palavra: o campo precisa começar com o termo, ou uma palavra dele (depois de espaço,
 * parêntese, hífen etc.) precisa começar com o termo. "di" encontra "Diclofenaco" e "Soro Dimetil", não "Ivermectina".
 * Devolve um `OR` para espalhar no `where`, ou `{}` sem termo. Em campos sem coluna normalizada use `insensitive`
 * (ignora caixa; acentos só são ignorados em colunas `nomeNormalizado`, cujo termo deve vir normalizado).
 */
export function inicioDePalavra<C extends string>(campo: C, termo: string, opcoes: { insensitive?: boolean } = {}): { OR?: Array<Record<C, Prisma.StringFilter>> } {
  const t = termo.trim().replace(/\s+/g, " ");
  if (!t) return {};
  const modo = opcoes.insensitive ? { mode: "insensitive" as const } : {};
  const condicoes: Prisma.StringFilter[] = [{ startsWith: t, ...modo }, ...SEPARADORES.map(s => ({ contains: `${s}${t}`, ...modo }))];
  return { OR: condicoes.map(c => ({ [campo]: c }) as Record<C, Prisma.StringFilter>) };
}
