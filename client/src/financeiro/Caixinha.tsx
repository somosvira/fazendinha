/* Caixinha — fundo fixo em dinheiro do financeiro.
 * View única: KPI strip (saldo corrente + entradas/saídas do mês), filtro de
 * mês e extrato (razão) com lançamento/exclusão de movimentos. Reusa o shape
 * razão + saldo de cultivo/SilosTab; moeda via fmtMoneyExact de charts.tsx.
 * Erros do backend (ex.: 409 mês fechado) → useToast. */

import { useMemo, useState } from "react";
import {
  useCaixinhas,
  useMovimentosCaixinha,
  criarCaixinha,
  criarMovimentoCaixinha,
  excluirMovimentoCaixinha,
  type CaixinhaDTO,
  type TipoMovimentoCaixinha,
} from "./api";
import { fmtMoneyExact } from "../components/charts";
import { Loader } from "../components/Loading";
import { useToast } from "../components/Toast";
import { HOJE } from "./HOJE";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebModal } from "@/components/rb/RebModal";

const MES_ATUAL = HOJE.slice(0, 7); // "2026-05"

const TIPO_LABEL: Record<TipoMovimentoCaixinha, string> = { ENTRADA: "Entrada", SAIDA: "Saída" };

// "YYYY-MM-DD" → "dd/mm/aaaa" sem passar por Date (evita shift de fuso).
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export function Caixinha() {
  const { data: caixinhas, loading, erro, recarregar } = useCaixinhas();
  const [caixinhaId, setCaixinhaId] = useState<number | null>(null);
  const [formCaixinha, setFormCaixinha] = useState(false);

  const ativa: CaixinhaDTO | null =
    caixinhas.find((c) => c.id === caixinhaId) ?? caixinhas[0] ?? null;

  return (
    <main className="rb-main">
      <RebHeader eyebrow="Financeiro" title="Caixinha" />

      {erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar caixinhas: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : !ativa ? (
        <div className="rb-empty">
          <p style={{ marginTop: 0 }}>Nenhuma caixinha cadastrada ainda.</p>
          <RebButton variant="pri" onClick={() => setFormCaixinha(true)}>Criar caixinha</RebButton>
        </div>
      ) : (
        <CaixinhaDetalhe
          caixinha={ativa}
          caixinhas={caixinhas}
          onTrocar={setCaixinhaId}
          onSaldoMudou={recarregar}
        />
      )}

      {formCaixinha && (
        <CaixinhaForm
          onFechar={() => setFormCaixinha(false)}
          onSalvo={() => { setFormCaixinha(false); recarregar(); }}
        />
      )}
    </main>
  );
}

function CaixinhaDetalhe({ caixinha, caixinhas, onTrocar, onSaldoMudou }: {
  caixinha: CaixinhaDTO;
  caixinhas: CaixinhaDTO[];
  onTrocar: (id: number) => void;
  onSaldoMudou: () => void;
}) {
  const toast = useToast();
  const [mes, setMes] = useState(MES_ATUAL);
  const { data: movimentos, loading, erro, recarregar } = useMovimentosCaixinha(caixinha.id, mes);
  const [form, setForm] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const { entradasMes, saidasMes } = useMemo(() => {
    let entradas = 0, saidas = 0;
    for (const m of movimentos) {
      if (m.tipo === "ENTRADA") entradas += m.valor;
      else saidas += m.valor;
    }
    return { entradasMes: entradas, saidasMes: saidas };
  }, [movimentos]);

  async function excluir(movimentoId: number) {
    setExcluindoId(movimentoId);
    try {
      await excluirMovimentoCaixinha(caixinha.id, movimentoId);
      toast.success("Movimento excluído", "O saldo da caixinha foi recalculado.");
      recarregar();
      onSaldoMudou();
    } catch (e: unknown) {
      // ex.: 409 — mês fechado contabilmente
      toast.error("Não foi possível excluir", e instanceof Error ? e.message : String(e));
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <>
      {caixinhas.length > 1 && (
        <div className="rb-fld" style={{ maxWidth: 320, marginBottom: 12 }}>
          <label>Caixinha</label>
          <select value={caixinha.id} onChange={(e) => onTrocar(Number(e.target.value))}>
            {caixinhas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativa)"}</option>
            ))}
          </select>
        </div>
      )}

      <RebKpiStrip cols={3}>
        <div className="relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">Saldo atual{caixinha.responsavel ? ` · ${caixinha.responsavel}` : ""}</div>
          <div className="mt-1.5 font-serif text-[26px] font-medium leading-none text-cafe">{fmtMoneyExact(caixinha.saldoAtual)}</div>
        </div>
        <div className="relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5">
          <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">Entradas do mês</div>
          <div className="mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--pos)]">{fmtMoneyExact(entradasMes)}</div>
        </div>
        <div className="relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5">
          <div className="text-sm font-semibold uppercase tracking-[.06em] text-ink-2">Saídas do mês</div>
          <div className="mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--neg)]">{fmtMoneyExact(-saidasMes)}</div>
        </div>
      </RebKpiStrip>

      <div className="rb-toolbar" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="rb-fld" style={{ margin: 0 }}>
          <label>Mês</label>
          <input type="month" value={mes} max={MES_ATUAL} onChange={(e) => setMes(e.target.value || MES_ATUAL)} />
        </div>
        <div style={{ flex: 1 }} />
        <RebButton variant="pri" onClick={() => setForm(true)}>+ Lançar</RebButton>
      </div>

      {erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar o extrato: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : movimentos.length === 0 ? (
        <div className="rb-empty">Nenhum movimento neste mês.</div>
      ) : (
        <RebTable>
          <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style={{ textAlign: "right" }}>Valor</th><th /></tr></thead>
          <tbody>
            {movimentos.map((m) => (
              <tr key={m.id}>
                <td>{dataBR(m.data)}</td>
                <td><span className={"rb-pill" + (m.tipo === "SAIDA" ? " bad" : "")}>{TIPO_LABEL[m.tipo]}</span></td>
                <td className="rb-anm" title={m.observacao ?? undefined}>{m.descricao}</td>
                <td style={{ textAlign: "right", color: m.tipo === "SAIDA" ? "var(--neg)" : "var(--pos)" }}>
                  {fmtMoneyExact(m.tipo === "SAIDA" ? -m.valor : m.valor)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <RebButton disabled={excluindoId === m.id} onClick={() => excluir(m.id)}>
                    {excluindoId === m.id ? "…" : "Excluir"}
                  </RebButton>
                </td>
              </tr>
            ))}
          </tbody>
        </RebTable>
      )}

      {form && (
        <MovimentoForm
          caixinhaId={caixinha.id}
          onFechar={() => setForm(false)}
          onSalvo={() => { setForm(false); recarregar(); onSaldoMudou(); }}
        />
      )}
    </>
  );
}

function CaixinhaForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await criarCaixinha({ nome: nome.trim(), responsavel: responsavel.trim() || undefined });
      toast.success("Caixinha criada", `"${nome.trim()}" pronta para receber movimentos.`);
      onSalvo();
    } catch (e: unknown) {
      toast.error("Não foi possível criar a caixinha", e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title="Criar caixinha"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !nome.trim()} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar"}
          </RebButton>
        </>
      }
    >
      <div className="rb-fld">
        <label>Nome*</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Caixinha do escritório" />
      </div>
      <div className="rb-fld">
        <label>Responsável</label>
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem guarda o dinheiro" />
      </div>
    </RebModal>
  );
}

function MovimentoForm({ caixinhaId, onFechar, onSalvo }: {
  caixinhaId: number;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoMovimentoCaixinha>("SAIDA");
  const [data, setData] = useState(HOJE);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await criarMovimentoCaixinha(caixinhaId, {
        data: data || HOJE,
        tipo,
        valor: Number(valor),
        descricao: descricao.trim(),
        observacao: observacao.trim() || undefined,
      });
      toast.success(tipo === "ENTRADA" ? "Entrada lançada" : "Saída lançada", "O saldo da caixinha foi atualizado.");
      onSalvo();
    } catch (e: unknown) {
      // ex.: 409 — mês fechado contabilmente
      toast.error("Não foi possível lançar", e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  const valido = Number(valor) > 0 && descricao.trim().length > 0 && !!data;

  return (
    <RebModal
      title="Lançar movimento"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !valido} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar"}
          </RebButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Tipo*</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentoCaixinha)}>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </div>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Data*</label>
          <input type="date" value={data} max={HOJE} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Valor (R$)*</label>
          <input type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
      </div>
      <div className="rb-fld">
        <label>Descrição*</label>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: compra de material de limpeza" />
      </div>
      <div className="rb-fld">
        <label>Observação</label>
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </div>
    </RebModal>
  );
}
