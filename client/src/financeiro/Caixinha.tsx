/* Caixinha — diário de gastos do dia a dia (fundo fixo em dinheiro).
 * View única: mini dashboard do mês (saldo · gastos+contagem · média · maior
 * gasto + quebra por categoria via lib/caixinhaResumo), filtro de mês e extrato
 * (razão) com lançamento/exclusão. Registro de gasto é o caminho principal
 * (categoria via Select shadcn); entrada/aporte é o secundário. UI em Tailwind
 * sobre os primitivos Reb* (Fase 6). Moeda via fmtMoneyExact de charts.tsx.
 * Erros do backend (ex.: 409 mês fechado) → useToast. */

import { useMemo, useState } from "react";
import {
  useCaixinhas,
  useMovimentosCaixinha,
  criarCaixinha,
  criarMovimentoCaixinha,
  excluirMovimentoCaixinha,
  type CaixinhaDTO,
  type CategoriaCaixinha,
  type TipoMovimentoCaixinha,
} from "./api";
import { fmtMoneyExact } from "../components/charts";
import { Loader } from "../components/Loading";
import { useToast } from "../components/Toast";
import { HOJE } from "./HOJE";
import { resumirMes, CATEGORIAS, CATEGORIA_LABEL, type ResumoMes } from "./lib/caixinhaResumo";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebModal } from "@/components/rb/RebModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MES_ATUAL = HOJE.slice(0, 7); // "2026-05"

const TIPO_LABEL: Record<TipoMovimentoCaixinha, string> = { ENTRADA: "Entrada", SAIDA: "Saída" };

// Célula do KPI strip (paridade com .rb-k migrado — RebKpiStrip): border-left
// rule-soft (exceto a 1ª), padding 6/22/4. lab uppercase; val serif.
const KPI_CELL =
  "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const KPI_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const KPI_VAL = "mt-1.5 font-serif text-[26px] font-medium leading-none";

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

  const resumo = useMemo(() => resumirMes(movimentos), [movimentos]);

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

      <RebKpiStrip cols={4}>
        <div className={KPI_CELL} style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className={KPI_LAB}>Saldo atual{caixinha.responsavel ? ` · ${caixinha.responsavel}` : ""}</div>
          <div className={`${KPI_VAL} text-cafe`}>{fmtMoneyExact(caixinha.saldoAtual)}</div>
        </div>
        <div className={KPI_CELL}>
          <div className={KPI_LAB}>Gastos do mês · {resumo.qtdGastos} {resumo.qtdGastos === 1 ? "item" : "itens"}</div>
          <div className={`${KPI_VAL} text-[color:var(--neg)]`}>{fmtMoneyExact(-resumo.totalGasto)}</div>
        </div>
        <div className={KPI_CELL}>
          <div className={KPI_LAB}>Média por item</div>
          <div className={`${KPI_VAL} text-foreground`}>{fmtMoneyExact(resumo.mediaGasto)}</div>
        </div>
        <div className={KPI_CELL}>
          <div className={KPI_LAB}>Maior gasto</div>
          {resumo.maiorGasto ? (
            <>
              <div className={`${KPI_VAL} text-[color:var(--neg)]`}>{fmtMoneyExact(-resumo.maiorGasto.valor)}</div>
              <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-3" title={resumo.maiorGasto.descricao}>
                {resumo.maiorGasto.descricao}
              </div>
            </>
          ) : (
            <div className={`${KPI_VAL} text-ink-3`}>—</div>
          )}
        </div>
      </RebKpiStrip>

      <CategoriaBreakdown resumo={resumo} />

      <div className="rb-toolbar" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="rb-fld" style={{ margin: 0 }}>
          <label>Mês</label>
          <input type="month" value={mes} max={MES_ATUAL} onChange={(e) => setMes(e.target.value || MES_ATUAL)} />
        </div>
        <div style={{ flex: 1 }} />
        <RebButton variant="pri" onClick={() => setForm(true)}>+ Registrar</RebButton>
      </div>

      {erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar o extrato: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : movimentos.length === 0 ? (
        <div className="rb-empty">Nenhum movimento neste mês.</div>
      ) : (
        <RebTable>
          <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th style={{ textAlign: "right" }}>Valor</th><th /></tr></thead>
          <tbody>
            {movimentos.map((m) => (
              <tr key={m.id}>
                <td>{dataBR(m.data)}</td>
                <td><span className={"rb-pill" + (m.tipo === "SAIDA" ? " bad" : "")}>{TIPO_LABEL[m.tipo]}</span></td>
                <td>
                  {m.tipo === "SAIDA" ? (
                    <span className="inline-block whitespace-nowrap rounded-full bg-[color:var(--leite-soft)] px-2 py-0.5 text-xs font-medium text-cafe">
                      {CATEGORIA_LABEL[m.categoria ?? "OUTROS"]}
                    </span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
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

// Quebra do gasto do mês por categoria — barras horizontais proporcionais ao
// maior total. Traz também as entradas (aportes) do mês como legenda.
function CategoriaBreakdown({ resumo }: { resumo: ResumoMes }) {
  const max = resumo.porCategoria[0]?.total ?? 0;
  return (
    <div className="mb-1 mt-3.5 rounded-[10px] border border-[color:var(--rule)] bg-[color:var(--bg-card)] px-4 py-3.5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-[.08em] text-ink-3">
        <span>Gastos por categoria</span>
        <span className="font-medium normal-case tracking-normal text-[color:var(--pos)]">
          Entradas do mês: {fmtMoneyExact(resumo.totalEntradas)}
        </span>
      </div>
      {resumo.porCategoria.length === 0 ? (
        <div className="text-sm text-ink-3">Nenhum gasto neste mês.</div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {resumo.porCategoria.map((c) => (
            <li
              key={c.categoria}
              className="grid grid-cols-[110px_1fr_auto] items-center gap-2.5 max-[560px]:grid-cols-[90px_1fr_auto]"
            >
              <span className="text-[13px] text-ink-2">{CATEGORIA_LABEL[c.categoria]}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-[color:var(--rule-soft)]">
                <span
                  className="block h-full min-w-[3px] rounded-full bg-[color:var(--cafe)]"
                  style={{ width: `${max > 0 ? (c.total / max) * 100 : 0}%` }}
                />
              </span>
              <span className="whitespace-nowrap text-[13px] tabular-nums text-[color:var(--neg)]">
                {fmtMoneyExact(c.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const [categoria, setCategoria] = useState<CategoriaCaixinha>("OUTROS");
  const [data, setData] = useState(HOJE);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const ehGasto = tipo === "SAIDA";

  async function salvar() {
    setSalvando(true);
    try {
      await criarMovimentoCaixinha(caixinhaId, {
        data: data || HOJE,
        tipo,
        categoria: ehGasto ? categoria : undefined, // backend ignora em ENTRADA
        valor: Number(valor),
        descricao: descricao.trim(),
        observacao: observacao.trim() || undefined,
      });
      toast.success(ehGasto ? "Saída lançada" : "Entrada lançada", "O saldo da caixinha foi atualizado.");
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
            <option value="SAIDA">Saída (gasto)</option>
            <option value="ENTRADA">Entrada (aporte)</option>
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

      {ehGasto && (
        <div className="rb-fld">
          <label>Categoria*</label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaCaixinha)}>
            <SelectTrigger className="w-full" aria-label="Categoria do gasto">
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat} value={cat}>{CATEGORIA_LABEL[cat]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rb-fld">
        <label>Descrição*</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={ehGasto ? "Ex.: gasolina do trator, pão no mercado" : "Ex.: reforço de caixa"}
        />
      </div>
      <div className="rb-fld">
        <label>Observação</label>
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </div>
    </RebModal>
  );
}
