import { useState } from "react";
import { useSafrasCultivo, useResumoSafraCultivo } from "../api";
import { ClasseToggle, type Classe } from "../../components/ClasseToggle";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebHeader } from "@/components/rb/RebHeader";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";
import { RebMain, RebBox } from "@/components/rb/RebPrimitives";
import { EmptyState } from "@/components/EmptyState";
import { fmtMoneyExact } from "@/components/charts";
import { Sprout } from "lucide-react";

const money = fmtMoneyExact;
// custoHa/custoSaca/custoTonelada podem vir null (safra em formação, sem
// benefício no período, ou safra mista grão+silagem — ver `nota`).
const moneyN = (n: number | null) => (n == null ? "—" : money(n));
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Reproduz .rb-k para células custom (borda colorida / fonte custom).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

/* Custo de produção do milho (ResumoSafraCultivo) — <ClasseToggle> no topo
 * filtra qual total headline é exibido (custeio/investimento/tudo); os
 * custos por unidade (ha/saca/tonelada) são sempre sobre custeio (§2/§5.1
 * do contrato do backend) e por isso não mudam com o toggle. */
export function CustoTab() {
  const { data: safras, loading: loadingSafras } = useSafrasCultivo();
  const [safraCultivoId, setSafraCultivoId] = useState<number | "">("");
  const [classe, setClasse] = useState<Classe>("custeio");

  // Sem seleção explícita, usa a safra mais recente (primeira da listagem) como padrão.
  const safraAtual = safraCultivoId === "" ? safras[0] : safras.find((s) => s.id === safraCultivoId);
  const idEfetivo = safraCultivoId === "" ? safraAtual?.id ?? null : safraCultivoId;

  const { data: dadosResumo, loading: loadingResumo, erro: erroResumo } = useResumoSafraCultivo(idEfetivo, classe);
  const carregando = loadingSafras || loadingResumo;

  return (
    <RebMain>
      <RebHeader eyebrow="Cultivo · milho" title="Custo de produção" />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <ToolbarSelect
          value={String(safraCultivoId)}
          onChange={(v) => setSafraCultivoId(v ? Number(v) : "")}
          ariaLabel="Escolher safra"
          options={[
            { value: "", label: safraAtual ? `${safraAtual.nome} · ${safraAtual.ano} (mais recente)` : "Selecione uma safra" },
            ...safras.map((s) => ({ value: String(s.id), label: `${s.nome} · ${s.ano}` })),
          ]}
        />
        <ClasseToggle value={classe} onChange={setClasse} />
      </div>

      {erroResumo ? (
        <p className="text-sm text-prejuizo">Não foi possível carregar o resumo: {erroResumo}</p>
      ) : safras.length === 0 && !loadingSafras ? (
        <EmptyState
          icon={Sprout}
          titulo="Nenhuma safra de milho cadastrada"
          descricao="O custo de produção é calculado por safra. Cadastre uma safra em “Safras” para acompanhar custo por hectare, saca e tonelada."
        />
      ) : carregando || !dadosResumo ? (
        <p className="text-sm text-ink-3">Carregando…</p>
      ) : (
        <>
          <RebKpiStrip cols={4}>
            <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className={RB_K_LAB}>Total ({classe})</div>
              <div className={RB_K_VAL} style={{ fontSize: 30, color: "var(--cafe)" }}>{money(dadosResumo.total)}</div>
              <div className={RB_K_D}>{qtd(dadosResumo.areaHa)} ha</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Custo / ha</div>
              <div className={RB_K_VAL} style={{ fontSize: 22 }}>{moneyN(dadosResumo.custoHa)}</div>
              <div className={RB_K_D}>sobre custeio</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Custo / saca</div>
              <div className={RB_K_VAL} style={{ fontSize: 22 }}>{moneyN(dadosResumo.custoSaca)}</div>
              <div className={RB_K_D}>{qtd(dadosResumo.producaoGraoSc)} sc produzidas</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Custo / tonelada</div>
              <div className={RB_K_VAL} style={{ fontSize: 22 }}>{moneyN(dadosResumo.custoTonelada)}</div>
              <div className={RB_K_D}>{qtd(dadosResumo.producaoSilagemTon)} ton silagem</div>
            </div>
          </RebKpiStrip>

          <RebBox style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Detalhamento</h3>
            <RebKpiStrip cols={3} style={{ marginTop: 8 }}>
              <div className={RB_K}>
                <div className={RB_K_LAB}>Custeio total</div>
                <div className={RB_K_VAL} style={{ fontSize: 20 }}>{money(dadosResumo.custeioTotal)}</div>
              </div>
              <div className={RB_K}>
                <div className={RB_K_LAB}>Investimento total</div>
                <div className={RB_K_VAL} style={{ fontSize: 20 }}>{money(dadosResumo.investimentoTotal)}</div>
              </div>
              <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className={RB_K_LAB}>Horas-máquina total</div>
                <div className={RB_K_VAL} style={{ fontSize: 20, color: "var(--cafe)" }}>{qtd(dadosResumo.horasMaquinaTotal)}<u>h</u></div>
              </div>
            </RebKpiStrip>
          </RebBox>

          {dadosResumo.nota && (
            <p className="text-sm text-ink-3" style={{ marginTop: 16 }}>{dadosResumo.nota}</p>
          )}
        </>
      )}
    </RebMain>
  );
}
