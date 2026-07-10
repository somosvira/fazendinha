import { Loader } from "../../components/Loading";
import { useLote, useEventos } from "../api";
import { CATEGORIA_LABEL, FASE_LABEL, pesoToArrobas } from "../types";
import { idadeMesesAprox, mortalidadeAcumulada, GMD_ESPERADO } from "../lib/derive";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";

// Migalha (voltar) — reproduz .rb-crumb.
const CRUMB = "mb-4 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm text-ink-3 [&_b]:text-ink-2";
// .rb-k — célula base da faixa de KPI (a 1ª perde a border-left dentro do grid).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)] [&_u]:ml-1 [&_u]:text-[15px] [&_u]:font-medium [&_u]:not-italic [&_u]:no-underline [&_u]:text-ink-2";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

/* Cockpit do lote — espelha AnimalCockpit / TalhaoCockpit. Foco em KPIs do
 * gado de corte: peso médio, GMD vs esperado, @ carcaça, mortalidade,
 * próxima ação. */
export function LoteCockpit({ loteId, onVoltar }: { loteId: string; onVoltar: () => void }) {
  const { data: l, resumo, loading } = useLote(loteId);
  const { data: eventos } = useEventos(loteId);

  if (loading) return <main className="rb-main"><button className={CRUMB} onClick={onVoltar}>← Lotes</button><Loader /></main>;
  if (!l) return <main className="rb-main"><button className={CRUMB} onClick={onVoltar}>← Lotes</button><p>Lote não encontrado.</p></main>;

  const idade = idadeMesesAprox(l, HOJE);
  const mort = mortalidadeAcumulada(l);
  const arrobasCab = resumo?.pesoMedio ? pesoToArrobas(resumo.pesoMedio) : 0;
  const arrobasTot = arrobasCab * l.numCabecas;
  const esperadoGmd = GMD_ESPERADO[l.categoria];
  const gmdGap = (resumo?.gmd ?? 0) - esperadoGmd;

  return (
    <main className="rb-main">
      <button className={CRUMB} onClick={onVoltar}>← <b>Corte</b> &nbsp;/&nbsp; Lote {l.codigo}</button>

      <div className="mb-[18px] mt-1 flex items-end justify-between gap-5 border-b border-[color:var(--rule)] pb-4">
        <div>
          <h1 className="mt-1 font-serif text-[38px] font-medium leading-[1.05] [&_small]:text-2xl [&_small]:font-medium [&_small]:text-ink-2">{l.nome} <small>· {l.codigo}</small></h1>
          <div className="mt-[7px] text-sm text-ink-3">
            {CATEGORIA_LABEL[l.categoria]} · {l.raca} · formado em {new Date(l.dataFormacao).toLocaleDateString("pt-BR")} ({idade} meses)
            {l.origem ? ` · ${l.origem}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rb-chip lact">{FASE_LABEL[l.fase]}</span>
          {l.piqueteAtual && <span className="rb-chip preg">{l.piqueteAtual}</span>}
        </div>
      </div>

      {resumo && (
        <RebKpiStrip cols={6}>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Cabeças</div>
            <div className={RB_K_VAL}>{l.numCabecas}</div>
            <div className={RB_K_D}>{l.numCabecasEntrada} entrada · mort {mort.toFixed(1)}%</div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Peso médio</div>
            <div className={RB_K_VAL}>{resumo.pesoMedio ?? "—"}<u>kg</u></div>
            <div className={RB_K_D}>última pesagem {resumo.diasSemPesar ?? "—"}d atrás</div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>GMD</div>
            <div className={RB_K_VAL} style={{ color: gmdGap < -0.05 && esperadoGmd > 0 ? "var(--prejuizo)" : undefined }}>
              {resumo.gmd != null ? resumo.gmd.toFixed(2) : "—"}<u>kg/d</u>
            </div>
            <div className={RB_K_D + (gmdGap >= 0 ? " text-lucro" : esperadoGmd > 0 ? " text-prejuizo" : "")}>
              {esperadoGmd > 0 ? `esperado ${esperadoGmd.toFixed(2)} kg/d` : "—"}
            </div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>@ carcaça</div>
            <div className={RB_K_VAL}>{arrobasCab.toFixed(1)}<u>@/cab</u></div>
            <div className={RB_K_D}>{arrobasTot.toFixed(0)} @ no lote</div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Próxima ação</div>
            <div className={RB_K_VAL} style={{ fontSize: 16, paddingTop: 6 }}>{resumo.proximaAcao ?? "—"}</div>
            <div className={RB_K_D}>{resumo.proximaAcaoEm ? new Date(resumo.proximaAcaoEm).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
          {(resumo.pesoAlvoVenda || resumo.diasParaAlvo != null) && (
            <div className={RB_K}>
              <div className={RB_K_LAB}>Alvo de venda</div>
              <div className={RB_K_VAL}>{resumo.pesoAlvoVenda ?? "—"}<u>kg</u></div>
              <div className={RB_K_D}>{resumo.diasParaAlvo != null ? `em ~${resumo.diasParaAlvo}d` : "—"}</div>
            </div>
          )}
        </RebKpiStrip>
      )}

      <div className="rb-grid">
        <div>
          <div className="rb-tl-card">
            <h3 className="font-serif text-xl font-medium mb-3">Linha do tempo</h3>
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
                <p className="text-sm text-ink-3" style={{ margin: 0 }}>{l.observacao}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
