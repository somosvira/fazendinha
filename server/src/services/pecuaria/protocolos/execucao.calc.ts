import crypto from "node:crypto";

/** Exclusiva do envelope novo: não muda a serialização/hash dos consumidores anteriores. */
export function serializarExecucaoProtocolo(valor: unknown): string {
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (valor && typeof valor === "object" && "toJSON" in valor && typeof valor.toJSON === "function")
    return serializarExecucaoProtocolo(valor.toJSON());
  if (Array.isArray(valor)) return `[${valor.map(serializarExecucaoProtocolo).join(",")}]`;
  if (valor && typeof valor === "object") return `{${Object.entries(valor).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${serializarExecucaoProtocolo(v)}`).join(",")}}`;
  return JSON.stringify(valor);
}
export const hashExecucaoProtocolo = (valor: unknown) => crypto.createHash("sha256").update(serializarExecucaoProtocolo(valor)).digest("hex");
export function paginaExecucao<T>(itens: T[], pagina = 1, porPagina = 10) {
  if (!Number.isInteger(porPagina) || porPagina < 1 || porPagina > 10 || !Number.isInteger(pagina) || pagina < 1) throw new Error("Paginação inválida");
  const atual = Math.min(pagina, Math.max(1, Math.ceil(itens.length / porPagina)));
  return { itens: itens.slice((atual - 1) * porPagina, atual * porPagina), total: itens.length, pagina: atual, porPagina };
}
