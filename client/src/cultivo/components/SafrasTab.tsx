import { useState } from "react";
import { Loader } from "../../components/Loading";
import {
  useSafrasCultivo,
  useSafraCultivo,
  useAreasCultivo,
  useResumoSafraCultivo,
  criarSafraCultivo,
  editarSafraCultivo,
  fecharSafraCultivo,
  reabrirSafraCultivo,
  criarAreaCultivo,
  type SafraCultivoInput,
  type AreaCultivoInput,
} from "../api";
import type { MilSub } from "../CultivoContent";
import { ClasseToggle, type Classe } from "../../components/ClasseToggle";
import { HOJE } from "../HOJE";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyN = (n: number | null) => (n == null ? "—" : money(n));
const ha = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha`);

/* Lista + cadastro de SafraCultivo. Selecionar uma linha abre o detalhe
 * (áreas + resumo) inline — sem cockpit modal, espelha o padrão simples que
 * o módulo Cultivo pede (unidade é a safra, não um cockpit dedicado). */
export function SafrasTab({ onNavMil }: { onNavMil: (s: MilSub) => void }) {
  const [filtroFechada, setFiltroFechada] = useState<"" | "false" | "true">("false");
  const { data, loading, erro, recarregar } = useSafrasCultivo(
    filtroFechada === "" ? undefined : { fechada: filtroFechada === "true" },
  );
  const [safraId, setSafraId] = useState<number | null>(null);
  const [formNova, setFormNova] = useState(false);

  if (safraId != null) {
    return (
      <SafraDetalhe
        safraId={safraId}
        onVoltar={() => { setSafraId(null); recarregar(); }}
        onNavMil={onNavMil}
      />
    );
  }

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Cultivo · milho</div>
      <div className="rb-head"><h1>Safras</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
          <button className="rb-btn" aria-pressed={filtroFechada === "false"} onClick={() => setFiltroFechada("false")}>Abertas</button>
          <button className="rb-btn" aria-pressed={filtroFechada === "true"} onClick={() => setFiltroFechada("true")}>Fechadas</button>
          <button className="rb-btn" aria-pressed={filtroFechada === ""} onClick={() => setFiltroFechada("")}>Todas</button>
        </div>
        <button className="rb-btn pri" style={{ marginLeft: "auto" }} onClick={() => setFormNova(true)}>+ Nova safra</button>
      </div>

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar safras: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : data.length === 0 ? (
        <div className="rb-empty">Nenhuma safra de milho cadastrada ainda.</div>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead>
            <tr>
              <th>Safra</th><th>Ano</th><th>Área total</th><th>Custeio</th><th>Custo/ha</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="rb-row" onClick={() => setSafraId(s.id)}>
                <td className="rb-anm">{s.nome}</td>
                <td>{s.ano}</td>
                <td>{ha(s.areaHaTotal)}</td>
                <td>{s.resumo ? moneyN(s.resumo.custeioTotal) : "—"}</td>
                <td>{s.resumo ? moneyN(s.resumo.custoHa) : "—"}</td>
                <td><span className={"rb-pill" + (s.fechada ? " bad" : "")}>{s.fechada ? "fechada" : "aberta"}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {formNova && (
        <SafraForm
          modo="novo"
          onFechar={() => setFormNova(false)}
          onSalvo={() => { setFormNova(false); recarregar(); }}
        />
      )}
    </main>
  );
}

function SafraDetalhe({ safraId, onVoltar, onNavMil }: { safraId: number; onVoltar: () => void; onNavMil: (s: MilSub) => void }) {
  const { data: safra, loading, erro, recarregar } = useSafraCultivo(safraId);
  const { data: areas, loading: loadingAreas, recarregar: recarregarAreas } = useAreasCultivo(safraId);
  const [classe, setClasse] = useState<Classe>("custeio");
  const { data: resumo } = useResumoSafraCultivo(safraId, classe);
  const [formArea, setFormArea] = useState(false);
  const [formEditar, setFormEditar] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function alternarFechamento() {
    if (!safra) return;
    setProcessando(true); setErroAcao(null);
    try {
      if (safra.fechada) await reabrirSafraCultivo(safra.id);
      else await fecharSafraCultivo(safra.id);
      recarregar();
    } catch (e: any) {
      setErroAcao(e.message);
    } finally {
      setProcessando(false);
    }
  }

  if (loading || !safra) {
    return (
      <main className="rb-main">
        <div className="rb-eyebrow">Cultivo · milho</div>
        <div className="rb-head">
          <h1>Safra</h1>
          <button className="rb-btn" onClick={onVoltar}>← Safras</button>
        </div>
        {erro ? <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p> : <Loader />}
      </main>
    );
  }

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Cultivo · milho · {safra.ano}</div>
      <div className="rb-head">
        <h1>{safra.nome}</h1>
        <button className="rb-btn" onClick={onVoltar}>← Safras</button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <span className={"rb-pill" + (safra.fechada ? " bad" : "")}>{safra.fechada ? "fechada" : "aberta"}</span>
        <ClasseToggle value={classe} onChange={setClasse} />
        <button className="rb-btn" style={{ marginLeft: "auto" }} onClick={() => setFormEditar(true)}>Editar</button>
        <button className="rb-btn" onClick={() => onNavMil("custos")}>Ver custos</button>
        <button className="rb-btn" onClick={() => onNavMil("producao")}>Ver produção</button>
        <button className="rb-btn" disabled={processando} onClick={alternarFechamento}>
          {processando ? "Processando…" : safra.fechada ? "Reabrir safra" : "Fechar safra"}
        </button>
      </div>
      {erroAcao && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erroAcao}</p>}

      <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
        <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="lab">Total ({classe})</div>
          <div className="val" style={{ fontSize: 26, color: "var(--cafe)" }}>{resumo ? money(resumo.total) : "—"}</div>
          <div className="d">{safra.areaHaTotal ? ha(safra.areaHaTotal) : "área não informada"}</div>
        </div>
        <div className="rb-k">
          <div className="lab">Custo / ha</div>
          <div className="val">{resumo ? moneyN(resumo.custoHa) : "—"}</div>
        </div>
        <div className="rb-k">
          <div className="lab">Custo / saca</div>
          <div className="val">{resumo ? moneyN(resumo.custoSaca) : "—"}</div>
        </div>
        <div className="rb-k">
          <div className="lab">Custo / tonelada</div>
          <div className="val">{resumo ? moneyN(resumo.custoTonelada) : "—"}</div>
        </div>
      </div>
      {resumo?.nota && <p className="rb-sub">{resumo.nota}</p>}

      <div className="rb-listhead">
        <h2 className="rb-sec-title" style={{ margin: 0 }}>Áreas</h2>
        <button className="rb-btn pri" onClick={() => setFormArea(true)}>+ Nova área</button>
      </div>

      {loadingAreas ? (
        <Loader label="Carregando áreas…" />
      ) : areas.length === 0 ? (
        <div className="rb-empty">Nenhuma área cadastrada para esta safra ainda.</div>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Código</th><th>Nome</th><th>Área</th></tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.id}>
                <td className="rb-anm">{a.codigo}</td>
                <td>{a.nome ?? "—"}</td>
                <td>{ha(a.areaHa)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {formArea && (
        <AreaForm
          safraCultivoId={safra.id}
          onFechar={() => setFormArea(false)}
          onSalvo={() => { setFormArea(false); recarregarAreas(); }}
        />
      )}

      {formEditar && (
        <SafraForm
          modo="editar"
          safra={safra}
          onFechar={() => setFormEditar(false)}
          onSalvo={() => { setFormEditar(false); recarregar(); }}
        />
      )}
    </main>
  );
}

function SafraForm({ modo, safra, onFechar, onSalvo }: {
  modo: "novo" | "editar";
  safra?: { id: number; nome: string; ano: number; dataInicio: string; dataFim: string | null; areaHaTotal: number | null; observacao: string | null };
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const s = safra;
  const [nome, setNome] = useState(s?.nome ?? "");
  const [ano, setAno] = useState<string>(String(s?.ano ?? new Date().getFullYear()));
  const [dataInicio, setDataInicio] = useState<string>(s?.dataInicio ?? HOJE);
  const [dataFim, setDataFim] = useState<string>(s?.dataFim ?? "");
  const [areaHaTotal, setAreaHaTotal] = useState<string>(s?.areaHaTotal != null ? String(s.areaHaTotal) : "");
  const [observacao, setObservacao] = useState<string>(s?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: SafraCultivoInput = {
        cultura: "MILHO",
        nome,
        ano: Number(ano),
        dataInicio: dataInicio || HOJE,
        // Opcionais: só entram no payload quando preenchidos.
        dataFim: dataFim || undefined,
        areaHaTotal: areaHaTotal ? Number(areaHaTotal) : undefined,
        observacao: observacao || undefined,
      };
      if (modo === "novo") await criarSafraCultivo(payload);
      else if (s) await editarSafraCultivo(s.id, payload);
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
          <h3>{modo === "novo" ? "Nova safra" : `Editar ${s?.nome}`}</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 2 }}>
              <label>Nome*</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Milho safrinha 2026" />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Ano*</label>
              <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Início*</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} max={HOJE} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Fim (previsto)</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Área total (ha)</label>
              <input type="number" step="0.1" value={areaHaTotal} onChange={(e) => setAreaHaTotal(e.target.value)} />
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
          <button className="rb-btn pri" disabled={salvando || !nome || !ano || !dataInicio} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}

function AreaForm({ safraCultivoId, onFechar, onSalvo }: { safraCultivoId: number; onFechar: () => void; onSalvo: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: AreaCultivoInput = {
        safraCultivoId,
        codigo,
        nome: nome || undefined,
        areaHa: Number(areaHa),
      };
      await criarAreaCultivo(payload);
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
          <h3>Nova área</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Código*</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: A1" />
            </div>
            <div className="rb-fld" style={{ flex: 2 }}>
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Talhão da represa" />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Área (ha)*</label>
              <input type="number" step="0.1" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
            </div>
          </div>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !codigo || !areaHa} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
