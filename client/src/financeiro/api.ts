/* Camada de leitura/escrita do módulo Financeiro (form Lançar).
 *
 * Espelha o pattern de client/src/plantio/api.ts: hooks `useXxx()` com o
 * contrato {data, loading, erro, recarregar} e funções de escrita que batem
 * em /api/*. As formas dos DTOs espelham server/src/routes/cadastros.ts,
 * lancamentos.ts e notaFiscal.ts — não inventar campos.
 */

import { useCallback, useEffect, useState } from "react";

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
  pendenteId: number;
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
  | { ok: true; lancamentoId: number; arquivoId: number }
  | { ok: false; status: number; erro: string; codigo?: "PENDENTE_INVALIDA" | "MES_FECHADO" | string };

export async function criarLancamento(input: NovoLancamentoInput): Promise<ResultadoCriarLancamento> {
  try {
    const res = await fetch("/api/lancamentos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
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
