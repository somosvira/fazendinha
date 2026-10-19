import { useEffect, useState } from "react";
import { dateFromIso, isoDate, type DateRange } from "../../../components/DateRangePicker";
import { getHoje } from "../../../lib/hoje";

export type PeriodoConsulta = { inicio: string; fim: string };
type TipoConsulta = "partos" | "indicadores";
type ConsultaResolvida = { periodo: PeriodoConsulta; aviso: string | null; corrigirUrl: boolean };

export function periodoPadrao(tipo: TipoConsulta): PeriodoConsulta {
  const hoje = getHoje();
  const inicio = tipo === "partos"
    ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 89)
    : new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
  return { inicio: isoDate(inicio), fim: isoDate(hoje) };
}
export function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}
function limitarAHoje(periodo: PeriodoConsulta): PeriodoConsulta {
  const hoje = isoDate(getHoje());
  return { inicio: periodo.inicio > hoje ? hoje : periodo.inicio, fim: periodo.fim > hoje ? hoje : periodo.fim };
}
function daUrl(tipo: TipoConsulta): ConsultaResolvida {
  const params = new URLSearchParams(window.location.search);
  const inicio = params.get("inicio") ?? "", fim = params.get("fim") ?? "";
  if (!inicio && !fim && !params.has("inicio") && !params.has("fim")) {
    return { periodo: periodoPadrao(tipo), aviso: null, corrigirUrl: false };
  }
  if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) {
    return { periodo: periodoPadrao(tipo), aviso: "Período inválido. Aplicado o período padrão da consulta.", corrigirUrl: true };
  }
  const periodo = limitarAHoje({ inicio, fim });
  const limitado = periodo.inicio !== inicio || periodo.fim !== fim;
  return { periodo, aviso: limitado ? "O período operacional foi limitado a hoje; datas futuras não entram na consulta." : null, corrigirUrl: limitado };
}
function atualizarUrl(periodo: PeriodoConsulta): void {
  const url = new URL(window.location.href);
  url.searchParams.set("inicio", periodo.inicio);
  url.searchParams.set("fim", periodo.fim);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

/** Consulta operacional factual até hoje; relatórios mantêm seus próprios cortes explícitos. */
export function usePeriodoConsulta(tipo: TipoConsulta) {
  const [consulta, setConsulta] = useState(() => daUrl(tipo));
  useEffect(() => {
    const carregar = (preservarAviso: boolean) => {
      const proxima = daUrl(tipo);
      if (proxima.corrigirUrl) atualizarUrl(proxima.periodo);
      setConsulta(anterior => preservarAviso && anterior.aviso && !proxima.aviso
        && anterior.periodo.inicio === proxima.periodo.inicio && anterior.periodo.fim === proxima.periodo.fim ? anterior : proxima);
    };
    // A normalização da URL acontece após o render; a primeira consulta já recebe datas limitadas.
    // StrictMode repete o efeito após normalizar a URL; conserva a explicação do ajuste.
    carregar(true);
    const sync = () => carregar(false);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [tipo]);
  function alterar(range: DateRange) {
    if (!range.start || !range.end) return;
    const escolhido = { inicio: isoDate(range.start), fim: isoDate(range.end) };
    if (!dataValida(escolhido.inicio) || !dataValida(escolhido.fim) || escolhido.inicio > escolhido.fim) return;
    const periodo = limitarAHoje(escolhido);
    atualizarUrl(periodo);
    setConsulta({ periodo, corrigirUrl: false, aviso: periodo.fim !== escolhido.fim
      ? "O período operacional foi limitado a hoje; datas futuras não entram na consulta." : null });
  }
  return { ...consulta.periodo, aviso: consulta.aviso,
    range: { start: dateFromIso(consulta.periodo.inicio), end: dateFromIso(consulta.periodo.fim) }, alterar };
}
