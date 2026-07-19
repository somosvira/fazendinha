import { useEffect, useState } from "react";
import { simularPrecoLeite, simularRacao, type SimPrecoLeite, type SimRacao } from "../api";
import { fmtMoney } from "./charts";

// Cenários ancorados em DADOS REAIS (endpoint /api/simulacao/*), diferente do
// what-if de 12 meses acima que projeta sobre um modelo. Aqui o backend lê o
// dashboard/custo-vaca-dia reais e simula — não grava nada.

const fmtL = (n: number) => "R$ " + n.toFixed(2).replace(".", ",") + "/L";
const fmtVD = (n: number) => "R$ " + n.toFixed(2).replace(".", ",") + "/vaca·dia";
const sinal = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

function Linha({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "pos" | "neg" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[color:var(--rule-soft)] py-[6px] text-sm last:border-0">
      <span className="text-ink-3">{rotulo}</span>
      <span className={"mono-nums font-semibold " + (tom === "pos" ? "text-lucro" : tom === "neg" ? "text-prejuizo" : "text-[color:var(--ink)]")}>{valor}</span>
    </div>
  );
}

export function CenariosReais() {
  const [pctLeite, setPctLeite] = useState(10);
  const [pctRacao, setPctRacao] = useState(-8);
  const [leite, setLeite] = useState<SimPrecoLeite | null>(null);
  const [racao, setRacao] = useState<SimRacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregando(true); setErro(null);
    Promise.all([simularPrecoLeite(pctLeite), simularRacao({ variacaoPct: pctRacao })])
      .then(([l, r]) => { if (vivo) { setLeite(l); setRacao(r); } })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : "Falha ao simular."); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [pctLeite, pctRacao]);

  return (
    <div className="mt-[22px] border-t border-[color:var(--rule)] pt-5">
      <div className="mb-3 flex flex-col gap-1">
        <span className="eyebrow">Ancorado nos dados reais</span>
        <h3 className="m-0 font-serif text-2xl font-normal tracking-[-0.01em]">Cenários sobre o realizado</h3>
        <p className="m-0 text-sm text-ink-3">Lê o dashboard e o custo vaca/dia reais e simula — não grava lançamento.</p>
      </div>

      {erro && <p className="text-sm text-prejuizo">{erro}</p>}

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {/* Preço do leite ±X% */}
        <div className="border border-[color:var(--rule)] bg-card p-[18px]">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Preço do leite</h4>
            <div className="flex items-center gap-2 text-sm">
              <input type="range" min={-30} max={30} step={1} value={pctLeite} onChange={(e) => setPctLeite(Number(e.target.value))} className="w-28" aria-label="Variação do preço do leite (%)" />
              <span className="mono-nums w-12 text-right font-semibold">{sinal(pctLeite)}{Math.abs(pctLeite)}%</span>
            </div>
          </div>
          {leite && (
            <div className="flex flex-col">
              <Linha rotulo="Preço médio (real)" valor={fmtL(leite.base.precoMedio)} />
              <Linha rotulo="Preço simulado" valor={fmtL(leite.resultado.precoSimulado)} />
              <Linha rotulo="Receita de leite (real)" valor={fmtMoney(leite.resultado.receitaLeiteBase)} />
              <Linha rotulo="Receita simulada" valor={fmtMoney(leite.resultado.receitaLeiteSimulada)} />
              <Linha rotulo="Δ receita" valor={sinal(leite.resultado.deltaReceita) + fmtMoney(Math.abs(leite.resultado.deltaReceita))} tom={leite.resultado.deltaReceita >= 0 ? "pos" : "neg"} />
              <Linha rotulo="Fluxo simulado (23m)" valor={fmtMoney(leite.resultado.fluxoPeriodoSimulado)} tom={leite.resultado.fluxoPeriodoSimulado >= 0 ? "pos" : "neg"} />
            </div>
          )}
        </div>

        {/* Troca de ração → custo vaca/dia */}
        <div className="border border-[color:var(--rule)] bg-card p-[18px]">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Troca de ração</h4>
            <div className="flex items-center gap-2 text-sm">
              <input type="range" min={-30} max={30} step={1} value={pctRacao} onChange={(e) => setPctRacao(Number(e.target.value))} className="w-28" aria-label="Variação do custo da ração (%)" />
              <span className="mono-nums w-12 text-right font-semibold">{sinal(pctRacao)}{Math.abs(pctRacao)}%</span>
            </div>
          </div>
          {racao && (
            <div className="flex flex-col">
              <Linha rotulo="Custo vaca/dia (real)" valor={fmtVD(racao.resultado.custoVacaDiaAtual)} />
              <Linha rotulo="Custo vaca/dia simulado" valor={fmtVD(racao.resultado.custoVacaDiaSimulado)} />
              <Linha rotulo="Vacas em lactação" valor={String(racao.base.vacasEmLactacao)} />
              <Linha rotulo={`Custo do lote (${racao.base.periodoDias}d, real)`} valor={fmtMoney(racao.resultado.custoMensalAtual)} />
              <Linha rotulo="Custo do lote simulado" valor={fmtMoney(racao.resultado.custoMensalSimulado)} />
              <Linha rotulo="Economia no período" valor={sinal(racao.resultado.economiaMensal) + fmtMoney(Math.abs(racao.resultado.economiaMensal))} tom={racao.resultado.economiaMensal >= 0 ? "pos" : "neg"} />
            </div>
          )}
        </div>
      </div>
      {carregando && <p className="mt-2 text-xs text-ink-3">simulando…</p>}
    </div>
  );
}
