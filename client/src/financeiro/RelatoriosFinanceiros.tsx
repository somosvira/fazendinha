import { CircleDollarSign, Package, ShieldCheck } from "lucide-react";
import { useCompromissosFinanceiros, useOperacoesFinanceiras } from "./novo-api";
import { brl, ErrorBox, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel, TIPO_OPERACAO } from "./financeiro-ui";

export function RelatoriosFinanceiros() {
  const opsQuery = useOperacoesFinanceiras(); const compsQuery = useCompromissosFinanceiros();
  const ops = opsQuery.data ?? []; const comps = compsQuery.data ?? [];
  const erroQuery = opsQuery.error ?? compsQuery.error;
  const erro = erroQuery ? (erroQuery instanceof Error ? erroQuery.message : String(erroQuery)) : null;
  const confirmadas = ops.filter((o) => o.status === "CONFIRMADA"); const total = confirmadas.reduce((s, o) => s + Number(o.valorTotal), 0); const porTipo = Object.entries(confirmadas.reduce<Record<string, number>>((acc, o) => { acc[o.tipo] = (acc[o.tipo] ?? 0) + Number(o.valorTotal); return acc; }, {})).sort((a, b) => b[1] - a[1]);
  // `||`, não `&&`: os KPIs somam as duas fontes — se uma ficar pausada
  // offline (nunca visitada com esta queryKey) enquanto a outra já resolveu,
  // renderizar cedo demais mostra total/volume como se fossem zero, não como
  // "ainda carregando" (mesma classe de bug de OperacoesFinanceiras.tsx).
  if ((opsQuery.isPending || compsQuery.isPending) && !erro) return <PaginaCarregando label="Carregando relatórios" />;

  return <PaginaFinanceira><PageHeader titulo="Relatórios financeiros" descricao="Leituras auditáveis geradas somente a partir das operações, compromissos, transações e movimentos já registrados." /><ErrorBox erro={erro} />
    <div className="mt-6 grid gap-4 md:grid-cols-3"><Metric label="Operações confirmadas" valor={String(confirmadas.length)} detalhe="Registros ativos" icon={ShieldCheck} /><Metric label="Volume econômico" valor={brl(total)} detalhe="Soma das operações confirmadas" icon={CircleDollarSign} /><Metric label="Com efeito de estoque" valor={String(ops.filter((o) => o.movimentosEstoque?.length).length)} detalhe="Operações rastreadas fisicamente" icon={Package} /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><Panel><div className="border-b border-border p-5"><h2 className="font-serif text-xl">Volume por tipo de operação</h2><p className="mt-1 text-xs text-ink-3">Base econômica confirmada</p></div><div className="divide-y divide-border">{porTipo.map(([tipo, valor]) => <div key={tipo} className="flex justify-between gap-4 p-4 text-sm"><span className="min-w-0 break-words">{TIPO_OPERACAO[tipo] ?? tipo}</span><strong className="shrink-0 whitespace-nowrap">{brl(valor)}</strong></div>)}</div></Panel><Panel><div className="border-b border-border p-5"><h2 className="font-serif text-xl">Rastreabilidade</h2><p className="mt-1 text-xs text-ink-3">Qualidade da base financeira</p></div><div className="space-y-4 p-5 text-sm"><div className="flex justify-between gap-4"><span className="min-w-0 break-words">Compromissos registrados</span><strong className="shrink-0">{comps.length}</strong></div><div className="flex justify-between gap-4"><span className="min-w-0 break-words">Operações canceladas com histórico</span><strong className="shrink-0">{ops.filter((o) => o.status === "CANCELADA").length}</strong></div><div className="flex justify-between gap-4"><span className="min-w-0 break-words">Operações com parceiro identificado</span><strong className="shrink-0">{ops.filter((o) => o.parceiro).length}</strong></div><div className="rounded-lg bg-[#f4f2e9] p-4 text-xs leading-5 text-ink-3">Exportações, conciliação bancária e relatórios documentais não são exibidos porque ainda não possuem implementação real na API.</div></div></Panel></div>
  </PaginaFinanceira>;
}
