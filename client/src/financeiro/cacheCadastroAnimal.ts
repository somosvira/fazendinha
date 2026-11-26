import { getUsuario } from "../lib/auth";
import { getPropriedadeAtiva } from "../propriedadeScope";
import type { FormAnimal } from "../pecuaria/rebanho/forms/CadastroAnimal";

/** Rascunhos do modal pertencem ao usuário, sítio e rascunho da operação nesta aba. */
export function contextoCacheAnimal(sitioId: number | null | undefined, permitido: boolean): string | null {
  const usuario = getUsuario();
  const autorizado = !!usuario && (usuario.dono || (Array.isArray(usuario.flags) && usuario.flags.includes("lancar") && usuario.flags.includes("verValores") && Array.isArray(usuario.areas) && usuario.areas.includes("financeiro") && usuario.areas.includes("pecuaria")));
  return permitido && autorizado && usuario && Number.isInteger(usuario.id) && usuario.id > 0 && sitioId ? `terrano:animal-compra:v1:${usuario.id}:${getPropriedadeAtiva() ?? "consolidado"}:${sitioId}:` : null;
}
export const chaveCacheAnimal = (contexto: string, rascunhoId: string | null, slot: string) => `${contexto}${rascunhoId ? `draft:${rascunhoId}` : "pendente"}:${slot}`;
function valorValido(v: unknown): v is FormAnimal {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const f = v as Record<string, unknown>;
  const textos = ["brinco", "nome", "brincoEletronico", "sisbov", "dataNascimento", "dataEntrada", "partosAntesDaEntrada", "observacao", "loteId", "pesoEntradaKg"];
  const genitor = (g: unknown) => !!g && typeof g === "object" && ["NENHUM", "ANIMAL", "EXTERNO"].includes(String((g as Record<string, unknown>).tipo)) && ((g as Record<string, unknown>).tipo === "NENHUM" || typeof (g as Record<string, unknown>).id === "string") && ((g as Record<string, unknown>).tipo !== "ANIMAL" || (typeof (g as Record<string, unknown>).brinco === "string" && ((g as Record<string, unknown>).nome === null || typeof (g as Record<string, unknown>).nome === "string"))) && ((g as Record<string, unknown>).tipo !== "EXTERNO" || ((g as Record<string, unknown>).nome === undefined || typeof (g as Record<string, unknown>).nome === "string"));
  return textos.every(k => typeof f[k] === "string") && (f.eccEntrada === undefined || typeof f.eccEntrada === "string") && typeof f.nascimentoEstimado === "boolean" && typeof f.destinoManual === "boolean" && ["F", "M"].includes(String(f.sexo)) && ["LEITE", "CORTE", "REPRODUCAO"].includes(String(f.aptidao)) && ["NENHUM", "RECEPTORA", "DOADORA"].includes(String(f.papelReprodutivo)) && genitor(f.mae) && genitor(f.pai) && Array.isArray(f.composicao) && f.composicao.every(item => item && typeof item.racaId === "string" && typeof item.fracao64 === "number" && Number.isFinite(item.fracao64));
}
export function lerCacheAnimal(chave: string | null, base: string, dataOperacao: string): FormAnimal | null {
  if (!chave) return null;
  try { const valor = JSON.parse(sessionStorage.getItem(chave) ?? "null"); return valor?.base === base && valorValido(valor.form) ? { ...valor.form, ...(valor.segueOperacao === true ? { dataEntrada: dataOperacao } : {}) } : null; } catch { return null; }
}
export function gravarCacheAnimal(chave: string | null, base: string, form: FormAnimal, dataOperacao: string) {
  if (!chave) return;
  try { sessionStorage.setItem(chave, JSON.stringify({ base, form, segueOperacao: form.dataEntrada === dataOperacao })); } catch { /* armazenamento pode estar indisponível */ }
}
export function removerCacheAnimal(chave: string | null) { if (chave) try { sessionStorage.removeItem(chave); } catch { /* sem armazenamento */ } }
export function removerCachesAnimal(contexto: string | null, rascunhoId: string | null) {
  if (!contexto) return;
  try { const prefixo = chaveCacheAnimal(contexto, rascunhoId, ""); for (let i = sessionStorage.length - 1; i >= 0; i--) { const chave = sessionStorage.key(i); if (chave?.startsWith(prefixo)) sessionStorage.removeItem(chave); } } catch { /* sem armazenamento */ }
}
export function vincularCachesAnimal(contexto: string | null, id: string) {
  if (!contexto) return;
  try { const origem = chaveCacheAnimal(contexto, null, ""); const destino = chaveCacheAnimal(contexto, id, ""); const itens: [string, string][] = []; for (let i = 0; i < sessionStorage.length; i++) { const chave = sessionStorage.key(i); if (chave?.startsWith(origem)) { const valor = sessionStorage.getItem(chave); if (valor !== null) itens.push([chave, valor]); } } for (const [chave, valor] of itens) { const alvo = destino + chave.slice(origem.length); if (sessionStorage.getItem(alvo) === null) sessionStorage.setItem(alvo, valor); sessionStorage.removeItem(chave); } } catch { /* sem armazenamento */ }
}

/** Limpa somente o rascunho remoto descartado, inclusive em contexto consolidado. */
export function removerCachesRascunhoUsuario(usuarioId: number | undefined, rascunhoId: string | undefined) {
  if (!usuarioId || !rascunhoId) return;
  try { const prefixo = `terrano:animal-compra:v1:${usuarioId}:`; const trecho = `:draft:${rascunhoId}:`; for (let i = sessionStorage.length - 1; i >= 0; i--) { const chave = sessionStorage.key(i); if (chave?.startsWith(prefixo) && chave.includes(trecho)) sessionStorage.removeItem(chave); } } catch { /* sem armazenamento */ }
}

/** JSONB pode devolver as chaves de objetos em outra ordem; arrays mantêm sua ordem. */
export function assinaturaCadastroAnimal(valor: unknown): string {
  const normalizar = (v: unknown): unknown => Array.isArray(v) ? v.map(normalizar) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([chave, item]) => [chave, normalizar(item)])) : v;
  return JSON.stringify(normalizar(valor));
}

/** Uma nova operação explícita descarta somente o slot pendente do escopo atual. */
export function limparCachePendenteContexto() {
  const usuario = getUsuario();
  if (!usuario || !Number.isInteger(usuario.id) || usuario.id <= 0) return;
  const prefixo = `terrano:animal-compra:v1:${usuario.id}:${getPropriedadeAtiva() ?? "consolidado"}:`;
  try { for (let i = sessionStorage.length - 1; i >= 0; i--) { const chave = sessionStorage.key(i); if (chave?.startsWith(prefixo) && chave.includes(":pendente:")) sessionStorage.removeItem(chave); } } catch { /* sem armazenamento */ }
}
