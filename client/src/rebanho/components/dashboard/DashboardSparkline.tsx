import type { PontoSerieDashboard } from "../../api";

function trechos(serie: PontoSerieDashboard[], largura: number, altura: number): string[] {
  const validos = serie.filter((p) => p.valor != null).map((p) => p.valor as number);
  if (!validos.length) return [];
  const min = Math.min(...validos);
  const max = Math.max(...validos);
  const faixa = max - min || 1;
  const x = (i: number) => serie.length === 1 ? largura / 2 : (i / (serie.length - 1)) * largura;
  const y = (v: number) => altura - 3 - ((v - min) / faixa) * (altura - 6);
  const partes: string[] = [];
  let atual: string[] = [];
  serie.forEach((p, i) => {
    if (p.valor == null) {
      if (atual.length) partes.push(atual.join(" "));
      atual = [];
    } else atual.push(`${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`);
  });
  if (atual.length) partes.push(atual.join(" "));
  return partes;
}

export function DashboardSparkline({ serie, label }: { serie: PontoSerieDashboard[]; label: string }) {
  const linhas = trechos(serie, 92, 32);
  return (
    <svg viewBox="0 0 92 32" className="h-8 w-[92px] overflow-visible" role="img" aria-label={label}>
      {linhas.map((p, i) => <polyline key={i} points={p} fill="none" stroke="var(--cafe)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
