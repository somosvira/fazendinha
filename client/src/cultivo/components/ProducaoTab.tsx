import { useState } from "react";
import {
  useSafrasCultivo,
  useAreasCultivo,
  useProducoesCultivo,
  useSilos,
  criarProducaoCultivo,
  excluirProducaoCultivo,
  type ProducaoCultivoInput,
} from "../api";
import type { TipoProducao, UnidadeProducao, DestinoProducao } from "../types";
import { HOJE } from "../HOJE";
import { ToolbarSelect } from "@/components/ToolbarSelect";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const TIPO_LABEL: Record<TipoProducao, string> = { GRAO: "Grão", SILAGEM: "Silagem" };
const DESTINO_LABEL: Record<DestinoProducao, string> = { VENDA: "Venda", SILO: "Silo" };

// Unidade padrão por tipo de produção — grão sai em sacas (SC), silagem em toneladas (TON).
const UNIDADE_PADRAO: Record<TipoProducao, UnidadeProducao> = { GRAO: "SC", SILAGEM: "TON" };

/* Lista + cadastro de ProducaoCultivo — saída da colheita do milho, seja grão
 * (SC) ou silagem (TON), com destino opcional para venda ou silo. */
export function ProducaoTab() {
  const { data: safras } = useSafrasCultivo();
  const [safraCultivoId, setSafraCultivoId] = useState<number | "">("");
  const { data, loading, erro, recarregar } = useProducoesCultivo({
    safraCultivoId: safraCultivoId === "" ? undefined : safraCultivoId,
  });
  const [form, setForm] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const totalGrao = data.filter((p) => p.tipo === "GRAO").reduce((a, p) => a + p.quantidade, 0);
  const totalSilagem = data.filter((p) => p.tipo === "SILAGEM").reduce((a, p) => a + p.quantidade, 0);

  async function excluir(id: number) {
    setExcluindoId(id);
    try {
      await excluirProducaoCultivo(id);
      recarregar();
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Cultivo · milho</div>
      <div className="rb-head"><h1>Produção</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <ToolbarSelect
          value={String(safraCultivoId)}
          onChange={(v) => setSafraCultivoId(v ? Number(v) : "")}
          ariaLabel="Filtrar por safra"
          options={[
            { value: "", label: "Todas as safras" },
            ...safras.map((s) => ({ value: String(s.id), label: `${s.nome} · ${s.ano}` })),
          ]}
        />
        <button className="rb-btn pri" style={{ marginLeft: "auto" }} disabled={!safraCultivoId} onClick={() => setForm(true)}>
          + Registrar produção
        </button>
      </div>
      {!safraCultivoId && <p className="rb-sub">Selecione uma safra para registrar uma nova produção.</p>}

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar produção: {erro}</p>
      ) : loading ? (
        <p className="rb-sub">Carregando…</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 2 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Grão</div>
              <div className="val" style={{ fontSize: 26, color: "var(--cafe)" }}>{qtd(totalGrao)}<u>sc</u></div>
            </div>
            <div className="rb-k">
              <div className="lab">Silagem</div>
              <div className="val" style={{ fontSize: 26 }}>{qtd(totalSilagem)}<u>ton</u></div>
            </div>
          </div>

          {data.length === 0 ? (
            <div className="rb-empty">Nenhuma produção registrada ainda.</div>
          ) : (
            <div className="rb-tbl-wrap"><table className="rb-tbl">
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Área</th><th>Quantidade</th><th>Destino</th><th>Silo</th><th /></tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                    <td className="rb-anm">{TIPO_LABEL[p.tipo]}</td>
                    <td>{p.areaCodigo ?? "—"}</td>
                    <td>{qtd(p.quantidade)} {p.unidade.toLowerCase()}</td>
                    <td>{p.destino ? DESTINO_LABEL[p.destino] : "—"}</td>
                    <td>{p.siloNome ?? "—"}</td>
                    <td>
                      <button className="rb-btn" disabled={excluindoId === p.id} onClick={() => excluir(p.id)}>
                        {excluindoId === p.id ? "…" : "Excluir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </>
      )}

      {form && safraCultivoId !== "" && (
        <ProducaoForm
          safraCultivoId={safraCultivoId}
          onFechar={() => setForm(false)}
          onSalvo={() => { setForm(false); recarregar(); }}
        />
      )}
    </main>
  );
}

function ProducaoForm({ safraCultivoId, onFechar, onSalvo }: { safraCultivoId: number; onFechar: () => void; onSalvo: () => void }) {
  const { data: areas } = useAreasCultivo(safraCultivoId);
  const [areaCultivoId, setAreaCultivoId] = useState<string>("");
  const [data, setData] = useState<string>(HOJE);
  const [tipo, setTipo] = useState<TipoProducao>("GRAO");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState<UnidadeProducao>(UNIDADE_PADRAO.GRAO);
  const [destino, setDestino] = useState<DestinoProducao | "">("");
  const [siloId, setSiloId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Silos filtrados pelo tipo compatível com a produção sendo lançada.
  const { data: silos } = useSilos({ tipo, ativo: true });

  function mudarTipo(t: TipoProducao) {
    setTipo(t);
    setUnidade(UNIDADE_PADRAO[t]);
    setSiloId("");
  }

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: ProducaoCultivoInput = {
        safraCultivoId,
        data: data || HOJE,
        tipo,
        quantidade: Number(quantidade),
        unidade,
        // Opcionais: só entram no payload quando preenchidos.
        areaCultivoId: areaCultivoId ? Number(areaCultivoId) : undefined,
        destino: destino || undefined,
        siloId: destino === "SILO" && siloId ? Number(siloId) : undefined,
        observacao: observacao || undefined,
      };
      await criarProducaoCultivo(payload);
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
          <h3>Registrar produção</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Data*</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Tipo*</label>
              <select value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoProducao)}>
                <option value="GRAO">Grão (SC)</option>
                <option value="SILAGEM">Silagem (TON)</option>
              </select>
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Área</label>
              <select value={areaCultivoId} onChange={(e) => setAreaCultivoId(e.target.value)}>
                <option value="">—</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Quantidade* ({unidade.toLowerCase()})</label>
              <input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Destino</label>
              <select value={destino} onChange={(e) => setDestino(e.target.value as DestinoProducao | "")}>
                <option value="">—</option>
                <option value="VENDA">Venda</option>
                <option value="SILO">Silo</option>
              </select>
            </div>
            {destino === "SILO" && (
              <div className="rb-fld" style={{ flex: 1 }}>
                <label>Silo</label>
                <select value={siloId} onChange={(e) => setSiloId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {silos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            )}
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
