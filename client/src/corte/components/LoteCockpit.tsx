import { useLote, useEventos } from "../api";
import { CATEGORIA_LABEL, FASE_LABEL, pesoToArrobas } from "../types";
import { idadeMesesAprox, mortalidadeAcumulada, GMD_ESPERADO } from "../lib/derive";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";

/* Cockpit do lote — espelha AnimalCockpit / TalhaoCockpit. Foco em KPIs do
 * gado de corte: peso médio, GMD vs esperado, @ carcaça, mortalidade,
 * próxima ação. */
export function LoteCockpit({ loteId, onVoltar }: { loteId: string; onVoltar: () => void }) {
  const { data: l, resumo, loading } = useLote(loteId);
  const { data: eventos } = useEventos(loteId);

  if (loading) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Lotes</button><p className="rb-sub">Carregando…</p></main>;
  if (!l) return <main className="rb-main"><button className="rb-crumb" onClick={onVoltar}>← Lotes</button><p>Lote não encontrado.</p></main>;

  const idade = idadeMesesAprox(l, HOJE);
  const mort = mortalidadeAcumulada(l);
  const arrobasCab = resumo?.pesoMedio ? pesoToArrobas(resumo.pesoMedio) : 0;
  const arrobasTot = arrobasCab * l.numCabecas;
  const esperadoGmd = GMD_ESPERADO[l.categoria];
  const gmdGap = (resumo?.gmd ?? 0) - esperadoGmd;

  return (
    <main className="rb-main">
      <button className="rb-crumb" onClick={onVoltar}>← <b>Corte</b> &nbsp;/&nbsp; Lote {l.codigo}</button>

      <div className="rb-head">
        <div>
          <h1>{l.nome} <small>· {l.codigo}</small></h1>
          <div className="rb-sub">
            {CATEGORIA_LABEL[l.categoria]} · {l.raca} · formado em {new Date(l.dataFormacao).toLocaleDateString("pt-BR")} ({idade} meses)
            {l.origem ? ` · ${l.origem}` : ""}
          </div>
        </div>
        <div className="rb-chips">
          <span className="rb-chip lact">{FASE_LABEL[l.fase]}</span>
          {l.piqueteAtual && <span className="rb-chip preg">{l.piqueteAtual}</span>}
        </div>
      </div>

      {resumo && (
        <div className="rb-kstrip" style={{ ["--cols" as any]: 6 }}>
          <div className="rb-k">
            <div className="lab">Cabeças</div>
            <div className="val">{l.numCabecas}</div>
            <div className="d">{l.numCabecasEntrada} entrada · mort {mort.toFixed(1)}%</div>
          </div>
          <div className="rb-k">
            <div className="lab">Peso médio</div>
            <div className="val">{resumo.pesoMedio ?? "—"}<u>kg</u></div>
            <div className="d">última pesagem {resumo.diasSemPesar ?? "—"}d atrás</div>
          </div>
          <div className="rb-k">
            <div className="lab">GMD</div>
            <div className="val" style={{ color: gmdGap < -0.05 && esperadoGmd > 0 ? "var(--prejuizo)" : undefined }}>
              {resumo.gmd != null ? resumo.gmd.toFixed(2) : "—"}<u>kg/d</u>
            </div>
            <div className={"d" + (gmdGap >= 0 ? " rb-ok" : esperadoGmd > 0 ? " rb-up" : "")}>
              {esperadoGmd > 0 ? `esperado ${esperadoGmd.toFixed(2)} kg/d` : "—"}
            </div>
          </div>
          <div className="rb-k">
            <div className="lab">@ carcaça</div>
            <div className="val">{arrobasCab.toFixed(1)}<u>@/cab</u></div>
            <div className="d">{arrobasTot.toFixed(0)} @ no lote</div>
          </div>
          <div className="rb-k">
            <div className="lab">Próxima ação</div>
            <div className="val" style={{ fontSize: 16, paddingTop: 6 }}>{resumo.proximaAcao ?? "—"}</div>
            <div className="d">{resumo.proximaAcaoEm ? new Date(resumo.proximaAcaoEm).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
          {(resumo.pesoAlvoVenda || resumo.diasParaAlvo != null) && (
            <div className="rb-k">
              <div className="lab">Alvo de venda</div>
              <div className="val">{resumo.pesoAlvoVenda ?? "—"}<u>kg</u></div>
              <div className="d">{resumo.diasParaAlvo != null ? `em ~${resumo.diasParaAlvo}d` : "—"}</div>
            </div>
          )}
        </div>
      )}

      <div className="rb-grid">
        <div>
          <div className="rb-tl-card">
            <h3 className="rb-sec-title">Linha do tempo</h3>
            <p className="rb-sec-sub">Pesagem, sanidade, nutrição e comercial — interpretadas pelo sistema.</p>
            {eventos.length === 0
              ? <div className="rb-empty">Nenhum evento registrado neste lote ainda.</div>
              : <Timeline eventos={eventos} />}
          </div>
        </div>
        <div>
          <div className="rb-box">
            <div className="rb-box-section">
              <h4>Ficha do lote</h4>
              <div className="rb-kv"><span>Categoria</span><b>{CATEGORIA_LABEL[l.categoria]}</b></div>
              <div className="rb-kv"><span>Raça</span><b>{l.raca}</b></div>
              <div className="rb-kv"><span>Fase</span><b>{FASE_LABEL[l.fase]}</b></div>
              <div className="rb-kv"><span>Origem</span><b>{l.origem ?? "—"}</b></div>
              <div className="rb-kv"><span>Piquete</span><b>{l.piqueteAtual ?? "—"}</b></div>
              <div className="rb-kv"><span>Estado</span><b>{l.estado}</b></div>
              <div className="rb-kv"><span>Formado</span><b>{new Date(l.dataFormacao).toLocaleDateString("pt-BR")}</b></div>
              <div className="rb-kv"><span>Cabeças entrada</span><b>{l.numCabecasEntrada}</b></div>
              <div className="rb-kv"><span>Cabeças hoje</span><b>{l.numCabecas}</b></div>
              <div className="rb-kv"><span>Mortalidade acumulada</span>
                <b style={{ color: mort >= 8 ? "var(--prejuizo)" : undefined }}>{mort.toFixed(1)}%</b>
              </div>
            </div>
            {l.observacao && (
              <div className="rb-box-section">
                <h4>Observação</h4>
                <p className="rb-sub" style={{ margin: 0 }}>{l.observacao}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
