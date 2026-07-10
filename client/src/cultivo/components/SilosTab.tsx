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
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebModal } from "@/components/rb/RebModal";
import { RebField } from "@/components/rb/RebField";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Reproduz .rb-k para células custom (borda colorida / fonte custom).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]";

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
      <RebHeader eyebrow="Cultivo · milho" title="Silos" />

      <div className="rb-toolbar" style={{ display: "flex", justifyContent: "flex-end" }}>
        <RebButton variant="pri" onClick={() => setForm(true)}>+ Novo silo</RebButton>
      </div>

      {erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar silos: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : data.length === 0 ? (
        <div className="rb-empty">Nenhum silo cadastrado ainda.</div>
      ) : (
        <RebTable>
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
        </RebTable>
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
      <RebHeader eyebrow="Cultivo · milho · silos" title={silo.nome} actions={<RebButton onClick={onVoltar}>← Silos</RebButton>} />

      <RebKpiStrip cols={2}>
        <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className={RB_K_LAB}>Saldo atual</div>
          <div className={RB_K_VAL} style={{ fontSize: 26, color: "var(--cafe)" }}>{qtd(silo.saldoAtual)} {silo.unidade}</div>
        </div>
        <RebKpi lab="Capacidade" val={silo.capacidade != null ? `${qtd(silo.capacidade)} ${silo.unidade}` : "—"} />
      </RebKpiStrip>

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="m-0 font-serif text-xl font-medium">Movimentos</h2>
        <RebButton variant="pri" onClick={() => setForm(true)}>+ Lançar saída</RebButton>
      </div>

      {erro ? (
        <p className="text-sm text-prejuizo">Erro: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : movimentos.length === 0 ? (
        <div className="rb-empty">Nenhum movimento registrado ainda.</div>
      ) : (
        <RebTable>
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
                    <RebButton disabled={excluindoId === m.id} onClick={() => excluir(m.id)}>
                      {excluindoId === m.id ? "…" : "Excluir"}
                    </RebButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </RebTable>
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
    <RebModal
      title="Novo silo"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !nome} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <RebField label="Nome*">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Silo bolsa 1" />
      </RebField>
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Tipo*" style={{ flex: 1 }}>
          <select className="rb-field-select" value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoSilo)}>
            <option value="GRAO">Grão</option>
            <option value="SILAGEM">Silagem</option>
          </select>
        </RebField>
        <RebField label="Unidade*" style={{ flex: 1 }}>
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="sc / ton" />
        </RebField>
        <RebField label="Capacidade" style={{ flex: 1 }}>
          <input type="number" step="0.1" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} />
        </RebField>
      </div>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
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
    <RebModal
      title="Lançar saída"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !quantidade} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Data*" style={{ flex: 1 }}>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
        </RebField>
        <RebField label="Origem*" style={{ flex: 1 }}>
          <select className="rb-field-select" value={origem} onChange={(e) => setOrigem(e.target.value as OrigemMovimentoSilo)}>
            {ORIGENS_MANUAIS.map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o]}</option>)}
          </select>
        </RebField>
        <RebField label="Quantidade*" style={{ flex: 1 }}>
          <input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </RebField>
      </div>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
