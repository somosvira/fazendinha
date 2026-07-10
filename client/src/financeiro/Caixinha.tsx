/* Caixinha — diário de gastos do dia a dia (fundo fixo em dinheiro).
 * View única: mini dashboard do mês (saldo · gastos+contagem · média · maior
 * gasto + quebra por categoria via lib/caixinhaResumo), filtro de mês e extrato
 * (razão) com registro/exclusão. Registro de gasto é o caminho principal
 * (categoria via Select shadcn); entrada/aporte é o secundário. Moeda via fmtMoneyExact.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { HOJE } from "./HOJE";
import { resumirMes, CATEGORIAS, CATEGORIA_LABEL } from "./lib/caixinhaResumo";

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
      <div className="rb-eyebrow">Financeiro</div>
      <div className="rb-head"><h1>Caixinha</h1></div>

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar caixinhas: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : !ativa ? (
        <div className="rb-empty">
          <p style={{ marginTop: 0 }}>Nenhuma caixinha cadastrada ainda.</p>
          <button className="rb-btn pri" onClick={() => setFormCaixinha(true)}>Criar caixinha</button>
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

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
        <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="lab">Saldo atual{caixinha.responsavel ? ` · ${caixinha.responsavel}` : ""}</div>
          <div className="val" style={{ fontSize: 26, color: "var(--cafe)" }}>{fmtMoneyExact(caixinha.saldoAtual)}</div>
        </div>
        <div className="rb-k">
          <div className="lab">Gastos do mês · {resumo.qtdGastos} {resumo.qtdGastos === 1 ? "item" : "itens"}</div>
          <div className="val" style={{ color: "var(--neg)" }}>{fmtMoneyExact(-resumo.totalGasto)}</div>
        </div>
        <div className="rb-k">
          <div className="lab">Média por item</div>
          <div className="val">{fmtMoneyExact(resumo.mediaGasto)}</div>
        </div>
        <div className="rb-k">
          <div className="lab">Maior gasto</div>
          {resumo.maiorGasto ? (
            <>
              <div className="val" style={{ color: "var(--neg)" }}>{fmtMoneyExact(-resumo.maiorGasto.valor)}</div>
              <div className="rb-anm" style={{ fontSize: 12, color: "var(--ink-3)" }} title={resumo.maiorGasto.descricao}>
                {resumo.maiorGasto.descricao}
              </div>
            </>
          ) : (
            <div className="val" style={{ color: "var(--ink-3)" }}>—</div>
          )}
        </div>
      </div>

      <CategoriaBreakdown resumo={resumo} />

      <div className="rb-toolbar" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="rb-fld" style={{ margin: 0 }}>
          <label>Mês</label>
          <input type="month" value={mes} max={MES_ATUAL} onChange={(e) => setMes(e.target.value || MES_ATUAL)} />
        </div>
        <div style={{ flex: 1 }} />
        <button className="rb-btn pri" onClick={() => setForm(true)}>+ Registrar</button>
      </div>

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar o extrato: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : movimentos.length === 0 ? (
        <div className="rb-empty">Nenhum movimento neste mês.</div>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th style={{ textAlign: "right" }}>Valor</th><th /></tr></thead>
          <tbody>
            {movimentos.map((m) => (
              <tr key={m.id}>
                <td>{dataBR(m.data)}</td>
                <td><span className={"rb-pill" + (m.tipo === "SAIDA" ? " bad" : "")}>{TIPO_LABEL[m.tipo]}</span></td>
                <td>{m.tipo === "SAIDA" ? <span className="cx-cat-tag">{CATEGORIA_LABEL[m.categoria ?? "OUTROS"]}</span> : <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
                <td className="rb-anm" title={m.observacao ?? undefined}>{m.descricao}</td>
                <td style={{ textAlign: "right", color: m.tipo === "SAIDA" ? "var(--neg)" : "var(--pos)" }}>
                  {fmtMoneyExact(m.tipo === "SAIDA" ? -m.valor : m.valor)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="rb-btn" disabled={excluindoId === m.id} onClick={() => excluir(m.id)}>
                    {excluindoId === m.id ? "…" : "Excluir"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
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
function CategoriaBreakdown({ resumo }: { resumo: ReturnType<typeof resumirMes> }) {
  const max = resumo.porCategoria[0]?.total ?? 0;
  return (
    <div className="cx-cat-card">
      <div className="cx-cat-head">
        <span>Gastos por categoria</span>
        <span className="cx-cat-entradas">Entradas do mês: {fmtMoneyExact(resumo.totalEntradas)}</span>
      </div>
      {resumo.porCategoria.length === 0 ? (
        <div className="cx-cat-empty">Nenhum gasto neste mês.</div>
      ) : (
        <ul className="cx-cat-list">
          {resumo.porCategoria.map((c) => (
            <li key={c.categoria} className="cx-cat-row">
              <span className="cx-cat-name">{CATEGORIA_LABEL[c.categoria]}</span>
              <span className="cx-cat-bar-wrap">
                <span className="cx-cat-bar" style={{ width: `${max > 0 ? (c.total / max) * 100 : 0}%` }} />
              </span>
              <span className="cx-cat-val">{fmtMoneyExact(c.total)}</span>
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
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>Criar caixinha</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div className="rb-fld">
            <label>Nome*</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Caixinha do escritório" />
          </div>
          <div className="rb-fld">
            <label>Responsável</label>
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem guarda o dinheiro" />
          </div>
        </div>
        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !nome.trim()} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </aside>
    </>
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
      toast.success(ehGasto ? "Gasto registrado" : "Entrada registrada", "O saldo da caixinha foi atualizado.");
      onSalvo();
    } catch (e: unknown) {
      // ex.: 409 — mês fechado contabilmente
      toast.error("Não foi possível lançar", e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  const valido = Number(valor) > 0 && descricao.trim().length > 0 && !!data;

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>{ehGasto ? "Registrar gasto" : "Registrar entrada"}</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          {/* Toggle Gasto/Entrada — registro de gasto é o caminho principal (default). */}
          <div className="rb-fld">
            <label>O que é?*</label>
            <div className="cx-toggle" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={ehGasto}
                className={"cx-toggle-btn" + (ehGasto ? " on" : "")}
                onClick={() => setTipo("SAIDA")}
              >
                Gasto
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!ehGasto}
                className={"cx-toggle-btn" + (!ehGasto ? " on" : "")}
                onClick={() => setTipo("ENTRADA")}
              >
                Entrada (aporte)
              </button>
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
                    <SelectItem key={cat} value={cat}>
                      {CATEGORIA_LABEL[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
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
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={ehGasto ? "Ex.: gasolina do trator, pão no mercado" : "Ex.: reforço de caixa"} />
          </div>
          <div className="rb-fld">
            <label>Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !valido} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </aside>
    </>
  );
}
