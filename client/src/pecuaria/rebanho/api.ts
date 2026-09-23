// Fetch tipado de /api/pecuaria/rebanho/*, no padrão de client/src/financeiro/novo-api.ts.

import { comPropriedade } from "../../propriedadeScope";
import type {
  AnimalFicha,
  CadastrarAnimalInput,
  Catalogos,
  CriarLoteInput,
  EditarAnimalInput,
  EditarLoteInput,
  EstornoSaidaInput,
  ListarFiltros,
  ListarResultado,
  Lote,
  MovimentarInput,
  MudarDestinoInput,
  PesagemInput,
  SaidaInput,
} from "./types";

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

export const movimentarAnimais = (input: MovimentarInput) =>
  req<{ movimentacaoId: string; movidos: number }>("/animais/movimentar", { method: "POST", body: JSON.stringify(input) });

export const mudarDestinoAnimal = (id: string, input: MudarDestinoInput) =>
  req<AnimalFicha>(`/animais/${id}/destino`, { method: "POST", body: JSON.stringify(input) });

export const darSaidaAnimal = (id: string, input: SaidaInput) =>
  req<AnimalFicha>(`/animais/${id}/saida`, { method: "POST", body: JSON.stringify(input) });

export const estornarSaidaAnimal = (id: string, input: EstornoSaidaInput) =>
  req<AnimalFicha>(`/animais/${id}/saida/estorno`, { method: "POST", body: JSON.stringify(input) });

export const registrarPesagemAnimal = (id: string, input: PesagemInput) =>
  req<{ id: string; animalId: string; data: string; pesoKg: number; tipo: string; origem: string }>(`/animais/${id}/pesagens`, { method: "POST", body: JSON.stringify(input) });

export const listarLotes = () => req<Lote[]>("/lotes");

export const criarLote = (input: CriarLoteInput) => req<Lote>("/lotes", { method: "POST", body: JSON.stringify(input) });

export const editarLote = (id: string, input: EditarLoteInput) =>
  req<Lote>(`/lotes/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const obterCatalogos = () => req<Catalogos>("/catalogos");
