import { createHash } from "node:crypto";

export interface ItemManifesto {
  chave: string;
  hash: string;
  entidade: string;
  dependencias: string[];
  operacao: "CRIAR" | "REUTILIZAR";
  destinoId?: string | null;
}
export interface ItemExecucao {
  chave: string;
  dependencias: string[];
  gravar: () => Promise<{ destinoId: string; reutilizado: boolean }>;
}
export type ReciboItem =
  | { chave: string; estado: "CRIADO" | "REUTILIZADO"; destinoId: string }
  | { chave: string; estado: "FALHOU" | "BLOQUEADO"; motivo: string };

/** O primeiro separador identifica a tabela; o restante pertence à chave externa. */
export function separarChave(chave: string) {
  const separador = chave.indexOf(":");
  if (separador < 1 || separador === chave.length - 1)
    throw new Error(`Chave de origem inválida: ${chave}.`);
  return {
    tabelaOrigem: chave.slice(0, separador),
    chaveOrigem: chave.slice(separador + 1),
  };
}
function conferirChaves(itens: { chave: string }[]) {
  const chaves = new Set<string>();
  for (const { chave } of itens) {
    separarChave(chave);
    if (chaves.has(chave)) throw new Error(`Chave de origem duplicada: ${chave}.`);
    chaves.add(chave);
  }
}
const comparar = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Identidade do plano independente da ordenação de consulta. Não substitui o hash
 * de proveniência já persistido nos vínculos V4. */
function ordenarJson(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarJson);
  if (valor !== null && typeof valor === "object")
    return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => comparar(a, b)).map(([k, v]) => [k, ordenarJson(v)]));
  return valor;
}
export function criarManifesto(bancoOrigem: string, itens: ItemManifesto[], contexto: unknown = null) {
  conferirChaves(itens);
  const ordenados = itens.map((i) => ({
    chave: i.chave,
    hash: i.hash,
    entidade: i.entidade,
    dependencias: [...new Set(i.dependencias)].sort(comparar),
    operacao: i.operacao,
    destinoId: i.destinoId ?? null,
  })).sort((a, b) => comparar(a.chave, b.chave));
  const conteudo = { bancoOrigem, itens: ordenados, contexto: ordenarJson(JSON.parse(JSON.stringify(contexto))) };
  return { ...conteudo, hash: createHash("sha256").update(JSON.stringify(conteudo)).digest("hex") };
}

/** Coordena apenas dependências. Cada gravar conserva a transação e as regras
 * do importador; uma falha não autoriza criar fatos dependentes sem vínculo. */
export async function executarPlano(
  itens: ItemExecucao[],
  existentes = new Set<string>(),
): Promise<ReciboItem[]> {
  conferirChaves(itens);
  const disponiveis = new Set(existentes);
  const pendentes = new Map(itens.map((i) => [i.chave, i]));
  const recibo: ReciboItem[] = [];
  while (pendentes.size) {
    let avancou = false;
    for (const [chave, item] of pendentes) {
      if (!item.dependencias.every((d) => disponiveis.has(d))) continue;
      pendentes.delete(chave);
      avancou = true;
      try {
        const resultado = await item.gravar();
        disponiveis.add(chave);
        recibo.push({ chave, estado: resultado.reutilizado ? "REUTILIZADO" : "CRIADO", destinoId: resultado.destinoId });
      } catch (e) {
        recibo.push({ chave, estado: "FALHOU", motivo: e instanceof Error ? e.message : String(e) });
      }
    }
    if (!avancou) {
      for (const [chave, item] of pendentes) {
        recibo.push({ chave, estado: "BLOQUEADO", motivo: `Dependência indisponível ou cíclica: ${item.dependencias.filter((d) => !disponiveis.has(d)).join(", ")}.` });
      }
      break;
    }
  }
  return recibo;
}
