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
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebModal } from "@/components/rb/RebModal";
import { RebField } from "@/components/rb/RebField";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyN = (n: number | null) => (n == null ? "—" : money(n));
const ha = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha`);

// Reproduz .rb-k para células custom (borda colorida / fonte custom).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

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
      <RebHeader eyebrow="Cultivo · milho" title="Safras" />

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <RebButton aria-pressed={filtroFechada === "false"} onClick={() => setFiltroFechada("false")}>Abertas</RebButton>
          <RebButton aria-pressed={filtroFechada === "true"} onClick={() => setFiltroFechada("true")}>Fechadas</RebButton>
          <RebButton aria-pressed={filtroFechada === ""} onClick={() => setFiltroFechada("")}>Todas</RebButton>
        </div>
        <RebButton variant="pri" style={{ marginLeft: "auto" }} onClick={() => setFormNova(true)}>+ Nova safra</RebButton>
      </div>

      {erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar safras: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : data.length === 0 ? (
        <div className="rb-empty">Nenhuma safra de milho cadastrada ainda.</div>
      ) : (
        <RebTable>
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
        </RebTable>
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
        <RebHeader eyebrow="Cultivo · milho" title="Safra" actions={<RebButton onClick={onVoltar}>← Safras</RebButton>} />
        {erro ? <p className="text-sm text-prejuizo">Erro: {erro}</p> : <Loader />}
      </main>
    );
  }

  return (
    <main className="rb-main">
      <RebHeader eyebrow={`Cultivo · milho · ${safra.ano}`} title={safra.nome} actions={<RebButton onClick={onVoltar}>← Safras</RebButton>} />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <span className={"rb-pill" + (safra.fechada ? " bad" : "")}>{safra.fechada ? "fechada" : "aberta"}</span>
        <ClasseToggle value={classe} onChange={setClasse} />
        <RebButton style={{ marginLeft: "auto" }} onClick={() => setFormEditar(true)}>Editar</RebButton>
        <RebButton onClick={() => onNavMil("custos")}>Ver custos</RebButton>
        <RebButton onClick={() => onNavMil("producao")}>Ver produção</RebButton>
        <RebButton disabled={processando} onClick={alternarFechamento}>
          {processando ? "Processando…" : safra.fechada ? "Reabrir safra" : "Fechar safra"}
        </RebButton>
      </div>
      {erroAcao && <p className="text-[13px] text-prejuizo">{erroAcao}</p>}

      <RebKpiStrip cols={4}>
        <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className={RB_K_LAB}>Total ({classe})</div>
          <div className={RB_K_VAL} style={{ fontSize: 26, color: "var(--cafe)" }}>{resumo ? money(resumo.total) : "—"}</div>
          <div className={RB_K_D}>{safra.areaHaTotal ? ha(safra.areaHaTotal) : "área não informada"}</div>
        </div>
        <RebKpi lab="Custo / ha" val={resumo ? moneyN(resumo.custoHa) : "—"} />
        <RebKpi lab="Custo / saca" val={resumo ? moneyN(resumo.custoSaca) : "—"} />
        <RebKpi lab="Custo / tonelada" val={resumo ? moneyN(resumo.custoTonelada) : "—"} />
      </RebKpiStrip>
      {resumo?.nota && <p className="text-sm text-ink-3">{resumo.nota}</p>}

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="m-0 font-serif text-xl font-medium">Áreas</h2>
        <RebButton variant="pri" onClick={() => setFormArea(true)}>+ Nova área</RebButton>
      </div>

      {loadingAreas ? (
        <Loader label="Carregando áreas…" />
      ) : areas.length === 0 ? (
        <div className="rb-empty">Nenhuma área cadastrada para esta safra ainda.</div>
      ) : (
        <RebTable>
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
        </RebTable>
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
    <RebModal
      title={modo === "novo" ? "Nova safra" : `Editar ${s?.nome}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !nome || !ano || !dataInicio} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Nome*" style={{ flex: 2 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Milho safrinha 2026" />
        </RebField>
        <RebField label="Ano*" style={{ flex: 1 }}>
          <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
        </RebField>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Início*" style={{ flex: 1 }}>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} max={HOJE} />
        </RebField>
        <RebField label="Fim (previsto)" style={{ flex: 1 }}>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </RebField>
        <RebField label="Área total (ha)" style={{ flex: 1 }}>
          <input type="number" step="0.1" value={areaHaTotal} onChange={(e) => setAreaHaTotal(e.target.value)} />
        </RebField>
      </div>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
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
    <RebModal
      title="Nova área"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !codigo || !areaHa} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Código*" style={{ flex: 1 }}>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: A1" />
        </RebField>
        <RebField label="Nome" style={{ flex: 2 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Talhão da represa" />
        </RebField>
        <RebField label="Área (ha)*" style={{ flex: 1 }}>
          <input type="number" step="0.1" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
        </RebField>
      </div>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
