import { consultarLeite, registrarLeite } from "./operacoes-api";
import { getUsuario } from "../../../lib/auth";
import type { ConsultaParcelas, ContextoParcelas, ParcelaInput, ParcelaOrdenha } from "./parcelas-types";

export const consultarParcelas = (sitio: number, parametros: URLSearchParams) => consultarLeite<ConsultaParcelas>(`/geral/consulta?${parametros}`, sitio);
export const contextoParcelas = (sitio: number, data: string) => consultarLeite<ContextoParcelas>(`/geral?dataOperacional=${encodeURIComponent(data)}`, sitio);
export const salvarParcelas = (sitio: number, data: string, posicaoId: string, parcelas: ParcelaInput[]) => registrarLeite<{ sessaoId: string; parcelas: ParcelaOrdenha[] }>("/geral/parcelas", sitio, { propriedadeId: sitio, dataOperacional: data, posicaoId, parcelas });
type ParcelaConfirmacao = { medicaoId: string; versaoEsperada: number; produtoId: string; motivoNatureza: string };
type TentativaConfirmacao = { payload: string; chaves: string[] };
const tentativasConfirmacao = new Map<string, TentativaConfirmacao>();
/** Cada ato ganha chaves próprias; somente o retry do mesmo conteúdo as reutiliza. */
export async function confirmarParcelas(sitio: number, parcelas: ParcelaConfirmacao[]) {
  const armazenamento = `terrano:leite:confirmacao-parcelas:${getUsuario()?.id ?? "transicao"}:${sitio}`;
  const payload = JSON.stringify(parcelas);
  let anterior = tentativasConfirmacao.get(armazenamento);
  try { anterior = JSON.parse(sessionStorage.getItem(armazenamento) ?? "null") ?? anterior; } catch { /* Retry em memória. */ }
  const tentativa = anterior?.payload === payload && Array.isArray(anterior.chaves) && anterior.chaves.length === parcelas.length
    ? anterior : { payload, chaves: parcelas.map(() => crypto.randomUUID()) };
  tentativasConfirmacao.set(armazenamento, tentativa);
  try { sessionStorage.setItem(armazenamento, JSON.stringify(tentativa)); } catch { /* Retry em memória. */ }
  const resultado = await registrarLeite<{ entradas: { id: string; medicaoId: string; quantidadeLitros: number }[] }>("/geral/parcelas/confirmacoes", sitio, { parcelas: parcelas.map((p, i) => ({ ...p, chave: tentativa.chaves[i] })) });
  tentativasConfirmacao.delete(armazenamento);
  try { sessionStorage.removeItem(armazenamento); } catch { /* Sem persistência local. */ }
  return resultado;
}
