import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { deslocarMes } from "./lib/calendario";
import { mesAtual } from "./financeiro-ui";

const OPCOES_PERIODO = [
  { valor: "ano-atual", label: "Este ano" },
  { valor: "ano-anterior", label: "Ano passado" },
  { valor: "1", label: "1 mês" },
  { valor: "3", label: "3 meses" },
  { valor: "6", label: "6 meses" },
  { valor: "24", label: "2 anos" },
] as const;

function inicioDaJanela(fim: string, meses: number) {
  return deslocarMes(fim, -(meses - 1));
}

export function periodoDoAno(ano: number) {
  return { inicio: `${ano}-01`, fim: `${ano}-12` };
}

export function periodoDoAnoAtual() {
  return periodoDoAno(Number(new Date().getFullYear()));
}

function atalhoDoPeriodo(inicio: string, fim: string) {
  const anoAtual = new Date().getFullYear();
  if (inicio === `${anoAtual}-01` && fim === `${anoAtual}-12`) return "ano-atual";
  if (inicio === `${anoAtual - 1}-01` && fim === `${anoAtual - 1}-12`) return "ano-anterior";
  return "personalizado";
}

export function PeriodoGraficoControl({ inicio, fim, onChange, id = "" }: {
  inicio: string;
  fim: string;
  onChange: (periodo: { inicio: string; fim: string }) => void;
  /** Sufixo dos nomes acessíveis quando há mais de um controle na mesma tela. */
  id?: string;
}) {
  const [atalho, setAtalho] = useState(() => atalhoDoPeriodo(inicio, fim));
  const sufixo = id ? ` ${id}` : "";
  const alterarInicio = (valor: string) => {
    if (!valor) return;
    onChange({ inicio: valor, fim: valor > fim ? valor : fim });
    setAtalho("personalizado");
  };
  const alterarFim = (valor: string) => {
    if (!valor) return;
    onChange({ inicio: valor < inicio ? valor : inicio, fim: valor });
    setAtalho("personalizado");
  };
  const aplicarAtalho = (valor: string) => {
    setAtalho(valor);
    if (valor === "ano-atual") onChange(periodoDoAnoAtual());
    else if (valor === "ano-anterior") onChange(periodoDoAno(new Date().getFullYear() - 1));
    else if (valor !== "personalizado") {
      const mesFinal = mesAtual();
      onChange({ inicio: inicioDaJanela(mesFinal, Number(valor)), fim: mesFinal });
    }
  };
  const deslocar = (direcao: number) => {
    const meses = inicio.endsWith("-01") && fim.endsWith("-12") && inicio.slice(0, 4) === fim.slice(0, 4) ? 12 : 1;
    const proximo = { inicio: deslocarMes(inicio, direcao * meses), fim: deslocarMes(fim, direcao * meses) };
    setAtalho(atalhoDoPeriodo(proximo.inicio, proximo.fim));
    onChange(proximo);
  };

  return <div className="flex flex-wrap items-end gap-2">
    <button type="button" aria-label={`Período anterior do gráfico${sufixo}`} onClick={() => deslocar(-1)} className="rounded-lg border border-border bg-white p-2.5 hover:bg-surface-2"><ChevronLeft size={18} /></button>
    <label className="text-xs font-semibold text-ink-3">Intervalo
      <select aria-label={`Intervalo do gráfico${sufixo}`} value={atalho} onChange={(e) => aplicarAtalho(e.target.value)} className="mt-1 block min-h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium text-ink">
        <option value="personalizado">Personalizado</option>
        {OPCOES_PERIODO.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.label}{opcao.valor === "ano-atual" ? ` (${new Date().getFullYear()})` : opcao.valor === "ano-anterior" ? ` (${new Date().getFullYear() - 1})` : ""}</option>)}
      </select>
    </label>
    <label className="text-xs font-semibold text-ink-3">Mês inicial
      <input aria-label={`Mês inicial do gráfico${sufixo}`} type="month" value={inicio} onChange={(e) => alterarInicio(e.target.value)} className="mt-1 block min-h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium text-ink" />
    </label>
    <label className="text-xs font-semibold text-ink-3">Mês final
      <input aria-label={`Mês final do gráfico${sufixo}`} type="month" value={fim} onChange={(e) => alterarFim(e.target.value)} className="mt-1 block min-h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium text-ink" />
    </label>
    <button type="button" aria-label={`Próximo período do gráfico${sufixo}`} onClick={() => deslocar(1)} className="rounded-lg border border-border bg-white p-2.5 hover:bg-surface-2"><ChevronRight size={18} /></button>
  </div>;
}
