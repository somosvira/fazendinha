import { MonetaryDonutChart } from "../components/charts";
import { navegarPara } from "../router";
import type { BaseFinanceira, DashboardFinanceiro } from "./novo-api";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { brl, Panel, TIPO_OPERACAO } from "./financeiro-ui";

const estados = (values: Record<string, number>, names: [string, string][]) => names.map(([key, label]) => `${label}: ${values[key] ?? 0}`).join(" · ");
/** Mesmo padrão de clique-modificado dos links da tabela: navega no SPA, mas
 * segue como link de verdade (nova aba, abrir com o teclado etc.). */
function LinkPeriodo({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navegarPara(href); } }} className="font-semibold text-green-800 underline underline-offset-4">{children}</a>;
}
/** Contagem de apoio da rastreabilidade. `alerta` destaca só quando há registros sem o vínculo esperado. */
function IndicadorBase({ label, valor, href, alerta = false }: { label: string; valor: number; href?: string; alerta?: boolean }) {
  const destacado = alerta && valor > 0;
  return <div className={`min-w-0 rounded-lg border p-3 ${destacado ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
    <dt className={`break-words text-xs ${destacado ? "text-red-800" : "text-ink-3"}`}>{label}</dt>
    <dd className={`mt-1 font-serif text-2xl leading-none tabular-nums ${destacado ? "text-red-800" : ""}`}>{href ? <LinkPeriodo href={href}>{valor}</LinkPeriodo> : valor}</dd>
  </div>;
}
export function BaseFinanceiraResumo({ base, realizado, compromissos, inicio, fim }: { base: BaseFinanceira; realizado: DashboardFinanceiro["realizado"]; compromissos: DashboardFinanceiro["compromissos"]; inicio: string; fim: string }) {
  const query = new URLSearchParams({ inicio, fim }).toString();
  const rows = [
    { label: "Operações", total: base.operacoes.total, href: `/financeiro/operacoes?${query}`, detail: estados(base.operacoes.estados, [["CONFIRMADA", "Confirmadas"], ["RASCUNHO", "Rascunhos"], ["CANCELADA", "Canceladas"]]), value: `Volume econômico confirmado: ${brl(base.volumeEconomico)}` },
    { label: "Compromissos", total: base.compromissos.total, href: `/financeiro/compromissos?${query}&situacao=todos`, detail: estados(base.compromissos.estados, [["PENDENTE", "Pendentes"], ["PARCIAL", "Parciais"], ["LIQUIDADO", "Liquidados"], ["CANCELADO", "Cancelados"]]), value: `Saldo pendente por vencimento: a pagar ${brl(compromissos.aPagar)} · a receber ${brl(compromissos.aReceber)}` },
    { label: "Transações", total: base.transacoes.total, href: `/financeiro/contas?${query}#extrato-geral`, detail: `${estados(base.transacoes.estados, [["CONFIRMADA", "Confirmadas (inclui estornos)"], ["REVERTIDA", "Revertidas"]])} · Estornos: ${base.transacoes.estornos} · Com liquidação: ${base.transacoes.comLiquidacao}`, value: `Dinheiro realizado líquido: recebimentos ${brl(realizado.entradas)} · pagamentos ${brl(realizado.saidas)}` },
    { label: "Movimentos de conta", total: base.movimentos.total, href: `/financeiro/contas?${query}#extrato-geral`, detail: `Confirmados: ${base.movimentos.confirmados} · Revertidos: ${base.movimentos.revertidos} · Estornos: ${base.movimentos.estornos}`, value: "Inclui as duas pontas das transferências, sem somá-las ao realizado." },
  ];
  return <section className="mt-6" aria-labelledby="base-financeira-titulo">
    <h2 id="base-financeira-titulo" className="font-serif text-2xl">Base financeira</h2>
    <Panel className="mt-4 overflow-hidden">
      <div className="border-b border-border p-5"><h3 className="font-serif text-xl">Rastreabilidade</h3><p className="mt-1 text-xs text-ink-3">Cada etapa tem sua própria contagem e grandeza financeira.</p></div>
      <dl className="divide-y divide-border">{rows.map(row => <div key={row.label} className="grid gap-2 p-5 md:grid-cols-[180px_minmax(0,1fr)]"><dt><LinkPeriodo href={row.href}>{row.label}: {row.total}</LinkPeriodo></dt><dd className="min-w-0 space-y-1 text-sm"><p className="break-words">{row.detail}</p><p className="break-words text-ink-3">{row.value}</p></dd></div>)}</dl>
      <div className="space-y-4 border-t border-border bg-surface-2 p-5 text-sm">
        <div><h4 className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">Operações</h4><dl className="mt-2 grid gap-3 sm:grid-cols-3">
          <IndicadorBase label="Com efeito de estoque" valor={base.operacoes.comEstoque} />
          <IndicadorBase label="Sem parceiro" valor={base.operacoes.semParceiro} />
          <IndicadorBase label="Sem efeitos vinculados" valor={base.operacoes.semEfeitos} href={`/financeiro/operacoes?${query}&efeito=SEM_EFEITOS`} />
        </dl></div>
        <div><h4 className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">Transações</h4><dl className="mt-2 grid gap-3 sm:grid-cols-3">
          <IndicadorBase label="Avulsas (sem operação)" valor={base.transacoes.avulsas} />
          <IndicadorBase label="Sem movimento de conta" valor={base.transacoes.semMovimentos} alerta />
          <IndicadorBase label="Transferências sem as duas pontas" valor={base.transacoes.transferenciasIncompletas} alerta />
        </dl></div>
        <p className="text-xs text-ink-3">Parceiro, compromisso e efeito de estoque são opcionais conforme o fato de negócio.</p>
        {!!base.vinculosAusentes?.length && <div><p className="text-xs text-ink-3">Registros sem o vínculo esperado (até 20):</p><ul className="mt-2 space-y-2">{base.vinculosAusentes.map(item => <li key={item.transacaoId}>Transação #{item.transacaoSeq} · {item.motivo}{item.operacaoId != null && item.operacaoNumero != null && <> · <LinkOperacaoFinanceira id={item.operacaoId} numero={item.operacaoNumero} /></>}</li>)}</ul></div>}
      </div>
    </Panel>
    <Panel className="mt-4 overflow-hidden"><div className="border-b border-border p-5"><h3 className="font-serif text-xl">Volume por tipo de operação</h3><p className="mt-1 text-xs text-ink-3">Volume econômico confirmado no período; cancelamentos excluídos.</p></div><MonetaryDonutChart label="Volume por tipo de operação" emptyLabel="Nenhuma operação confirmada com volume no período." data={base.porTipo.map(item => ({ label: TIPO_OPERACAO[item.tipo] ?? item.tipo, value: Number(item.valor) }))} /></Panel>
  </section>;
}
