/* Camada de leitura/escrita do módulo Financeiro (form Lançar).
 *
 * Espelha o pattern de client/src/plantio/api.ts: hooks `useXxx()` com o
 * contrato {data, loading, erro, recarregar} e funções de escrita que batem
 * em /api/*. As formas dos DTOs espelham server/src/routes/cadastros.ts,
 * lancamentos.ts e notaFiscal.ts — não inventar campos.
 */

import { useCallback, useEffect, useState } from "react";
import { comPropriedade } from "../propriedadeScope";

// ─── Cadastros (GET /api/cadastros) ──────────────────────────────────────

export interface CentroCustoDTO { id: number; nome: string; ehInvestimento: boolean }
export interface ContaDTO { id: number; nome: string; banco: string | null }
export interface CategoriaDTO { id: number; nome: string }
export interface GrupoDTO { id: number; nome: string; categorias: CategoriaDTO[] }
export interface FornecedorDTO { id: number; nome: string; documento: string | null }

export interface Cadastros {
  centrosCusto: CentroCustoDTO[];
  contas: ContaDTO[];
  grupos: GrupoDTO[];
  fornecedores: FornecedorDTO[];
}

export function useCadastros() {
  const [data, setData] = useState<Cadastros | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    fetch("/api/cadastros")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: Cadastros) => setData(j))
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ─── Upload pendente de NF (POST /api/nota-fiscal/upload-pendente) ───────

export interface PendenteNF {
  id: number;
  sha256: string;
  mimeType: string;
  tamanhoBytes: number;
  expiraEm: string; // ISO
}

export type ResultadoUploadNF =
  | { ok: true; pendente: PendenteNF; retomada: boolean }
  | {
      ok: false;
      status: number;
      erro: string;
      codigo?: "VALIDACAO" | "DUPLICATA_DEFINITIVA" | "JA_EM_OUTRO_PROCESSO";
      // DUPLICATA_DEFINITIVA: a foto já virou lançamento real.
      arquivoExistente?: { id: number; lancamentoId: number };
    };

export async function uploadPendenteNF(file: File): Promise<ResultadoUploadNF> {
  const form = new FormData();
  form.append("arquivo", file);
  try {
    const res = await fetch("/api/nota-fiscal/upload-pendente", { method: "POST", body: form });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        erro: json.erro || `Falha no upload (HTTP ${res.status})`,
        codigo: json.codigo,
        arquivoExistente: json.arquivoExistente,
      };
    }
    return { ok: true, pendente: json.pendente as PendenteNF, retomada: !!json.retomada };
  } catch (e: unknown) {
    return { ok: false, status: 0, erro: e instanceof Error ? e.message : "Falha de rede no upload" };
  }
}

/** DELETE /api/nota-fiscal/upload-pendente/:id — best effort, idempotente. */
export async function cancelarPendenteNF(id: number): Promise<void> {
  try {
    await fetch(`/api/nota-fiscal/upload-pendente/${id}`, { method: "DELETE" });
  } catch {
    // best effort — o cleanup hourly do servidor expira pendentes órfãs
  }
}

// ─── Criação de lançamento (POST /api/lancamentos) ───────────────────────

// Espelha o schema Zod de server/src/routes/lancamentos.ts.
export interface NovoLancamentoInput {
  // Opcional: presente → amarra a NF pendente; ausente → lançamento sem foto
  // (gasto sem NF ou receita, que normalmente não tem nota).
  pendenteId?: number | null;
  natureza?: "DEBITO" | "CREDITO";
  valorBR: string;          // "38.450,00" — o servidor parseia
  dataBR: string;           // "dd/mm/aaaa"
  categoriaId: number;
  centroCustoId: number;
  contaBancariaId?: number | null;
  fornecedorId?: number | null;   // ID se escolheu da lista…
  fornecedorNome?: string | null; // …nome se digitou um novo (upsert no server)
  pago?: boolean;           // true → LIQUIDADO com dataLiquidacao = dataBR
  descricao?: string | null;
  numeroDocumento?: string | null;
}

export type ResultadoCriarLancamento =
  // arquivoId é null quando o lançamento foi criado sem nota fiscal.
  | { ok: true; lancamentoId: number; arquivoId: number | null }
  | { ok: false; status: number; erro: string; codigo?: "PENDENTE_INVALIDA" | "MES_FECHADO" | string };

// ─── Caixinha (fundo fixo em dinheiro) ───────────────────────────────────
// Espelha o pattern de cultivo/api.ts: helper `req<T>` + hooks
// {data, loading, erro, recarregar}. DTOs espelham
// server/src/services/caixinha/caixinhas.ts — não inventar campos.

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = comPropriedade({
    ...((init?.headers as Record<string, string>) || {}),
    ...(init?.body ? { "content-type": "application/json" } : {}),
  });
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = await res.json().catch(() => null);
    let msg = `HTTP ${res.status}`;
    if (typeof b?.error === "string") msg = b.error; // erro do service (ex.: 409 mês fechado)
    else if (typeof b?.erro === "string") msg = b.erro; // idem, chave PT (rotas em português)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (b?.error?.issues?.length) msg = b.error.issues.map((i: any) => i.message).join("; "); // ZodError do zValidator
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type TipoMovimentoCaixinha = "ENTRADA" | "SAIDA";

export interface CaixinhaDTO {
  id: number;
  nome: string;
  responsavel: string | null;
  saldoAtual: number;
  ativo: boolean;
}

export interface MovimentoCaixinhaDTO {
  id: number;
  caixinhaId: number;
  data: string; // YYYY-MM-DD
  tipo: TipoMovimentoCaixinha;
  valor: number; // sempre positivo — sinal vem do tipo
  descricao: string;
  observacao: string | null;
}

export interface CaixinhaInput {
  nome: string;
  responsavel?: string | null;
}

export interface MovimentoCaixinhaInput {
  data: string; // YYYY-MM-DD
  tipo: TipoMovimentoCaixinha;
  valor: number;
  descricao: string;
  observacao?: string | null;
}

export const listarCaixinhas = () => req<CaixinhaDTO[]>(`/caixinhas`);
export const criarCaixinha = (input: CaixinhaInput) =>
  req<CaixinhaDTO>(`/caixinhas`, { method: "POST", body: JSON.stringify(input) });
export const editarCaixinha = (id: number, input: Partial<CaixinhaInput> & { ativo?: boolean }) =>
  req<CaixinhaDTO>(`/caixinhas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const listarMovimentosCaixinha = (caixinhaId: number, mes?: string) =>
  req<MovimentoCaixinhaDTO[]>(`/caixinhas/${caixinhaId}/movimentos${mes ? `?mes=${mes}` : ""}`);
export const criarMovimentoCaixinha = (caixinhaId: number, input: MovimentoCaixinhaInput) =>
  req<MovimentoCaixinhaDTO>(`/caixinhas/${caixinhaId}/movimentos`, { method: "POST", body: JSON.stringify(input) });
export const excluirMovimentoCaixinha = (caixinhaId: number, movimentoId: number) =>
  req<void>(`/caixinhas/${caixinhaId}/movimentos/${movimentoId}`, { method: "DELETE" });

export function useCaixinhas() {
  const [data, setData] = useState<CaixinhaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    listarCaixinhas().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function useMovimentosCaixinha(caixinhaId: number | null, mes?: string) {
  const [data, setData] = useState<MovimentoCaixinhaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    if (caixinhaId == null) { setData([]); setLoading(false); return; }
    setLoading(true); setErro(null);
    listarMovimentosCaixinha(caixinhaId, mes).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [caixinhaId, mes]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ─── Contas a vencer (GET /api/vencimentos) ──────────────────────────────
// Espelha o DTO de server/src/services/vencimentos.ts. Regime de caixa:
// Lancamentos ABERTO/DEBITO = contas a pagar. `hoje` (opcional) permite fixar
// a âncora do frontend (HOJE = 2026-05-28).

export type BucketVencimento = "VENCIDA" | "HOJE" | "D3" | "D7" | "FUTURO";

export interface ContaAVencerItem {
  id: number;
  descricao: string | null;
  fornecedorNome: string | null;
  categoriaNome: string;
  valor: number; // sempre positivo
  dataVencimento: string; // YYYY-MM-DD
  diasAtraso: number; // >0 vencida, <=0 a vencer (0 = vence hoje)
}

export interface ContasAVencerDTO {
  hoje: string; // YYYY-MM-DD
  vencidas: ContaAVencerItem[];
  venceHoje: ContaAVencerItem[];
  proximos3: ContaAVencerItem[];
  proximos7: ContaAVencerItem[];
  totais: {
    vencidasValor: number;
    vencidasQtd: number;
    aVencer7Valor: number;
    aVencer7Qtd: number;
  };
}

export const obterContasAVencer = (hoje?: string) =>
  req<ContasAVencerDTO>(`/vencimentos${hoje ? `?hoje=${hoje}` : ""}`);

// Marca uma conta a vencer como paga (LIQUIDADO). `data` opcional (default no
// server = agora); o card passa HOJE pra casar a âncora do app. Erros (404/409/
// mês fechado 423) chegam como Error via `req` (mensagem PT).
export const liquidarConta = (id: number, data?: string) =>
  req<{ ok: true; id: number; dataLiquidacao: string }>(`/vencimentos/${id}/liquidar`, {
    method: "POST",
    body: JSON.stringify(data ? { data } : {}),
  });

export function useContasAVencer(hoje?: string) {
  const [data, setData] = useState<ContasAVencerDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setLoading(true); setErro(null);
    obterContasAVencer(hoje).then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [hoje]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

// ─── Criação de lançamento (POST /api/lancamentos) ───────────────────────

export async function criarLancamento(input: NovoLancamentoInput): Promise<ResultadoCriarLancamento> {
  try {
    // pendenteId é `.optional()` no server (não aceita null): só manda se houver
    // NF anexada; caso contrário o campo simplesmente não vai no corpo.
    const { pendenteId, ...resto } = input;
    const payload = pendenteId != null ? { ...resto, pendenteId } : resto;
    const res = await fetch("/api/lancamentos", {
      method: "POST",
      headers: comPropriedade({ "content-type": "application/json" }),
      body: JSON.stringify(payload),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      let erro = json.erro || `Falha ao registrar (HTTP ${res.status})`;
      // ZodError do zValidator vem como {error:{issues:[...]}}
      if (!json.erro && json.error?.issues?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        erro = json.error.issues.map((i: any) => i.message).join("; ");
      }
      return { ok: false, status: res.status, erro, codigo: json.codigo };
    }
    return { ok: true, lancamentoId: json.lancamentoId, arquivoId: json.arquivoId };
  } catch (e: unknown) {
    return { ok: false, status: 0, erro: e instanceof Error ? e.message : "Falha de rede" };
  }
}

// ─── Listagem de lançamentos (GET /api/lancamentos) ──────────────────────
// Espelha server/src/services/lancamentos-list.ts — não inventar campos.
// Data de caixa = dataLiquidacao ?? dataCompetencia (regime de caixa).

export type NaturezaLancamento = "DEBITO" | "CREDITO";
export type SituacaoLancamento = "ABERTO" | "LIQUIDADO" | "LIQUIDADO_PARCIAL";

export interface LancamentoLinhaDTO {
  id: number;
  data: string; // YYYY-MM-DD (data de caixa)
  dataVencimento: string; // YYYY-MM-DD
  natureza: NaturezaLancamento;
  valor: number; // sempre positivo — sinal vem da natureza
  situacao: SituacaoLancamento;
  categoriaNome: string;
  grupoNome?: string;
  fornecedorNome: string | null;
  descricao: string | null;
  temNota: boolean;
}

export interface ListaLancamentos {
  itens: LancamentoLinhaDTO[];
  total: number;
  temMais: boolean;
}

export interface FiltrosLancamentos {
  from?: string; // YYYY-MM-DD (data de caixa)
  to?: string; // YYYY-MM-DD
  natureza?: NaturezaLancamento;
  situacao?: SituacaoLancamento;
  categoriaId?: number;
  q?: string;
  limit?: number;
  offset?: number;
}

export function listarLancamentos(f: FiltrosLancamentos = {}): Promise<ListaLancamentos> {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.natureza) p.set("natureza", f.natureza);
  if (f.situacao) p.set("situacao", f.situacao);
  if (f.categoriaId != null) p.set("categoriaId", String(f.categoriaId));
  if (f.q && f.q.trim()) p.set("q", f.q.trim());
  if (f.limit != null) p.set("limit", String(f.limit));
  if (f.offset != null) p.set("offset", String(f.offset));
  const qs = p.toString();
  return req<ListaLancamentos>(`/lancamentos${qs ? `?${qs}` : ""}`);
}

export function useLancamentos(f: FiltrosLancamentos) {
  const [data, setData] = useState<ListaLancamentos | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Desestrutura para dependências estáveis (evita refetch por identidade do objeto).
  const { from, to, natureza, situacao, categoriaId, q, limit, offset } = f;
  const recarregar = useCallback(() => {
    setLoading(true);
    setErro(null);
    listarLancamentos({ from, to, natureza, situacao, categoriaId, q, limit, offset })
      .then(setData)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [from, to, natureza, situacao, categoriaId, q, limit, offset]);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { data, loading, erro, recarregar };
}
