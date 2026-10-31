import { comPropriedade } from '../../../propriedadeScope';
import { RebanhoApiError } from '../api';
export async function consultarBezerreiro<T>(path: string, propriedadeId: number, body?: unknown): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho/bezerreiro${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {...comPropriedade(body === undefined ? {} : {'content-type': 'application/json'}), 'X-Propriedade-Id': String(propriedadeId)},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const dados: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = dados && typeof dados === 'object' ? dados as {error?: string; code?: string; campo?: string} : null;
    throw new RebanhoApiError(erro?.error ?? `Não foi possível consultar o bezerreiro (HTTP ${resposta.status}).`, resposta.status, erro?.code, erro?.campo);
  }
  return dados as T;
}
export function consultaBezerreiro(valores: Record<string, string | number | boolean | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [nome, valor] of Object.entries(valores)) if (valor !== '' && valor != null) query.set(nome, String(valor));
  return query.size ? `?${query}` : '';
}
