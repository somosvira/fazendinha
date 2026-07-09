import { useState } from "react";
import { Loader } from "../../components/Loading";
import {
  useSilos,
  useMovimentosSilo,
  criarSilo,
  criarMovimentoSilo,
  excluirMovimentoSilo,
  type SiloInput,
  type MovimentoSiloInput,
} from "../api";
import type { TipoSilo, TipoMovimentoSilo, OrigemMovimentoSilo } from "../types";
import { HOJE } from "../HOJE";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const TIPO_LABEL: Record<TipoSilo, string> = { GRAO: "Grão", SILAGEM: "Silagem" };
const ORIGEM_LABEL: Record<OrigemMovimentoSilo, string> = {
  COLHEITA: "Colheita",
  NUTRICAO: "Nutrição",
  VENDA: "Venda",
  AJUSTE: "Ajuste",
};
// Movimentos manuais aceitos pelo backend — ENTRADA/COLHEITA é automática (produção).
const ORIGENS_MANUAIS: OrigemMovimentoSilo[] = ["NUTRICAO", "VENDA", "AJUSTE"];

/* Silos (saldo + tipo) e razão de movimentos — selecionar um silo abre o
 * extrato (MovimentoSilo) com opção de lançar saída manual (nutrição, venda
 * ou ajuste; entradas de colheita vêm automaticamente da ProducaoTab). */
export function SilosTab() {
  const { data, loading, erro, recarregar } = useSilos();
  const [siloId, setSiloId] = useState<number | null>(null);
  const [form, setForm] = useState(false);

  if (siloId != null) {
    const silo = data.find((s) => s.id === siloId);
    if (!silo) { setSiloId(null); return null; }
    return <SiloDetalhe silo={silo} onVoltar={() => { setSiloId(null); recarregar(); }} />;
  }

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Cultivo · milho</div>
      <div className="rb-head"><h1>Silos</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="rb-btn pri" onClick={() => setForm(true)}>+ Novo silo</button>
      </div>

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar silos: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : data.length === 0 ? (
        <div className="rb-empty">Nenhum silo cadastrado ainda.</div>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Saldo</th><th>Capacidade</th><th>Status</th></tr></thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="rb-row" onClick={() => setSiloId(s.id)}>
                <td className="rb-anm">{s.nome}</td>
                <td>{TIPO_LABEL[s.tipo]}</td>
                <td>{qtd(s.saldoAtual)} {s.unidade}</td>
                <td>{s.capacidade != null ? `${qtd(s.capacidade)} ${s.unidade}` : "—"}</td>
                <td><span className={"rb-pill" + (s.ativo ? "" : " bad")}>{s.ativo ? "ativo" : "inativo"}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {form && (
        <SiloForm onFechar={() => setForm(false)} onSalvo={() => { setForm(false); recarregar(); }} />
      )}
    </main>
  );
}

function SiloDetalhe({ silo, onVoltar }: { silo: { id: number; nome: string; tipo: TipoSilo; unidade: string; saldoAtual: number; capacidade: number | null }; onVoltar: () => void }) {
  const { data: movimentos, loading, erro, recarregar } = useMovimentosSilo(silo.id);
  const [form, setForm] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  async function excluir(movimentoId: number) {
    setExcluindoId(movimentoId);
    try {
      await excluirMovimentoSilo(silo.id, movimentoId);
      recarregar();
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Cultivo · milho · silos</div>
      <div className="rb-head">
        <h1>{silo.nome}</h1>
        <button className="rb-btn" onClick={onVoltar}>← Silos</button>
      </div>

      <div className="rb-kstrip" style={{ ["--cols" as any]: 2 }}>
        <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="lab">Saldo atual</div>
          <div className="val" style={{ fontSize: 26, color: "var(--cafe)" }}>{qtd(silo.saldoAtual)} {silo.unidade}</div>
        </div>
        <div className="rb-k">
          <div className="lab">Capacidade</div>
          <div className="val">{silo.capacidade != null ? `${qtd(silo.capacidade)} ${silo.unidade}` : "—"}</div>
        </div>
      </div>

      <div className="rb-listhead">
        <h2 className="rb-sec-title" style={{ margin: 0 }}>Movimentos</h2>
        <button className="rb-btn pri" onClick={() => setForm(true)}>+ Lançar saída</button>
      </div>

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : movimentos.length === 0 ? (
        <div className="rb-empty">Nenhum movimento registrado ainda.</div>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Data</th><th>Tipo</th><th>Origem</th><th>Quantidade</th><th /></tr></thead>
          <tbody>
            {movimentos.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.data).toLocaleDateString("pt-BR")}</td>
                <td className="rb-anm">{m.tipo === "ENTRADA" ? "Entrada" : "Saída"}</td>
                <td>{ORIGEM_LABEL[m.origem]}</td>
                <td>{qtd(m.quantidade)} {silo.unidade}</td>
                <td>
                  {m.origem !== "COLHEITA" && (
                    <button className="rb-btn" disabled={excluindoId === m.id} onClick={() => excluir(m.id)}>
                      {excluindoId === m.id ? "…" : "Excluir"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {form && (
        <MovimentoSiloForm
          siloId={silo.id}
          onFechar={() => setForm(false)}
          onSalvo={() => { setForm(false); recarregar(); }}
        />
      )}
    </main>
  );
}

function SiloForm({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoSilo>("GRAO");
  const [capacidade, setCapacidade] = useState("");
  const [unidade, setUnidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function mudarTipo(t: TipoSilo) {
    setTipo(t);
    if (!unidade) setUnidade(t === "GRAO" ? "sc" : "ton");
  }

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: SiloInput = {
        nome,
        tipo,
        unidade: unidade || (tipo === "GRAO" ? "sc" : "ton"),
        capacidade: capacidade ? Number(capacidade) : undefined,
      };
      await criarSilo(payload);
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>Novo silo</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div className="rb-fld">
            <label>Nome*</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Silo bolsa 1" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Tipo*</label>
              <select value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoSilo)}>
                <option value="GRAO">Grão</option>
                <option value="SILAGEM">Silagem</option>
              </select>
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Unidade*</label>
              <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="sc / ton" />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Capacidade</label>
              <input type="number" step="0.1" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} />
            </div>
          </div>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !nome} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}

function MovimentoSiloForm({ siloId, onFechar, onSalvo }: { siloId: number; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState<string>(HOJE);
  const [tipo] = useState<TipoMovimentoSilo>("SAIDA");
  const [quantidade, setQuantidade] = useState("");
  const [origem, setOrigem] = useState<OrigemMovimentoSilo>("NUTRICAO");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: MovimentoSiloInput = {
        data: data || HOJE,
        tipo,
        quantidade: Number(quantidade),
        origem,
        observacao: observacao || undefined,
      };
      await criarMovimentoSilo(siloId, payload);
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>Lançar saída</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Data*</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Origem*</label>
              <select value={origem} onChange={(e) => setOrigem(e.target.value as OrigemMovimentoSilo)}>
                {ORIGENS_MANUAIS.map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o]}</option>)}
              </select>
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Quantidade*</label>
              <input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
          </div>

          <div className="rb-fld">
            <label>Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !quantidade} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
