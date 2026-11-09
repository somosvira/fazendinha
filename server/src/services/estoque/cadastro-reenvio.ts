import type { Prisma } from "@prisma/client";
import { FinanceiroError } from "../financeiro/regras.js";

// Esta tabela explícita é compartilhada com normalizar_nome_produto_v1 no SQL.
export const ACENTOS_ORIGEM = "ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ";
export const ACENTOS_DESTINO = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy";
export function normalizarNomeCatalogo(nome: string): string {
  return [...nome.trim().replace(/\s+/g, " ")].map(c => { const i = ACENTOS_ORIGEM.indexOf(c); return i < 0 ? c : ACENTOS_DESTINO[i]; }).join("").toLowerCase();
}
export function payloadCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(payloadCanonico).join(",")}]`;
  if (valor && typeof valor === "object") {
    const entradas = Object.entries(valor).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b));
    return "{" + entradas.map(([k, v]) => JSON.stringify(k) + ":" + payloadCanonico(v)).join(",") + "}";
  }
  return JSON.stringify(valor) ?? "null";
}
export async function comReenvioCadastro<T>(tx: Prisma.TransactionClient, operacao: string, usuarioId: number | null | undefined, chave: string | undefined, payload: unknown, executar: () => Promise<T>): Promise<T> {
  if (!chave) return executar(); // Compatibilidade para clientes sem os novos campos.
  const autor = usuarioId && usuarioId > 0 ? `usuario:${usuarioId}` : "sessao-transitoria";
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cadastro-reenvio:${autor}:${operacao}:${chave}`}))`;
  const bytes = new TextEncoder().encode(payloadCanonico(payload));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2,"0")).join("");
  const anterior = await tx.reenvioCadastroEstoque.findUnique({ where: { autor_operacao_chave: { autor, operacao, chave } } });
  if (anterior) {
    if (anterior.hashPayload !== hash) throw new FinanceiroError("CONFLITO", "Esta chave de reenvio já foi usada com outros dados", "chaveReenvio");
    return anterior.resultado as T;
  }
  const resultado = await executar();
  await tx.reenvioCadastroEstoque.create({ data: { autor, operacao, chave, hashPayload: hash, resultado: JSON.parse(JSON.stringify(resultado)) as Prisma.InputJsonValue } });
  return resultado;
}
