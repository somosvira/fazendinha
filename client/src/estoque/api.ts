import { useCallback, useEffect, useRef, useState } from "react";
import { comPropriedade } from "../propriedadeScope";
import { ApiError, type Categoria, type CentroCusto, type Parceiro, type Produto } from "../financeiro/novo-api";
import type { UnidadeMedida } from "../lib/unidades";

export { ApiError };
// Tipos de referência do plano financeiro (categoria/centro de custo/parceiro) —
// mesmo contrato de `financeiro/novo-api.ts`, reusado aqui para não duplicar.
export type { Categoria, CentroCusto, Parceiro };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) || {}) };
  if (init?.body) headers["content-type"] = "application/json";
  const res = await fetch(`/api${path}`, { ...init, headers: comPropriedade(headers) });
  if (!res.ok) {
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error;                                   // erro do service (ex.: número duplicado)
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; "); // ZodError do zValidator
    throw new ApiError(msg, res.status, b?.code, b?.campo);
  }
  return res.json();
}

// monta a query string a partir de um objeto (ignora undefined/null/"") — ?a=1&b=2 ou ""
function qs(f?: object): string {
  if (!f) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// Centros de custo "de atividade" (leite/café) — usados pelos módulos rebanho/
// plantio para pré-filtrar a tela de Estoque. Rota própria (não atrás do gate
// de área "financeiro"), montada sob /api/estoque/* (pecuaria|agricultura|financeiro).
export interface CentrosAtividadeDTO { leite: number | null; cafe: number | null }
export const obterCentrosAtividade = () => req<CentrosAtividadeDTO>("/estoque/centros-atividade");

// ── Estoque: saldos + movimentos ───────────────────────────
export interface SaldoDTO { produtoId: number; nome: string; categoria: { id: number; nome: string; usoSanitario: boolean; usoNutricional: boolean; usoAgricola: boolean } | null; unidade: UnidadeMedida; centrosCusto: { id: number; nome: string }[]; saldo: number;
  /** Média ponderada das entradas valorizadas no sítio; null sem base (nenhuma compra/inventário com valor). */
  custoMedio: number | null;
  /** saldo × custoMedio (0 quando custoMedio é null). */
  valor: number; minimoEstoque: number | null; abaixoMinimo: boolean; }
export type OrigemMovimento = "COMPRA" | "CONSUMO_DIRETO" | "TRANSFERENCIA" | "PRODUCAO" | "DEVOLUCAO" | "BONIFICACAO" | "INVENTARIO_INICIAL" | "NUTRICAO" | "SANIDADE" | "PERDA" | "AJUSTE_INVENTARIO" | "APLICACAO";
export type VinculoMovimento = { tipo: "LOTE"; id: number; nome: string } | { tipo: "ANIMAL"; id: number; numero: string; nome: string | null } | { tipo: "TALHAO"; id: number; codigo: string };
export interface MovimentoDTO { id: number; produtoId: number; produto: string; centrosCusto: { id: number; nome: string }[]; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; origem: OrigemMovimento; status: "CONFIRMADO" | "REVERTIDO"; reversaoDeId: number | null; data: string; quantidade: number; custoUnitario: number; valorTotal: number; fornecedor: string | null; grupo: string | null; observacao: string | null;
  /** Operação financeira de origem (compra, ajuste, inventário…); null nas saídas automáticas. */
  operacaoId: number | null;
  /** Lote/animal/talhão de origem das saídas automáticas (dieta/sanidade/aplicação); null nos demais. */
  vinculo: VinculoMovimento | null; }
export interface MovimentoInput { produtoId: number; tipo: "AJUSTE"; data: string; quantidade: number; custoUnitario?: number; grupoId?: number; observacao?: string; centroCustoId?: number; }
export interface MovimentoResult { id: number; operacaoId: number; }

export const listarSaldos = (f?: { centroCustoId?: number | string }) => req<SaldoDTO[]>(`/estoque/saldos${qs(f)}`);
export const listarMovimentos = (f?: { produtoId?: number; tipo?: string }) => req<MovimentoDTO[]>(`/estoque/movimentos${qs(f)}`);
export const registrarMovimento = (p: MovimentoInput) => req<MovimentoResult>(`/estoque/movimentos`, { method: "POST", body: JSON.stringify(p) });
export interface AjusteContagemInput { produtoId: number; quantidadeContada: number; saldoEsperado: number; observacao: string; }
export const ajustarContagem = (p: AjusteContagemInput) => req<{ id: number; operacaoId: number; saldoAnterior: number; quantidadeContada: number; diferenca: number }>(`/estoque/ajustes`, { method: "POST", body: JSON.stringify(p) });
export const excluirMovimento = (id: number) => req<{ ok: true }>(`/estoque/movimentos/${id}`, { method: "DELETE" });

// Descarta uma resposta que chegou depois de o filtro/parâmetro já ter mudado
// (ou o hook ter desmontado) — sem isso, uma busca sem filtro que só termina
// depois de uma busca já filtrada sobrescreveria a lista filtrada.
export function useSaldos(f?: { centroCustoId?: number | string }) {
  const [data, setData] = useState<SaldoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const idRef = useRef(0);
  const buscar = useCallback(() => {
    const id = ++idRef.current;
    setLoading(true); setErro(null);
    listarSaldos(f).then((d) => { if (id === idRef.current) setData(d); })
      .catch((e) => { if (id === idRef.current) setErro(e.message); })
      .finally(() => { if (id === idRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { buscar(); return () => { idRef.current++; }; }, [buscar]);
  return { data, loading, erro, recarregar: buscar };
}

// ── Cadastros (Produtos + referências financeiras) ─────────────────────────
// Mesmos DTOs/rotas do `/estoque/*` (gate pecuária|agricultura|financeiro) —
// os services por trás são os mesmos de `/rebanho/*` (ver server/src/routes/estoque.ts).
// Mesmo tipo de `financeiro/novo-api.ts` (contrato único de Produto na API) —
// `/estoque/produtos` e `/financeiro/produtos` são a mesma tabela e o mesmo service.
export type ProdutoDTO = Produto;
export type UsoProduto = "sanitario" | "nutricional" | "agricola";
export interface ProdutoInput {
  nome: string; unidade: UnidadeMedida;
  // Categoria obrigatória (define o uso). Se o produto entra no estoque quem decide é a operação.
  minimoEstoque?: number | null; ativo?: boolean; categoriaId: number; centroCustoIds?: number[]; fornecedorIds?: number[];
}
export const listarProdutos = (f?: { uso?: UsoProduto; q?: string; ativo?: boolean }) => req<ProdutoDTO[]>(`/estoque/produtos${qs(f)}`);
export const criarProduto = (p: ProdutoInput) => req<ProdutoDTO>(`/estoque/produtos`, { method: "POST", body: JSON.stringify(p) });
export const editarProduto = (id: number, p: Partial<ProdutoInput>) => req<ProdutoDTO>(`/estoque/produtos/${id}`, { method: "PATCH", body: JSON.stringify(p) });

// Sugestão de preço na compra: último item comprado (operação confirmada) do
// produto, preferindo o fornecedor informado. null quando não há histórico.
export interface UltimoPrecoDTO { valorUnitario: string; data: string; parceiro: { id: number; nome: string } | null }
export const obterUltimoPreco = (produtoId: number, parceiroId?: number | null) =>
  req<UltimoPrecoDTO | null>(`/estoque/produtos/${produtoId}/ultimo-preco${qs({ parceiroId })}`);

// Custo médio atual do produto (mesma conta de `useSaldos`/`listarSaldos`, isolada
// por produto) — apoio quando não há última compra para sugerir preço.
export interface CustoMedioDTO { custoMedio: number | null }
export const obterCustoMedio = (produtoId: number) => req<CustoMedioDTO>(`/estoque/produtos/${produtoId}/custo-medio`);

export function useProdutosEstoque(f?: { uso?: UsoProduto; q?: string; ativo?: boolean }) {
  const [data, setData] = useState<ProdutoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const key = JSON.stringify(f ?? {});
  const idRef = useRef(0);
  const recarregar = useCallback(() => {
    const id = ++idRef.current;
    setLoading(true); setErro(null);
    listarProdutos(f).then((d) => { if (id === idRef.current) setData(d); })
      .catch((e) => { if (id === idRef.current) setErro(e.message); })
      .finally(() => { if (id === idRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { recarregar(); return () => { idRef.current++; }; }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export interface RefDTO { id: number; nome: string }
export const listarCategorias = (incluirInativos = false) => req<Categoria[]>(`/estoque/categorias${incluirInativos ? "?incluirInativos=1" : ""}`);
export const listarCentrosCusto = (incluirInativos = false) => req<CentroCusto[]>(`/estoque/centros-custo${incluirInativos ? "?incluirInativos=1" : ""}`);
export const listarFornecedores = () => req<Parceiro[]>(`/estoque/fornecedores`);
export function useCentrosCustoEstoque() {
  const [data, setData] = useState<CentroCusto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setErro(null);
    listarCentrosCusto().then(setData).catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, erro, recarregar };
}
