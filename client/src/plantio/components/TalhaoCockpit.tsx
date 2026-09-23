import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useTalhao, useEventos } from "../api";
import { idadeAnos, totalPlantas, categoriaIdade } from "../lib/derive";
import { FASES_LABEL } from "../lib/fenologia";
import { HOJE } from "../HOJE";
import { Timeline } from "./Timeline";
import { OperacaoForm } from "./OperacaoForm";
import { RebButton } from "@/components/rb/RebButton";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";
import {
  RebMain, RebBox, RebBoxSection, RebKv, RebEmpty,
  REB_CRUMB, REB_SEC_SUB, REB_CHIP, REB_CHIP_PREG, REB_CHIP_LACT,
} from "@/components/rb/RebPrimitives";

// .rb-k — célula base da faixa de KPI (a 1ª perde a border-left dentro do grid).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)] [&_u]:ml-1 [&_u]:text-[15px] [&_u]:font-medium [&_u]:not-italic [&_u]:no-underline [&_u]:text-ink-2";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

export function TalhaoCockpit({ talhaoId, onVoltar }: { talhaoId: string; onVoltar: () => void }) {
  const { data: t, resumo, loading } = useTalhao(talhaoId);
  const { data: eventos, recarregar } = useEventos(talhaoId);
  const [registrando, setRegistrando] = useState(false);

  if (loading) return <RebMain><button className={REB_CRUMB} onClick={onVoltar}>← Lavoura</button><Loader /></RebMain>;
  if (!t) return <RebMain><button className={REB_CRUMB} onClick={onVoltar}>← Lavoura</button><p>Talhão não encontrado.</p></RebMain>;

  const idade = idadeAnos(t, HOJE);
  const categoria = categoriaIdade(idade);
  const plantas = totalPlantas(t);

  return (
    <RebMain>
      <button className={REB_CRUMB} onClick={onVoltar}>← <b>Lavoura</b> &nbsp;/&nbsp; Talhão {t.codigo}</button>

      <div className="mb-[18px] mt-1 flex items-end justify-between gap-5 border-b border-[color:var(--rule)] pb-4">
        <div>
          <h1 className="mt-1 font-serif text-[38px] font-medium leading-[1.05] [&_small]:text-2xl [&_small]:font-medium [&_small]:text-ink-2">{t.nome} <small>· {t.codigo}</small></h1>
          <div className="mt-[7px] text-sm text-ink-3">
            {t.variedade} · {t.areaHa} ha · plantio em {new Date(t.dataPlantio).toLocaleDateString("pt-BR")} ({idade}a · {categoria}){t.altitude ? ` · ${t.altitude} m` : ""}
            {t.irrigado && " · irrigado"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {resumo && <span className={`${REB_CHIP} ${REB_CHIP_LACT}`}>{FASES_LABEL[resumo.fase]}{resumo.diasNaFase ? ` · ${resumo.diasNaFase}d` : ""}</span>}
          {resumo?.bienalidade && <span className={resumo.bienalidade === "POSITIVA" ? `${REB_CHIP} ${REB_CHIP_PREG}` : REB_CHIP}>Bienalidade {resumo.bienalidade.toLowerCase()}</span>}
          {t.estado === "ATIVO" && (
            <span className="flex gap-2">
              <RebButton variant="pri" onClick={() => setRegistrando(true)}>+ Registrar operação</RebButton>
            </span>
          )}
        </div>
      </div>

      {resumo && (
        <RebKpiStrip cols={6}>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Produtividade</div>
            <div className={RB_K_VAL}>{resumo.produtividadeEsperada ?? "—"}<u>sc/ha</u></div>
            <div className={RB_K_D}>safra 2026 estimada</div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Safra anterior</div>
            <div className={RB_K_VAL}>{resumo.produtividadeUltima ?? "—"}<u>sc/ha</u></div>
            <div className={RB_K_D}>{resumo.bienalidade === "POSITIVA" ? "ano de carga" : "ano de descarga"}</div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Cereja</div>
            <div className={RB_K_VAL}>{resumo.maturacaoCereja != null ? Math.round(resumo.maturacaoCereja) : "—"}<u>%</u></div>
            <div className={RB_K_D}>verde {resumo.maturacaoVerde ?? "—"}% · boia {resumo.maturacaoBoia ?? "—"}%</div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Ferrugem</div>
            <div className={RB_K_VAL} style={{ color: (resumo.ferrugem ?? 0) >= 5 ? "var(--prejuizo)" : undefined }}>
              {resumo.ferrugem != null ? resumo.ferrugem.toFixed(1) : "—"}<u>%</u>
            </div>
            <div className={RB_K_D + (resumo.tendFerrugem === "subindo" ? " text-prejuizo" : resumo.tendFerrugem === "caindo" ? " text-lucro" : "")}>
              {resumo.tendFerrugem ?? "—"}
            </div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Broca</div>
            <div className={RB_K_VAL} style={{ color: (resumo.broca ?? 0) >= 3 ? "var(--prejuizo)" : undefined }}>
              {resumo.broca != null ? resumo.broca.toFixed(1) : "—"}<u>%</u>
            </div>
            <div className={RB_K_D}>bicho-min. {resumo.bichoMineiro != null ? `${Math.round(resumo.bichoMineiro)}%` : "—"}</div>
          </div>
          <div className={RB_K}>
            <div className={RB_K_LAB}>Próxima operação</div>
            <div className={RB_K_VAL + " !text-[16px] pt-1.5"}>{resumo.proximaOperacao ?? "—"}</div>
            <div className={RB_K_D}>{resumo.proximaOperacaoEm ? new Date(resumo.proximaOperacaoEm).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
        </RebKpiStrip>
      )}

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_clamp(280px,24vw,360px)] gap-[clamp(20px,2.4vw,36px)] max-[1100px]:grid-cols-1">
        <div>
          <div className="rb-tl-card">
            <h3 className="mb-3 font-serif text-xl font-medium">Linha do tempo</h3>
            <p className={REB_SEC_SUB}>Fenologia, fitossanidade, nutrição e colheita — interpretadas pelo sistema.</p>
            {eventos.length === 0
              ? <RebEmpty>Nenhum evento registrado. Use <b>+ Registrar operação</b> para começar.</RebEmpty>
              : <Timeline eventos={eventos} onExcluido={recarregar} />}
          </div>
        </div>
        <div>
          <RebBox>
            <RebBoxSection>
              <h4>Ficha do talhão</h4>
              <RebKv><span>Lavoura</span><b>{t.lavoura}</b></RebKv>
              <RebKv><span>Variedade</span><b>{t.variedade}</b></RebKv>
              <RebKv><span>Espaçamento</span><b>{t.espacamento}</b></RebKv>
              <RebKv><span>Densidade</span><b>{t.plantasHa.toLocaleString("pt-BR")} pl/ha</b></RebKv>
              <RebKv><span>Plantas totais</span><b>{plantas.toLocaleString("pt-BR")}</b></RebKv>
              <RebKv><span>Área</span><b>{t.areaHa} ha</b></RebKv>
              {t.altitude != null && <RebKv><span>Altitude</span><b>{t.altitude} m</b></RebKv>}
              {t.exposicao && <RebKv><span>Exposição</span><b>{t.exposicao}</b></RebKv>}
              {t.declive != null && <RebKv><span>Declive</span><b>{t.declive}%</b></RebKv>}
              {t.irrigado && <RebKv><span>Irrigação</span><b>sim</b></RebKv>}
              {t.ultimaRecepa && <RebKv><span>Última recepa</span><b>{new Date(t.ultimaRecepa).toLocaleDateString("pt-BR")}</b></RebKv>}
            </RebBoxSection>
          </RebBox>
          {resumo && (resumo.pH != null || resumo.fosforo != null || resumo.potassio != null) && (
            <RebBox className="mt-3.5">
              <RebBoxSection>
                <h4>Última análise de solo</h4>
                {resumo.ultimaAnaliseSolo && <RebKv><span>Coleta</span><b>{new Date(resumo.ultimaAnaliseSolo).toLocaleDateString("pt-BR")}</b></RebKv>}
                <RebKv><span>pH (CaCl₂)</span><b style={{ color: (resumo.pH ?? 7) < 5.2 ? "var(--prejuizo)" : undefined }}>{resumo.pH ?? "—"}</b></RebKv>
                <RebKv><span>V (sat. de bases)</span><b style={{ color: (resumo.v ?? 100) < 50 ? "var(--prejuizo)" : undefined }}>{resumo.v ?? "—"}%</b></RebKv>
                <RebKv><span>M.O.</span><b>{resumo.mo ?? "—"} g/dm³</b></RebKv>
                <RebKv><span>P</span><b>{resumo.fosforo ?? "—"} mg/dm³</b></RebKv>
                <RebKv><span>K</span><b>{resumo.potassio ?? "—"} mg/dm³</b></RebKv>
              </RebBoxSection>
            </RebBox>
          )}
          {resumo?.ultimaAnaliseFoliar && (
            <RebBox className="mt-3.5">
              <RebBoxSection>
                <h4>Última análise foliar</h4>
                <RebKv><span>Coleta</span><b>{new Date(resumo.ultimaAnaliseFoliar).toLocaleDateString("pt-BR")}</b></RebKv>
                <RebKv><span>N</span><b>{resumo.nFoliar ?? "—"}%</b></RebKv>
                <RebKv><span>K</span><b>{resumo.kFoliar ?? "—"}%</b></RebKv>
              </RebBoxSection>
            </RebBox>
          )}
        </div>
      </div>

      {registrando && <OperacaoForm talhaoId={talhaoId} talhao={t} onFechar={() => setRegistrando(false)} onSalvo={() => { setRegistrando(false); recarregar(); }} />}
    </RebMain>
  );
}
