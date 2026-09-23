import { useCallback, useEffect, useRef, useState } from "react";
import { comPropriedade } from "../propriedadeScope";
import { ApiError, type Categoria, type CentroCusto, type Parceiro, type Produto } from "../financeiro/novo-api";

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

// ── Estoque: saldos + movimentos + custo vaca/dia ───────────────────────────
export interface SaldoDTO { produtoId: number; nome: string; tipo: string; unidade: string; centrosCusto: { id: number; nome: string }[]; saldo: number; valor: number; minimoEstoque: number | null; abaixoMinimo: boolean; }
export type OrigemMovimento = "COMPRA" | "CONSUMO_DIRETO" | "TRANSFERENCIA" | "PRODUCAO" | "DEVOLUCAO" | "BONIFICACAO" | "INVENTARIO_INICIAL" | "NUTRICAO" | "SANIDADE" | "PERDA" | "AJUSTE_INVENTARIO" | "APLICACAO";
export interface MovimentoDTO { id: number; produtoId: number; produto: string; centrosCusto: { id: number; nome: string }[]; tipo: "ENTRADA" | "SAIDA" | "AJUSTE"; origem: OrigemMovimento; status: "CONFIRMADO" | "REVERTIDO"; reversaoDeId: number | null; data: string; quantidade: number; custoUnitario: number; valorTotal: number; fornecedor: string | null; grupo: string | null; observacao: string | null; }
export interface MovimentoInput { produtoId: number; tipo: "AJUSTE"; data: string; quantidade: number; custoUnitario?: number; grupoId?: number; observacao?: string; centroCustoId?: number; }
export interface MovimentoResult { id: number; operacaoId: number; }
export interface CustoVacaDia { periodoDias: number; custoVacaDia: number | null; vacasEmLactacao: number; totalConsumo: number; }

export const listarSaldos = (f?: { centroCustoId?: number | string }) => req<SaldoDTO[]>(`/estoque/saldos${qs(f)}`);
export const listarMovimentos = (f?: { produtoId?: number; tipo?: string }) => req<MovimentoDTO[]>(`/estoque/movimentos${qs(f)}`);
export const registrarMovimento = (p: MovimentoInput) => req<MovimentoResult>(`/estoque/movimentos`, { method: "POST", body: JSON.stringify(p) });
export interface AjusteContagemInput { produtoId: number; quantidadeContada: number; saldoEsperado: number; observacao: string; }
export const ajustarContagem = (p: AjusteContagemInput) => req<{ id: number; operacaoId: number; saldoAnterior: number; quantidadeContada: number; diferenca: number }>(`/estoque/ajustes`, { method: "POST", body: JSON.stringify(p) });
export const excluirMovimento = (id: number) => req<{ ok: true }>(`/estoque/movimentos/${id}`, { method: "DELETE" });
export const obterCustoVacaDia = (dias = 30) => req<CustoVacaDia>(`/estoque/custo-vaca-dia?dias=${dias}`);

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

export function useCustoVacaDia(dias = 30) {
  const [data, setData] = useState<CustoVacaDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const idRef = useRef(0);
  const buscar = useCallback(() => {
    const id = ++idRef.current;
    setLoading(true); setErro(null);
    obterCustoVacaDia(dias).then((d) => { if (id === idRef.current) setData(d); })
      .catch((e) => { if (id === idRef.current) setErro(e.message); })
      .finally(() => { if (id === idRef.current) setLoading(false); });
  }, [dias]);
  useEffect(() => { buscar(); return () => { idRef.current++; }; }, [buscar]);
  return { data, loading, erro, recarregar: buscar };
}

// ── Cadastros (Produtos + referências financeiras) ─────────────────────────
// Mesmos DTOs/rotas do `/estoque/*` (gate pecuária|agricultura|financeiro) —
// os services por trás são os mesmos de `/rebanho/*` (ver server/src/routes/estoque.ts).
export type TipoProduto = "MEDICAMENTO" | "RACAO" | "INSUMO" | "MINERAL" | "OUTRO";
export type TipoInsumoPlantio = "FERTILIZANTE" | "DEFENSIVO" | "HERBICIDA" | "CORRETIVO" | "BIOLOGICO" | "FOLIAR" | "MUDA" | "OUTRO";
// Mesmo tipo de `financeiro/novo-api.ts` (contrato único de Produto na API) —
// `/estoque/produtos` e `/financeiro/produtos` são a mesma tabela e o mesmo service.
export type ProdutoDTO = Produto;
export interface ProdutoInput {
  nome: string; tipo: TipoProduto; subtipoPlantio?: TipoInsumoPlantio | null; unidade: string;
  custoUnitario?: number | null; estocavel?: boolean;
  minimoEstoque?: number | null; ativo?: boolean; categoriaId?: number | null; centroCustoIds?: number[]; fornecedorIds?: number[];
}
export const listarProdutos = (f?: { tipo?: string; q?: string; ativo?: boolean }) => req<ProdutoDTO[]>(`/estoque/produtos${qs(f)}`);
export const criarProduto = (p: ProdutoInput) => req<ProdutoDTO>(`/estoque/produtos`, { method: "POST", body: JSON.stringify(p) });
export const editarProduto = (id: number, p: Partial<ProdutoInput>) => req<ProdutoDTO>(`/estoque/produtos/${id}`, { method: "PATCH", body: JSON.stringify(p) });

export function useProdutosEstoque(f?: { tipo?: string; q?: string; ativo?: boolean }) {
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

// ── Princípios ativos (composição de medicamento — base carência/antibiótico) ──
export interface PrincipioAtivoDTO {
  id: number; nome: string; ehAntibiotico: boolean;
  carenciaLeiteHoras: number | null; carenciaCarneDias: number | null;
  ativo: boolean; usoEmProdutos: number;
}
export interface PrincipioAtivoInput {
  nome: string; ehAntibiotico?: boolean;
  carenciaLeiteHoras?: number | null; carenciaCarneDias?: number | null; ativo?: boolean;
}
export interface ComposicaoProdutoDTO {
  produtoId: number; produtoNome: string;
  principios: { principioAtivoId: number; nome: string; concentracao: string | null; ehAntibiotico: boolean }[];
  ehAntibiotico: boolean; carenciaLeiteHorasSugerida: number | null; carenciaCarneDiasSugerida: number | null;
}

export const listarPrincipiosAtivos = (incluirInativos = false) =>
  req<PrincipioAtivoDTO[]>(`/estoque/principios-ativos${incluirInativos ? "?inativos=1" : ""}`);
export const criarPrincipioAtivo = (body: PrincipioAtivoInput) =>
  req<PrincipioAtivoDTO>(`/estoque/principios-ativos`, { method: "POST", body: JSON.stringify(body) });
export const atualizarPrincipioAtivo = (id: number, body: Partial<PrincipioAtivoInput>) =>
  req<PrincipioAtivoDTO>(`/estoque/principios-ativos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const excluirPrincipioAtivo = (id: number) =>
  req<{ ok: true }>(`/estoque/principios-ativos/${id}`, { method: "DELETE" });
export const obterComposicaoProduto = (produtoId: number) =>
  req<ComposicaoProdutoDTO>(`/estoque/produtos/${produtoId}/composicao`);
export const definirComposicaoProduto = (produtoId: number, principios: { principioAtivoId: number; concentracao?: string }[]) =>
  req<ComposicaoProdutoDTO>(`/estoque/produtos/${produtoId}/composicao`, { method: "PUT", body: JSON.stringify({ principios }) });

export function usePrincipiosAtivos(incluirInativos = false) {
  const [data, setData] = useState<PrincipioAtivoDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => {
    setLoading(true);
    listarPrincipiosAtivos(incluirInativos).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [incluirInativos]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}

// ── Composição de produto / ração formulada (receita = ingredientes × proporção %) ──
export interface ResumoComposicaoRacaoDTO { soma: number; somaOk: boolean; nIngredientes: number }
export interface ItemComposicaoRacaoDTO { ingredienteId: number; ingredienteNome: string; proporcao: number }
export interface ComposicaoRacaoDTO { produtoId: number; produtoNome: string; itens: ItemComposicaoRacaoDTO[]; resumo: ResumoComposicaoRacaoDTO }
export const obterComposicaoRacao = (produtoId: number) => req<ComposicaoRacaoDTO>(`/estoque/produtos/${produtoId}/composicao-racao`);
export const definirComposicaoRacao = (produtoId: number, itens: { ingredienteId: number; proporcao: number }[]) =>
  req<ComposicaoRacaoDTO>(`/estoque/produtos/${produtoId}/composicao-racao`, { method: "PUT", body: JSON.stringify({ itens }) });

// ── Lotes de produto (código + validade + local) + locais de armazenamento ────
export type StatusValidadeLote = "vencido" | "a-vencer" | "ok" | "sem-validade";
export interface LocalArmazenamentoDTO { id: number; nome: string; ativo: boolean; totalLotes: number }
export interface LoteProdutoDTO {
  id: number; produtoId: number; produtoNome: string; codigo: string;
  validade: string | null; localId: number | null; localNome: string | null;
  quantidade: number | null; status: StatusValidadeLote;
}
export interface ResumoLotesDTO { vencido: number; "a-vencer": number; ok: number; "sem-validade": number; total: number }
export interface LotesRespDTO { lotes: LoteProdutoDTO[]; resumo: ResumoLotesDTO }
export interface LoteProdutoInput { produtoId: number; codigo: string; validade?: string | null; localId?: number | null; quantidade?: number | null }

export const listarLocaisArmazenamento = () => req<LocalArmazenamentoDTO[]>(`/estoque/locais-armazenamento`);
export const criarLocalArmazenamento = (body: { nome: string }) => req<LocalArmazenamentoDTO>(`/estoque/locais-armazenamento`, { method: "POST", body: JSON.stringify(body) });
export const excluirLocalArmazenamento = (id: number) => req<{ ok: true }>(`/estoque/locais-armazenamento/${id}`, { method: "DELETE" });
export const listarLotesProduto = () => req<LotesRespDTO>(`/estoque/lotes-produto`);
export const criarLoteProduto = (body: LoteProdutoInput) => req<LoteProdutoDTO>(`/estoque/lotes-produto`, { method: "POST", body: JSON.stringify(body) });
export const excluirLoteProduto = (id: number) => req<{ ok: true }>(`/estoque/lotes-produto/${id}`, { method: "DELETE" });
export function useLotesProduto() {
  const [data, setData] = useState<LotesRespDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const recarregar = useCallback(() => { setLoading(true); listarLotesProduto().then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, recarregar };
}
