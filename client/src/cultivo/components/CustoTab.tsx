import { useState } from "react";
import { useSafrasCultivo, useResumoSafraCultivo } from "../api";
import { ClasseToggle, type Classe } from "../../components/ClasseToggle";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// custoHa/custoSaca/custoTonelada podem vir null (safra em formação, sem
// benefício no período, ou safra mista grão+silagem — ver `nota`).
const moneyN = (n: number | null) => (n == null ? "—" : money(n));
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

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
    <main className="rb-main">
      <div className="rb-eyebrow">Cultivo · milho</div>
      <div className="rb-head"><h1>Custo de produção</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="rb-select" value={safraCultivoId} onChange={(e) => setSafraCultivoId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">{safraAtual ? `${safraAtual.nome} · ${safraAtual.ano} (mais recente)` : "Selecione uma safra"}</option>
          {safras.map((s) => <option key={s.id} value={s.id}>{s.nome} · {s.ano}</option>)}
        </select>
        <ClasseToggle value={classe} onChange={setClasse} />
      </div>

      {erroResumo ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Não foi possível carregar o resumo: {erroResumo}</p>
      ) : carregando || !dadosResumo ? (
        <p className="rb-sub">{safras.length === 0 && !loadingSafras ? "Nenhuma safra cadastrada ainda." : "Carregando…"}</p>
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Total ({classe})</div>
              <div className="val" style={{ fontSize: 30, color: "var(--cafe)" }}>{money(dadosResumo.total)}</div>
              <div className="d">{qtd(dadosResumo.areaHa)} ha</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo / ha</div>
              <div className="val" style={{ fontSize: 22 }}>{moneyN(dadosResumo.custoHa)}</div>
              <div className="d">sobre custeio</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo / saca</div>
              <div className="val" style={{ fontSize: 22 }}>{moneyN(dadosResumo.custoSaca)}</div>
              <div className="d">{qtd(dadosResumo.producaoGraoSc)} sc produzidas</div>
            </div>
            <div className="rb-k">
              <div className="lab">Custo / tonelada</div>
              <div className="val" style={{ fontSize: 22 }}>{moneyN(dadosResumo.custoTonelada)}</div>
              <div className="d">{qtd(dadosResumo.producaoSilagemTon)} ton silagem</div>
            </div>
          </div>

          <div className="rb-box" style={{ marginTop: 26 }}>
            <h3 style={{ margin: "0 0 6px" }}>Detalhamento</h3>
            <div className="rb-kstrip" style={{ ["--cols" as any]: 3, marginTop: 8 }}>
              <div className="rb-k">
                <div className="lab">Custeio total</div>
                <div className="val" style={{ fontSize: 20 }}>{money(dadosResumo.custeioTotal)}</div>
              </div>
              <div className="rb-k">
                <div className="lab">Investimento total</div>
                <div className="val" style={{ fontSize: 20 }}>{money(dadosResumo.investimentoTotal)}</div>
              </div>
              <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
                <div className="lab">Horas-máquina total</div>
                <div className="val" style={{ fontSize: 20, color: "var(--cafe)" }}>{qtd(dadosResumo.horasMaquinaTotal)}<u>h</u></div>
              </div>
            </div>
          </div>

          {dadosResumo.nota && (
            <p className="rb-sub" style={{ marginTop: 16 }}>{dadosResumo.nota}</p>
          )}
        </>
      )}
    </main>
  );
}
