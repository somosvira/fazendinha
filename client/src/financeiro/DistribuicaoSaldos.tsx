import type { Conta } from "./novo-api";
import { brl } from "./financeiro-ui";
const CORES = ["#007c76", "#419b99", "#91b5a2", "#285c6c", "#76929f"];
export function DistribuicaoSaldos({ contas, onAbrir }: { contas: Conta[]; onAbrir: (id: string) => void }) {
  const valores = contas.map(c => Math.round(Number(c.saldoAtual) * 100));
  const total = valores.reduce((s, v) => s + v, 0);
  // Saldos negativos não formam parcelas de um total positivo.
  if (!contas.length || valores.some(v => !Number.isFinite(v) || v < 0) || total <= 0) return null;
  return <section className="p-5 border-t border-border" aria-label="Distribuição do saldo entre as contas incluídas"><h2 className="text-sm font-semibold">Distribuição do saldo entre as contas incluídas</h2><div className="flex h-3 overflow-hidden rounded-full mt-4" role="img" aria-label={contas.map((c, i) => `${c.nome}: ${(valores[i] / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`).join(", ")}>{contas.map((c, i) => <span key={c.id} style={{ width: `${valores[i] / total * 100}%`, background: CORES[i % CORES.length] }} />)}</div><ul className="flex flex-wrap gap-x-8 gap-y-3 mt-4">{contas.map((c, i) => <li key={c.id}><button type="button" className="flex items-center gap-2 text-sm text-left rounded-sm focus-visible:outline-2 focus-visible:outline-primary hover:underline" onClick={() => onAbrir(c.id)}><i aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ background: CORES[i % CORES.length] }} /><span>{c.nome}<strong className="block mt-1 tabular-nums">{brl(c.saldoAtual)}</strong></span></button></li>)}</ul></section>;
}
