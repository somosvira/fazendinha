import { comPropriedade } from "../../../propriedadeScope";
import { RebanhoApiError } from "../api";
import type {
  ConfiguracaoInput,
  ConfiguracaoOrdenha,
  FolhaLeite,
  SalvarFolhaInput,
} from "./types";
async function req<T>(
  path: string,
  propriedadeId: number | null,
  body?: unknown,
): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho/leite${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...comPropriedade(body ? { "content-type": "application/json" } : {}),
      ...(propriedadeId ? { "X-Propriedade-Id": String(propriedadeId) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok)
    throw new RebanhoApiError(
      dados.error ?? `Erro HTTP ${resposta.status}`,
      resposta.status,
      dados.code,
      dados.campo,
    );
  return dados as T;
}
export const obterFolha = (data: string, propriedadeId: number | null) =>
  req<FolhaLeite>(
    `/folha?dataOperacional=${encodeURIComponent(data)}`,
    propriedadeId,
  );
export const salvarFolha = (input: SalvarFolhaInput) =>
  req<FolhaLeite>("/folha", input.propriedadeId, input);
export const obterConfiguracao = (data: string, propriedadeId: number | null) =>
  req<{ vigente: ConfiguracaoOrdenha; historico: ConfiguracaoOrdenha[] }>(
    `/configuracoes?data=${encodeURIComponent(data)}`,
    propriedadeId,
  );
export const salvarConfiguracao = (input: ConfiguracaoInput) =>
  req<ConfiguracaoOrdenha>("/configuracoes", input.propriedadeId, input);
export const obterCandidatos = (
  data: string,
  busca: string,
  pagina: number,
  propriedadeId: number,
) =>
  req<import("./types").CandidatosLeite>(
    `/candidatos?${new URLSearchParams({ dataOperacional: data, busca, pagina: String(pagina) })}`,
    propriedadeId,
  );
