import { comPropriedade } from "../../../propriedadeScope";

type EstadoCarencia = { estado: "NENHUMA" } | { estado: "NAO_INFORMADO" } | { estado: "CONHECIDO"; ate: string; precisaoAproximada: boolean };
export type CarenciaAnimal = { leite: EstadoCarencia; carne: EstadoCarencia };
export type AplicacaoSanitaria = {
  id: string; data: string; aplicadaEm: string | null; finalidade: "TRATAMENTO" | "VACINA" | "VERMIFUGO";
  nomeProdutoAplicado: string; dose: string; unidadeDose: string | null; origemInsumo: string;
  operacaoServicoId: string | null; status: "VALIDO" | "ANULADO";
};
export type ServicoSanitario = { id: string; numero: number; data: string; descricao: string | null; valorTotal?: string; parceiro: { nome: string } | null };

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/pecuaria/rebanho/sanidade${caminho}`, {
    ...init, headers: comPropriedade({ ...(init?.body ? { "content-type": "application/json" } : {}), ...((init?.headers as Record<string, string>) ?? {}) }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error ?? `Erro HTTP ${resposta.status}`);
  return dados as T;
}

export const listarAplicacoes = (animalId: string) => req<AplicacaoSanitaria[]>(`/aplicacoes?animalId=${encodeURIComponent(animalId)}`);
export const consultarCarencia = (animalId: string) => req<CarenciaAnimal>(`/animais/${encodeURIComponent(animalId)}/carencia`);
export const listarServicos = (propriedadeId: number) => req<ServicoSanitario[]>(`/servicos?propriedadeId=${propriedadeId}`);
export const registrarAplicacaoServico = (input: {
  animalId: string; propriedadeId: number; data: string; aplicadaEm: string; finalidade: AplicacaoSanitaria["finalidade"];
  nomeProdutoAplicado: string; dose: string; unidadeDose: string; operacaoServicoId: string;
  carenciaLeiteHoras: number | null; carenciaCarneHoras: number | null; partidaCodigo?: string;
}) => req<AplicacaoSanitaria>("/aplicacoes", { method: "POST", body: JSON.stringify({ ...input, origemInsumo: "INCLUSO_SERVICO" }) });
