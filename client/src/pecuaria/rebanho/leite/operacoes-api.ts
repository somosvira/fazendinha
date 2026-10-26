import { getUsuario } from "../../../lib/auth";
import { comPropriedade } from "../../../propriedadeScope";
export async function consultarLeite<T>(
  caminho: string,
  sitio: number | null,
): Promise<T> {
  return requisitar<T>(caminho, sitio);
}
async function requisitar<T>(
  caminho: string,
  sitio: number | null,
  body?: unknown,
  metodo?: "PATCH",
): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho/leite${caminho}`, {
    method: metodo ?? (body ? "POST" : "GET"),
    headers: {
      ...comPropriedade(body ? { "content-type": "application/json" } : {}),
      ...(sitio ? { "X-Propriedade-Id": String(sitio) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok)
    throw new Error(dados.error ?? "Não foi possível concluir a operação");
  return dados as T;
}
const tentativasEmMemoria = new Map<string, { payload: string; chave: string }>();
/** Mantém a chave após resposta perdida; trocar os dados inicia outra tentativa. */
export async function registrarLeite<T>(
  caminho: string,
  sitio: number | null,
  dados: Record<string, unknown>,
  comChave = true,
): Promise<T> {
  const armazenamento = `terrano:leite:operacao:${getUsuario()?.id ?? "transicao"}:${sitio}:${caminho}`;
  const payload = JSON.stringify(dados);
  let anterior: { payload: string; chave: string } | null = tentativasEmMemoria.get(armazenamento) ?? null;
  try {
    anterior = JSON.parse(sessionStorage.getItem(armazenamento) ?? "null") ?? anterior;
  } catch {
    /* armazenamento indisponível */
  }
  const chave =
    anterior?.payload === payload ? anterior.chave : crypto.randomUUID();
  if (comChave) {
    tentativasEmMemoria.set(armazenamento, { payload, chave });
    try { sessionStorage.setItem(armazenamento, JSON.stringify({ payload, chave })); } catch { /* Reenvio preservado em memória. */ }
  }
  const resultado = await requisitar<T>(
    caminho,
    sitio,
    comChave ? { ...dados, chave } : dados,
  );
  if (comChave) {
    tentativasEmMemoria.delete(armazenamento);
    try { sessionStorage.removeItem(armazenamento); } catch { /* Sem persistência local disponível. */ }
  }
  return resultado;
}
export interface EstoqueLeiteDTO {
  quantidadeLitros: string | null;
  confiavel: boolean;
  motivoNaoAferivel: string | null;
  estadoValor: "OCULTO" | "PENDENTE" | "APURADO";
  valorTotal: string | null;
  comercial: {
    confiavel: boolean;
    quantidadeLitros: string | null;
    motivoNaoAferivel: string | null;
  };
  origens: {
    nomeOrdenha: string;
    natureza: string;
    versaoClassificacao: number;
    entradaId: string;
    sessaoId: string;
    data: string;
    quantidadeLitros: string;
    estadoValor: string;
    valorTotal: string | null;
    versaoApuracao: number;
  }[];
}

export async function alterarLeite<T>(
  caminho: string,
  sitio: number | null,
  dados: Record<string, unknown>,
): Promise<T> {
  return requisitar<T>(caminho, sitio, dados, "PATCH");
}
