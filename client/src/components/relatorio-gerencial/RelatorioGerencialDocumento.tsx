/* Documento do relatório gerencial — o MESMO nó serve de pré-visualização e de
 * fonte do PDF (html2pdf). Identidade Terrano: papel creme, Newsreader nos
 * títulos, DM Sans no corpo, latão nos eyebrows. Estilos em base.css (.rg-*). */
import { forwardRef, type ReactNode } from "react";
import { TerranoSymbol } from "../TerranoLogo";
import { fmtMoneyExact } from "../charts";
import { ROTULO_ATIVIDADE, ROTULO_MES, ROTULO_REGIME, ROTULO_TIPO } from "./export";
import { rotuloSecao, secoesVisiveis } from "./template";
import type { BlocoCompromisso, RelatorioGerencialDTO, SecaoId, TemplateRelatorio } from "./types";

const dataBR = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${a}`; };
const dataHoraBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const money = (n: number) => fmtMoneyExact(n);
const sinal = (n: number) => (n < 0 ? "rg-neg" : n > 0 ? "rg-pos" : "");

function Vazio() {
  return <p className="rg-vazio">Sem registros no período</p>;
}

function Secao({ id, regime, children }: { id: SecaoId; regime: "Realizado" | "Previsto" | "Recorte"; children: ReactNode }) {
  const titulo = rotuloSecao(id);
  return (
    <section className="rg-secao rg-bloco" role="region" aria-labelledby={`rg-sec-${id}`}>
      <div className="rg-secao-cabecalho">
        <span className={`rg-regime rg-regime-${regime.toLowerCase()}`}>{regime}</span>
        <h2 id={`rg-sec-${id}`}>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Kpi({ rotulo, valor, className }: { rotulo: string; valor: string; className?: string }) {
  return <div className="rg-kpi"><span className="rg-kpi-rotulo">{rotulo}</span><strong className={className}>{valor}</strong></div>;
}

function TabelaCompromissos({ titulo, bloco }: { titulo: string; bloco: BlocoCompromisso }) {
  return (
    <div className="rg-bloco">
      <h3>{titulo} <small>{bloco.quantidade} {bloco.quantidade === 1 ? "título" : "títulos"} · vencido {money(bloco.vencido)} · a vencer {money(bloco.aVencer)}</small></h3>
      {bloco.itens.length === 0 ? <Vazio /> : (
        <table className="rg-tabela">
          <thead><tr><th>Descrição</th><th>Fornecedor/cliente</th><th>Categoria</th><th>Vencimento</th><th className="num">Valor</th><th>Situação</th></tr></thead>
          <tbody>
            {bloco.itens.map((i) => <tr key={i.id}><td>{i.descricao ?? "—"}</td><td>{i.fornecedor ?? "—"}</td><td>{i.categoria}</td><td className="rg-data">{dataBR(i.dataVencimento)}</td><td className="num">{money(i.valor)}</td><td>{i.vencido ? `Vencido há ${i.diasAtraso} d` : "A vencer"}</td></tr>)}
          </tbody>
          <tfoot><tr><td colSpan={4}>Total</td><td className="num">{money(bloco.total)}</td><td /></tr></tfoot>
        </table>
      )}
      {bloco.quantidade > bloco.itens.length && <p className="rg-nota">Lista limitada a {bloco.itens.length} títulos; os totais consideram todos os {bloco.quantidade}.</p>}
    </div>
  );
}

function renderSecao(id: SecaoId, dto: RelatorioGerencialDTO): ReactNode {
  switch (id) {
    case "resumo": {
      const r = dto.resumo;
      return (
        <Secao id={id} regime={r.entradas != null ? "Realizado" : "Previsto"}>
          {r.entradas != null && (
            <div className="rg-kpis">
              <Kpi rotulo="Entradas realizadas" valor={money(r.entradas)} />
              <Kpi rotulo="Saídas realizadas" valor={money(r.saidas ?? 0)} />
              <Kpi rotulo="Resultado do período" valor={money(r.resultado ?? 0)} className={sinal(r.resultado ?? 0)} />
              <Kpi rotulo="Saldo das contas no fim do período" valor={money(r.saldoContasFinal ?? 0)} />
            </div>
          )}
          {r.entradas != null && <p className="rg-nota">{r.nLancamentos ?? 0} lançamentos realizados no período. Saldo derivado exclusivamente dos movimentos liquidados das contas.</p>}
          {r.aPagar != null && (
            <div className="rg-kpis rg-kpis-previsto">
              <Kpi rotulo="Previsto — a pagar" valor={money(r.aPagar)} />
              <Kpi rotulo="Previsto — a receber" valor={money(r.aReceber ?? 0)} />
            </div>
          )}
          {r.aPagar != null && <p className="rg-nota">Compromissos futuros não são somados ao saldo atual.</p>}
        </Secao>
      );
    }
    case "saldoContas": {
      const s = dto.saldoContas;
      if (!s) return null;
      return (
        <Secao id={id} regime="Realizado">
          {s.contas.length === 0 ? <Vazio /> : (
            <table className="rg-tabela">
              <thead><tr><th>Conta</th><th>Banco</th><th className="num">Saldo inicial</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Saldo final</th></tr></thead>
              <tbody>{s.contas.map((c) => <tr key={c.id}><td>{c.nome}</td><td>{c.banco ?? "—"}</td><td className="num">{money(c.saldoInicial)}</td><td className="num">{money(c.entradas)}</td><td className="num">{money(c.saidas)}</td><td className={`num ${sinal(c.saldoFinal)}`}>{money(c.saldoFinal)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={2}>Total</td><td className="num">{money(s.total.saldoInicial)}</td><td className="num">{money(s.total.entradas)}</td><td className="num">{money(s.total.saidas)}</td><td className="num">{money(s.total.saldoFinal)}</td></tr></tfoot>
            </table>
          )}
          <p className="rg-nota">Saldo inicial = saldo de abertura da conta + movimentos liquidados antes do período. Transferências entre contas movem saldo, mas não entram em entradas e saídas operacionais.</p>
        </Secao>
      );
    }
    case "entradasSaidas": {
      const e = dto.entradasSaidas;
      if (!e) return null;
      const temMovimento = e.total.entradas !== 0 || e.total.saidas !== 0;
      return (
        <Secao id={id} regime="Realizado">
          {!temMovimento ? <Vazio /> : (
            <table className="rg-tabela">
              <thead><tr><th>Mês</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Resultado</th></tr></thead>
              <tbody>{e.meses.map((m) => <tr key={m.mes}><td>{ROTULO_MES(m.mes)}</td><td className="num">{money(m.entradas)}</td><td className="num">{money(m.saidas)}</td><td className={`num ${sinal(m.resultado)}`}>{money(m.resultado)}</td></tr>)}</tbody>
              <tfoot><tr><td>Total</td><td className="num">{money(e.total.entradas)}</td><td className="num">{money(e.total.saidas)}</td><td className={`num ${sinal(e.total.resultado)}`}>{money(e.total.resultado)}</td></tr></tfoot>
            </table>
          )}
        </Secao>
      );
    }
    case "resultado": {
      const r = dto.resultado;
      if (!r) return null;
      return (
        <Secao id={id} regime="Realizado">
          {r.porAtividade.length === 0 || (r.receita === 0 && r.custeio === 0 && r.investimento === 0) ? <Vazio /> : (
            <table className="rg-tabela">
              <thead><tr><th>Atividade</th><th className="num">Receita</th><th className="num">Custeio</th><th className="num">Investimento</th><th className="num">Resultado</th></tr></thead>
              <tbody>{r.porAtividade.map((a) => <tr key={a.atividade}><td>{ROTULO_ATIVIDADE[a.atividade] ?? a.atividade}</td><td className="num">{money(a.receita)}</td><td className="num">{money(a.custeio)}</td><td className="num">{money(a.investimento)}</td><td className={`num ${sinal(a.resultado)}`}>{money(a.resultado)}</td></tr>)}</tbody>
              <tfoot><tr><td>Total</td><td className="num">{money(r.receita)}</td><td className="num">{money(r.custeio)}</td><td className="num">{money(r.investimento)}</td><td className={`num ${sinal(r.resultado)}`}>{money(r.resultado)}</td></tr></tfoot>
            </table>
          )}
        </Secao>
      );
    }
    case "compromissos": {
      const c = dto.compromissos;
      if (!c) return null;
      return (
        <Secao id={id} regime="Previsto">
          <p className="rg-nota">Títulos em aberto com vencimento no período, posição em {dataBR(c.hoje)}. Não compõem o saldo realizado.</p>
          <TabelaCompromissos titulo="A pagar" bloco={c.aPagar} />
          <TabelaCompromissos titulo="A receber" bloco={c.aReceber} />
        </Secao>
      );
    }
    case "categorias": {
      const c = dto.categorias;
      if (!c) return null;
      return (
        <Secao id={id} regime="Realizado">
          <div className="rg-bloco">
            <h3>Por grupo e categoria</h3>
            {c.grupos.length === 0 ? <Vazio /> : (
              <table className="rg-tabela">
                <thead><tr><th>Grupo / categoria</th><th className="num">Total</th><th className="num">% das saídas</th></tr></thead>
                <tbody>{c.grupos.flatMap((g) => [
                  <tr key={g.grupo} className="rg-grupo"><td>{g.grupo}</td><td className="num">{money(g.total)}</td><td className="num">{g.pct.toLocaleString("pt-BR")}%</td></tr>,
                  ...g.categorias.map((k) => <tr key={`${g.grupo}/${k.categoria}`}><td className="rg-recuo">{k.categoria}</td><td className="num">{money(k.total)}</td><td className="num">{k.pct.toLocaleString("pt-BR")}%</td></tr>),
                ])}</tbody>
              </table>
            )}
          </div>
          <div className="rg-bloco">
            <h3>Por centro de custo</h3>
            {c.centros.length === 0 ? <Vazio /> : (
              <table className="rg-tabela">
                <thead><tr><th>Centro de custo</th><th className="num">Total</th><th className="num">% das saídas</th></tr></thead>
                <tbody>{c.centros.map((k) => <tr key={k.centro}><td>{k.centro}</td><td className="num">{money(k.total)}</td><td className="num">{k.pct.toLocaleString("pt-BR")}%</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </Secao>
      );
    }
    case "operacoes": {
      const comMovimento = dto.operacoes.filter((o) => o.quantidade > 0);
      return (
        <Secao id={id} regime="Recorte">
          {comMovimento.length === 0 ? <Vazio /> : (
            <table className="rg-tabela">
              <thead><tr><th>Tipo</th><th className="num">Quantidade</th><th className="num">Valor</th><th>Entra nos totais</th></tr></thead>
              <tbody>{comMovimento.map((o) => <tr key={o.tipo}><td>{ROTULO_TIPO[o.tipo]}</td><td className="num">{o.quantidade}</td><td className="num">{money(o.valor)}</td><td>{o.entraNoTotal ? "Sim" : "Não"}</td></tr>)}</tbody>
            </table>
          )}
          <p className="rg-nota">Estornos, liquidações parciais, transferências e compromissos em aberto são listados para auditoria e não inflam os totais realizados.</p>
        </Secao>
      );
    }
    case "rastreabilidade": {
      const r = dto.rastreabilidade;
      return (
        <Secao id={id} regime="Recorte">
          <dl className="rg-lista">
            <div><dt>Lançamentos no recorte</dt><dd>{r.totalLancamentos}</dd></div>
            <div><dt>Estornados (fora dos totais)</dt><dd>{r.estornados}</dd></div>
            <div><dt>Com número de documento</dt><dd>{r.comDocumento}</dd></div>
            <div><dt>Sem número de documento</dt><dd>{r.semDocumento}</dd></div>
            <div><dt>Com nota fiscal anexada</dt><dd>{r.comNotaFiscal}</dd></div>
            <div><dt>Sem nota fiscal anexada</dt><dd>{r.semNotaFiscal}</dd></div>
            <div><dt>Sem centro de custo (transferências)</dt><dd>{r.semCentroCusto}</dd></div>
            <div><dt>Meses fechados</dt><dd>{r.mesesFechados.map(ROTULO_MES).join(", ") || "nenhum"}</dd></div>
            <div><dt>Meses abertos</dt><dd>{r.mesesAbertos.map(ROTULO_MES).join(", ") || "nenhum"}</dd></div>
          </dl>
        </Secao>
      );
    }
  }
}

export const RelatorioGerencialDocumento = forwardRef<HTMLDivElement, { dto: RelatorioGerencialDTO; template: TemplateRelatorio }>(
  function RelatorioGerencialDocumento({ dto, template }, ref) {
    const escopo = dto.meta.propriedade?.nome ?? "Consolidado (todas as propriedades)";
    const periodo = `${dataBR(dto.meta.periodo.inicio)} a ${dataBR(dto.meta.periodo.fim)}`;
    const regime = `Regime: ${ROTULO_REGIME[dto.meta.regime]}`;
    return (
      <article ref={ref} className="rg-doc">
        <header className="rg-capa rg-bloco">
          <div className="rg-marca"><TerranoSymbol size={34} tone="light" strokeWidth={4.4} /><span>Terrano · Fazenda Rio Novo</span></div>
          <p className="rg-eyebrow">Financeiro · Relatório gerencial</p>
          <h1>{template.titulo}</h1>
          {template.subtitulo && <p className="rg-subtitulo">{template.subtitulo}</p>}
          <p className="rg-meta">Gerado em {dataHoraBR(dto.meta.geradoEm)} · {escopo} · Período {periodo} · {regime}</p>
        </header>
        {secoesVisiveis(template, dto.meta.regime).map((id) => <div key={id}>{renderSecao(id, dto)}</div>)}
        {template.observacoes && (
          <section className="rg-secao rg-bloco" aria-label="Observações">
            <div className="rg-secao-cabecalho"><h2>Observações</h2></div>
            <p className="rg-observacoes">{template.observacoes}</p>
          </section>
        )}
        <footer className="rg-rodape">
          Filtros: {escopo} · {periodo} · {regime}. Valores em reais, regime de caixa; estornos excluídos. Documento gerencial, sem valor contábil ou fiscal.
        </footer>
      </article>
    );
  },
);
