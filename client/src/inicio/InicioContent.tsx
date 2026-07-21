import { useEffect, useState } from "react";
import { useDashboard } from "../rebanho/api";
import { fetchDashboard } from "../api";
import { AtencaoCard, CaixaCard, LeiteHojeCard } from "./components/InicioCards";
import { resumoAtencao, resumoCaixa, resumoLeite, type ResumoCaixa } from "./lib/inicioDerive";

const CAIXA_VAZIO: ResumoCaixa = { saldo: null, mesLabel: null, entrada: null, saida: null, fluxo: null };

export function InicioContent({ onNav }: { onNav: (tab: string) => void }) {
  const reb = useDashboard();
  const [fin, setFin] = useState<unknown>(null);
  const [finErro, setFinErro] = useState(false);
  const [finLoading, setFinLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetchDashboard()
      .then((d) => { if (vivo) setFin(d); })
      .catch(() => { if (vivo) setFinErro(true); })
      .finally(() => { if (vivo) setFinLoading(false); });
    return () => { vivo = false; };
  }, []);

  const leite = resumoLeite(reb.data);
  const atencao = resumoAtencao(reb.data);
  const caixa = fin ? resumoCaixa(fin) : CAIXA_VAZIO;

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-5 px-6 pt-7 pb-20 max-[620px]:px-4">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-ink-3">Início</span>
        <h1 className="font-serif text-[30px] font-medium tracking-[-.01em]">Como a fazenda está hoje</h1>
      </header>
      <AtencaoCard itens={atencao} onAbrir={(tab) => onNav("reb-" + tab)} />
      <LeiteHojeCard resumo={leite} loading={reb.loading} erro={!!reb.erro} onVer={() => onNav("reb-dashboard")} />
      <CaixaCard resumo={caixa} loading={finLoading} erro={finErro} onVer={() => onNav("dashboard")} />
    </main>
  );
}
