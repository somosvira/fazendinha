// Fetch tipado de /api/pecuaria/rebanho/*, no padrão de client/src/financeiro/novo-api.ts.
// Contrato: server/src/routes/pecuaria/rebanho.ts + services/pecuaria/rebanho/{schemas,mappers}.ts.

import { comPropriedade } from "../../propriedadeScope";
import type {
  AnimalFicha,
  CadastrarAnimalInput,
  Catalogos,
  CriarLoteInput,
  CriarMotivoSaidaInput,
  CriarRacaInput,
  EditarAnimalInput,
  EditarLoteInput,
  EditarMotivoSaidaInput,
  EditarPesagemInput,
  EditarRacaInput,
  EntradaAuditoria,
  EstornoSaidaInput,
  ItemComposicao,
  ListarFiltros,
  ListarResultado,
  Lote,
  MotivoSaida,
  MovimentarInput,
  MudarDestinoInput,
  PainelGeral,
  Pesagem,
  PesagemInput,
  Raca,
  SaidaInput,
  SubstituirComposicaoInput,
} from "./types";

/** Erro da API do rebanho: `campo` indica o input ao qual a mensagem se refere
 *  (mesmo formato do `ApiError` de client/src/financeiro/novo-api.ts), para os
 *  formulários da Pecuária mapearem o erro por campo. */
export class RebanhoApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public campo?: string) {
    super(message);
    this.name = "RebanhoApiError";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho${path}`, {
    ...init,
    headers: comPropriedade({
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...((init?.headers as Record<string, string>) ?? {}),
    }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new RebanhoApiError(corpo.error ?? `Erro HTTP ${resposta.status}`, resposta.status, corpo.code, corpo.campo);
  return corpo as T;
}

function comIncluirInativos(path: string, incluirInativos?: boolean): string {
  return incluirInativos ? `${path}?incluirInativos=true` : path;
}

// ---------- animais ----------

export const listarAnimais = (filtros: ListarFiltros) => {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(chave, String(valor));
  }
  const query = params.toString();
  return req<ListarResultado>(`/animais${query ? `?${query}` : ""}`);
};

export const cadastrarAnimal = (input: CadastrarAnimalInput) =>
  req<AnimalFicha>("/animais", { method: "POST", body: JSON.stringify(input) });

export const buscarFichaAnimal = (id: string) => req<AnimalFicha>(`/animais/${id}`);

export const editarAnimal = (id: string, input: EditarAnimalInput) =>
  req<AnimalFicha>(`/animais/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const substituirComposicaoAnimal = (id: string, input: SubstituirComposicaoInput) =>
  req<ItemComposicao[]>(`/animais/${id}/composicao`, { method: "PUT", body: JSON.stringify(input) });

export const buscarAuditoriaAnimal = (id: string) => req<EntradaAuditoria[]>(`/animais/${id}/auditoria`);

export const movimentarAnimais = (input: MovimentarInput) =>
  req<{ movimentacaoId: string; movidos: number }>("/animais/movimentar", { method: "POST", body: JSON.stringify(input) });

export const mudarDestinoAnimal = (id: string, input: MudarDestinoInput) =>
  req<AnimalFicha>(`/animais/${id}/destino`, { method: "POST", body: JSON.stringify(input) });

/** "Desfazer última movimentação": fecha a linha aberta e reabre a anterior. */
export const desfazerLocalizacaoAnimal = (id: string) =>
  req<AnimalFicha>(`/animais/${id}/localizacao/desfazer`, { method: "POST" });

/** "Desfazer última mudança de destino": idem, para aptidão/papel reprodutivo. */
export const desfazerDestinoAnimal = (id: string) =>
  req<AnimalFicha>(`/animais/${id}/destino/desfazer`, { method: "POST" });

export const darSaidaAnimal = (id: string, input: SaidaInput) =>
  req<AnimalFicha>(`/animais/${id}/saida`, { method: "POST", body: JSON.stringify(input) });

export const estornarSaidaAnimal = (id: string, input: EstornoSaidaInput) =>
  req<AnimalFicha>(`/animais/${id}/saida/estorno`, { method: "POST", body: JSON.stringify(input) });

export const registrarPesagemAnimal = (id: string, input: PesagemInput) =>
  req<Pesagem>(`/animais/${id}/pesagens`, { method: "POST", body: JSON.stringify(input) });

export const editarPesagem = (id: string, input: EditarPesagemInput) =>
  req<Pesagem>(`/pesagens/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const excluirPesagem = (id: string) => req<{ ok: boolean }>(`/pesagens/${id}`, { method: "DELETE" });

// ---------- lotes ----------

export const listarLotes = (opts?: { incluirInativos?: boolean }) =>
  req<Lote[]>(comIncluirInativos("/lotes", opts?.incluirInativos));

export const criarLote = (input: CriarLoteInput) => req<Lote>("/lotes", { method: "POST", body: JSON.stringify(input) });

export const editarLote = (id: string, input: EditarLoteInput) =>
  req<Lote>(`/lotes/${id}`, { method: "PATCH", body: JSON.stringify(input) });

// ---------- raças ----------

export const listarRacas = (opts?: { incluirInativos?: boolean }) =>
  req<Raca[]>(comIncluirInativos("/racas", opts?.incluirInativos));

export const criarRaca = (input: CriarRacaInput) => req<Raca>("/racas", { method: "POST", body: JSON.stringify(input) });

export const editarRaca = (id: string, input: EditarRacaInput) =>
  req<Raca>(`/racas/${id}`, { method: "PATCH", body: JSON.stringify(input) });

// ---------- motivos de saída ----------

export const listarMotivosSaida = (opts?: { incluirInativos?: boolean }) =>
  req<MotivoSaida[]>(comIncluirInativos("/motivos-saida", opts?.incluirInativos));

export const criarMotivoSaida = (input: CriarMotivoSaidaInput) =>
  req<MotivoSaida>("/motivos-saida", { method: "POST", body: JSON.stringify(input) });

export const editarMotivoSaida = (id: string, input: EditarMotivoSaidaInput) =>
  req<MotivoSaida>(`/motivos-saida/${id}`, { method: "PATCH", body: JSON.stringify(input) });

// ---------- visão geral e catálogos ----------

export const obterPainelRebanho = () => req<PainelGeral>("/painel");

export const obterCatalogos = () => req<Catalogos>("/catalogos");
