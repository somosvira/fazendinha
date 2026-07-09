import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useTalhao, useEventos } from "../api";
import { idadeAnos, totalPlantas, categoriaIdade } from "../lib/derive";
import { FASES_LABEL } from "../lib/fenologia";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";
import { OperacaoForm } from "./OperacaoForm";

export function TalhaoCockpit({ talhaoId, onVoltar }: { talhaoId: string; onVoltar: () => void }) {
  const { data: t, resumo, loading } = useTalhao(talhaoId);
  const { data: eventos, recarregar } = useEventos(talhaoId);
  const [registrando, setRegistrando] = useState(false);

  if (loading) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Lavoura</button><Loader /></main>;
  if (!t) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Lavoura</button><p>Talhão não encontrado.</p></main>;

  const idade = idadeAnos(t, HOJE);
  const categoria = categoriaIdade(idade);
  const plantas = totalPlantas(t);

  return (
    <main className="rb-main">
      <button className="rb-crumb" onClick={onVoltar}>← <b>Lavoura</b> &nbsp;/&nbsp; Talhão {t.codigo}</button>

      <div className="rb-head">
        <div>
          <h1>{t.nome} <small>· {t.codigo}</small></h1>
          <div className="rb-sub">
            {t.variedade} · {t.areaHa} ha · plantio em {new Date(t.dataPlantio).toLocaleDateString("pt-BR")} ({idade}a · {categoria}){t.altitude ? ` · ${t.altitude} m` : ""}
            {t.irrigado && " · irrigado"}
          </div>
        </div>
        <div className="rb-chips">
          {resumo && <span className="rb-chip lact">{FASES_LABEL[resumo.fase]}{resumo.diasNaFase ? ` · ${resumo.diasNaFase}d` : ""}</span>}
          {resumo?.bienalidade && <span className={"rb-chip " + (resumo.bienalidade === "POSITIVA" ? "preg" : "")}>Bienalidade {resumo.bienalidade.toLowerCase()}</span>}
          {t.estado === "ATIVO" && (
            <span className="rb-head-actions">
              <button className="rb-btn pri" onClick={() => setRegistrando(true)}>+ Registrar operação</button>
            </span>
          )}
        </div>
      </div>

      {resumo && (
        <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
          <div className="rb-k">
            <div className="lab">Produtividade</div>
            <div className="val">{resumo.produtividadeEsperada ?? "—"}<u>sc/ha</u></div>
            <div className="d">safra 2026 estimada</div>
          </div>
          <div className="rb-k">
            <div className="lab">Safra anterior</div>
            <div className="val">{resumo.produtividadeUltima ?? "—"}<u>sc/ha</u></div>
            <div className="d">{resumo.bienalidade === "POSITIVA" ? "ano de carga" : "ano de descarga"}</div>
          </div>
          <div className="rb-k">
            <div className="lab">Cereja</div>
            <div className="val">{resumo.maturacaoCereja != null ? Math.round(resumo.maturacaoCereja) : "—"}<u>%</u></div>
            <div className="d">verde {resumo.maturacaoVerde ?? "—"}% · boia {resumo.maturacaoBoia ?? "—"}%</div>
          </div>
          <div className="rb-k">
            <div className="lab">Ferrugem</div>
            <div className="val" style={{ color: (resumo.ferrugem ?? 0) >= 5 ? "var(--prejuizo)" : undefined }}>
              {resumo.ferrugem != null ? resumo.ferrugem.toFixed(1) : "—"}<u>%</u>
            </div>
            <div className={"d" + (resumo.tendFerrugem === "subindo" ? " rb-up" : resumo.tendFerrugem === "caindo" ? " rb-ok" : "")}>
              {resumo.tendFerrugem ?? "—"}
            </div>
          </div>
          <div className="rb-k">
            <div className="lab">Broca</div>
            <div className="val" style={{ color: (resumo.broca ?? 0) >= 3 ? "var(--prejuizo)" : undefined }}>
              {resumo.broca != null ? resumo.broca.toFixed(1) : "—"}<u>%</u>
            </div>
            <div className="d">bicho-min. {resumo.bichoMineiro != null ? `${Math.round(resumo.bichoMineiro)}%` : "—"}</div>
          </div>
          <div className="rb-k">
            <div className="lab">Próxima operação</div>
            <div className="val" style={{ fontSize: 16, paddingTop: 6 }}>{resumo.proximaOperacao ?? "—"}</div>
            <div className="d">{resumo.proximaOperacaoEm ? new Date(resumo.proximaOperacaoEm).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
        </div>
      )}

      <div className="rb-grid">
        <div>
          <div className="rb-tl-card">
            <h3 className="rb-sec-title">Linha do tempo</h3>
            <p className="rb-sec-sub">Fenologia, fitossanidade, nutrição e colheita — interpretadas pelo sistema.</p>
            {eventos.length === 0
              ? <div className="rb-empty">Nenhum evento registrado. Use <b>+ Registrar operação</b> para começar.</div>
              : <Timeline eventos={eventos} />}
          </div>
        </div>
        <div>
          <div className="rb-box">
            <div className="rb-box-section">
              <h4>Ficha do talhão</h4>
              <div className="rb-kv"><span>Lavoura</span><b>{t.lavoura}</b></div>
              <div className="rb-kv"><span>Variedade</span><b>{t.variedade}</b></div>
              <div className="rb-kv"><span>Espaçamento</span><b>{t.espacamento}</b></div>
              <div className="rb-kv"><span>Densidade</span><b>{t.plantasHa.toLocaleString("pt-BR")} pl/ha</b></div>
              <div className="rb-kv"><span>Plantas totais</span><b>{plantas.toLocaleString("pt-BR")}</b></div>
              <div className="rb-kv"><span>Área</span><b>{t.areaHa} ha</b></div>
              {t.altitude != null && <div className="rb-kv"><span>Altitude</span><b>{t.altitude} m</b></div>}
              {t.exposicao && <div className="rb-kv"><span>Exposição</span><b>{t.exposicao}</b></div>}
              {t.declive != null && <div className="rb-kv"><span>Declive</span><b>{t.declive}%</b></div>}
              {t.irrigado && <div className="rb-kv"><span>Irrigação</span><b>sim</b></div>}
              {t.ultimaRecepa && <div className="rb-kv"><span>Última recepa</span><b>{new Date(t.ultimaRecepa).toLocaleDateString("pt-BR")}</b></div>}
            </div>
          </div>
          {resumo && (resumo.pH != null || resumo.fosforo != null || resumo.potassio != null) && (
            <div className="rb-box" style={{ marginTop: 14 }}>
              <div className="rb-box-section">
                <h4>Última análise de solo</h4>
                {resumo.ultimaAnaliseSolo && <div className="rb-kv"><span>Coleta</span><b>{new Date(resumo.ultimaAnaliseSolo).toLocaleDateString("pt-BR")}</b></div>}
                <div className="rb-kv"><span>pH (CaCl₂)</span><b style={{ color: (resumo.pH ?? 7) < 5.2 ? "var(--prejuizo)" : undefined }}>{resumo.pH ?? "—"}</b></div>
                <div className="rb-kv"><span>V (sat. de bases)</span><b style={{ color: (resumo.v ?? 100) < 50 ? "var(--prejuizo)" : undefined }}>{resumo.v ?? "—"}%</b></div>
                <div className="rb-kv"><span>M.O.</span><b>{resumo.mo ?? "—"} g/dm³</b></div>
                <div className="rb-kv"><span>P</span><b>{resumo.fosforo ?? "—"} mg/dm³</b></div>
                <div className="rb-kv"><span>K</span><b>{resumo.potassio ?? "—"} mg/dm³</b></div>
              </div>
            </div>
          )}
          {resumo?.ultimaAnaliseFoliar && (
            <div className="rb-box" style={{ marginTop: 14 }}>
              <div className="rb-box-section">
                <h4>Última análise foliar</h4>
                <div className="rb-kv"><span>Coleta</span><b>{new Date(resumo.ultimaAnaliseFoliar).toLocaleDateString("pt-BR")}</b></div>
                <div className="rb-kv"><span>N</span><b>{resumo.nFoliar ?? "—"}%</b></div>
                <div className="rb-kv"><span>K</span><b>{resumo.kFoliar ?? "—"}%</b></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {registrando && <OperacaoForm talhaoId={talhaoId} talhao={t} onFechar={() => setRegistrando(false)} onSalvo={() => { setRegistrando(false); recarregar(); }} />}
    </main>
  );
}
