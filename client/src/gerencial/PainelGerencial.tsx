import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, CircleAlert, LockKeyhole, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { Button, ErrorBox, PaginaFinanceira, brl, dataBR } from "../financeiro/financeiro-ui";
import { Button as Botao } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { AjudaCampo } from "../components/Dica";
import { classeInput } from "../financeiro/PainelCadastro";
import { consultarResumo, periodoGerencial, hojeGerencial, type Bloco, type ResumoGerencial } from "./api";
import "../financeiro/financeiro-theme.css";
import "./painel-gerencial.css";

const dinheiro = (v: string | null) => v == null ? "Não apurado" : brl(v);
const dinheiroDiario = (v: string | null) => v == null ? "Não apurado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(Number(v));
const numero = (v: string | number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const contagem = (n: number, singular: string, plural: string) => `${numero(n)} ${n === 1 ? singular : plural}`;
const media = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const finalidade = (f: string | null) => ({ REPRODUCAO: "Reprodução", SANIDADE: "Sanidade", ROTINA: "Rotina", SEM_CLASSIFICACAO: "Sem classificação" }[f ?? "SEM_CLASSIFICACAO"] ?? f);

function BlocoPainel<T>({ titulo, bloco, children, id, className = "" }: { titulo: string; bloco: Bloco<T>; children: (dados: T) => ReactNode; id?: string; className?: string }) {
  return <section id={id} tabIndex={-1} className={`ger-card ${className}`} aria-label={titulo}>
    <h2>{titulo}</h2>
    {bloco.estado === "RESTRITO" ? <div className="ger-restrito"><p><LockKeyhole size={17} aria-hidden="true" /> Acesso restrito</p><p>{bloco.motivo}</p></div> : children(bloco.dados)}
  </section>;
}
function Valor({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return <div className="ger-indicador"><dt>{rotulo}</dt><dd>{valor}</dd>{detalhe && <p className="ger-muted">{detalhe}</p>}</div>;
}
function LinkOrigem({ href, children }: { href: string; children: ReactNode }) {
  return <a className="ger-link" href={href}>{children}<ArrowRight size={16} aria-hidden="true" /></a>;
}

const mesBR = (mes: string) => new Intl.DateTimeFormat("pt-BR", {month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${mes.slice(0,7)}-01T12:00:00Z`));
const eixoMonetario = (valor: number) => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL",notation:"compact",maximumFractionDigits:1}).format(valor);
function BarrasHorizontais({titulo,itens,vazio}:{titulo:string;itens:{chave:string;rotulo:string;valor:string;alerta?:boolean}[];vazio:string}) {
  const limite = Math.max(1, ...itens.map(i => Math.abs(Number(i.valor))));
  const temNegativo = itens.some(i => Number(i.valor) < 0);
  return itens.length ? <dl className="ger-barras-diretas" aria-label={titulo}>{itens.map(i => {
    const valor = Number(i.valor);
    const largura = Math.abs(valor) / limite * (temNegativo ? 50 : 100);
    return <div key={i.chave} data-alerta={i.alerta || undefined}><dt>{i.rotulo}</dt><dd><span className="ger-barra-trilho" aria-hidden="true" data-divergente={temNegativo || undefined}><span style={{ width: `${largura}%`, left: `${temNegativo ? valor < 0 ? 50 - largura : 50 : 0}%` }} /></span><strong>{brl(i.valor)}</strong></dd></div>;
  })}</dl> : <p className="ger-vazio">{vazio}</p>;
}

export function PainelGerencial({ locationRevision = 0, propriedadeId, onPeriodo }: { locationRevision?: number; propriedadeId: number | null; onPeriodo: (periodo: { inicio: string; fim: string }) => void }) {
  const [periodo, setPeriodo] = useState(() => periodoGerencial(window.location.search));
  const [edicao, setEdicao] = useState(periodo);
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [dados, setDados] = useState<ResumoGerencial | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => { const p = periodoGerencial(window.location.search); setPeriodo(p); setEdicao(p); }, [locationRevision]);
  useEffect(() => {
    const controle = new AbortController(); let vigente = true; setCarregando(true); setErro(null); setDados(null);
    consultarResumo(periodo.inicio, periodo.fim, controle.signal).then(d => { if (vigente) setDados(d); }).catch(e => { if (vigente && !controle.signal.aborted) setErro(e.message); }).finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; controle.abort(); };
  }, [periodo.inicio, periodo.fim, propriedadeId, revisao]);
  const params = new URLSearchParams({ ...periodo, ...(propriedadeId == null ? {} : { propriedadeId: String(propriedadeId) }) });
  const link = (path: string, extra: Record<string, string> = {}) => `${path}?${new URLSearchParams({ ...Object.fromEntries(params), ...extra })}`;
  return <PaginaFinanceira><div className="painel-gerencial">
    <header className="ger-cabecalho">
      <div><h1>Painel administrativo</h1><p>Visão geral da fazenda.</p></div>
      <div className="ger-filtros"><Popover open={periodoAberto} onOpenChange={aberto => { setPeriodoAberto(aberto); if (aberto) setEdicao(periodo); }}><PopoverTrigger asChild><Botao variant="outline" aria-label="Selecionar período"><CalendarDays size={17} aria-hidden="true" />{dataBR(periodo.inicio)} – {dataBR(periodo.fim)}</Botao></PopoverTrigger><PopoverContent align="end" className="ger-periodo-popover"><form onSubmit={e => { e.preventDefault(); setPeriodo({ ...edicao }); onPeriodo(edicao); setPeriodoAberto(false); }}>
        <h2>Período do painel</h2><div className="ger-periodo-campos"><label>Início<input required type="date" className={classeInput} value={edicao.inicio} max={edicao.fim} onChange={e => setEdicao(p => ({ ...p, inicio: e.target.value }))} /></label>
        <label>Fim<input required type="date" className={classeInput} value={edicao.fim} min={edicao.inicio} max={hojeGerencial()} onChange={e => setEdicao(p => ({ ...p, fim: e.target.value }))} /></label></div>
        <Button type="submit">Aplicar período</Button></form></PopoverContent></Popover><Button secondary type="button" disabled={carregando} onClick={() => setRevisao(r => r + 1)}><RefreshCw size={16} aria-hidden="true" />Atualizar</Button></div>
    </header>
    <p className="ger-contexto">{dados ? <>{dados.escopo.propriedadeId == null ? "Todos os sítios · consolidado" : dados.escopo.sitios[0]?.nome ?? "Sítio selecionado"} <span>· {dataBR(dados.periodo.inicio)} a {dataBR(dados.periodo.fim)} · consulta em {new Date(dados.corte).toLocaleString("pt-BR")}</span></> : "Selecione o sítio no menu da fazenda."}</p>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button>}
    {carregando && <p role="status" className="ger-carregando">Consultando as fontes do painel…</p>}
    {dados && !carregando && <>
      {(dados.compromissos.estado === "DISPONIVEL" && Number(dados.compromissos.dados.vencido) > 0 || dados.clinico.estado === "DISPONIVEL" && dados.clinico.dados.acompanhamentosPendentes > 0) && <aside className="ger-atencao" aria-label="Prioridades atuais">
        {dados.compromissos.estado === "DISPONIVEL" && Number(dados.compromissos.dados.vencido) > 0 && <div><CircleAlert size={20} aria-hidden="true" /><strong>{brl(dados.compromissos.dados.vencido)} vencidos</strong><LinkOrigem href={`/financeiro/compromissos?${new URLSearchParams({situacao:"pagar", ...(propriedadeId == null ? {} : {propriedadeId:String(propriedadeId)})})}`}>Consultar vencimentos</LinkOrigem></div>}
        {dados.clinico.estado === "DISPONIVEL" && dados.clinico.dados.acompanhamentosPendentes > 0 && <div><CircleAlert size={20} aria-hidden="true" /><strong>Pendências reprodutivas: {dados.clinico.dados.acompanhamentosPendentes}<small>Até {dataBR(dados.clinico.dados.data)}</small></strong><LinkOrigem href={link("/pecuaria/reproducao")}>Consultar acompanhamentos</LinkOrigem></div>}
      </aside>}
      <div className="ger-grade">
        <BlocoPainel titulo="Caixa no período" bloco={dados.caixa} className="ger-caixa">{c => <>
          <p className="ger-muted">Valores líquidos de estornos.</p>
          <dl className="ger-caixa-valores"><Valor rotulo="Recebido" valor={brl(c.entradas)} /><Valor rotulo="Pago" valor={brl(c.saidas)} /><Valor rotulo="Resultado de caixa" valor={brl(c.resultado)} /></dl>
          <p className="ger-muted">{contagem(new Set(c.fontes.map(f => f.transacaoId)).size, "transação", "transações")} no período. Resultado de caixa não representa lucro.</p>
          <div className="ger-rodape-link"><LinkOrigem href={link("/financeiro/contas")}>Ver contas</LinkOrigem></div>
        </>}</BlocoPainel>
        <BlocoPainel titulo="Ainda a pagar" bloco={dados.compromissos} className="ger-compromissos">{c => <>
          <p className="ger-muted">Saldo dos compromissos ativos hoje.</p><p className="ger-valor ger-valor-destaque">{brl(c.totalPendente)}</p>
          <dl className="ger-indices"><Valor rotulo="Vencido" valor={brl(c.vencido)} /><Valor rotulo="A vencer" valor={brl(c.aVencer)} /></dl>
          <h3 className="ger-subtitulo">Quando vence o saldo a pagar</h3><BarrasHorizontais titulo="Saldo a pagar por vencimento" itens={c.faixas.map(f => ({...f, alerta:f.chave === "VENCIDO"}))} vazio="Sem saldo a pagar." />
          <p className="ger-muted">Posição em {dataBR(c.data)} · todos os vencimentos, independente do período acima.</p>
          <div className="ger-rodape-link"><LinkOrigem href={`/financeiro/compromissos?${new URLSearchParams({situacao:"pagar", ...(propriedadeId == null ? {} : {propriedadeId:String(propriedadeId)})})}`}>Ver compromissos</LinkOrigem></div>
        </>}</BlocoPainel>
        <BlocoPainel titulo="Recebido e pago por mês" bloco={dados.caixa} className="ger-mensal">{c => <>
          <p className="ger-muted">Valores líquidos de estornos. Meses parciais incluem somente as datas do período selecionado.</p>
          {c.mensal.length ? <>
            {c.mensal.some(m => Number(m.entradas) !== 0 || Number(m.saidas) !== 0) ? <div className="ger-grafico" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart accessibilityLayer={false} data={c.mensal.map(m => ({...m, nome: `${mesBR(m.mes)}${m.incompleto ? "*" : ""}`, Recebido:Number(m.entradas), Pago:Number(m.saidas)}))} margin={{top:12,right:8,left:0,bottom:5}}><CartesianGrid vertical={false} stroke="var(--ger-borda)" /><XAxis dataKey="nome" tick={{fontSize:11}} interval="preserveStartEnd" /><YAxis width={68} tickFormatter={eixoMonetario} tick={{fontSize:10}} /><ReferenceLine y={0} stroke="var(--ger-suave)" /><Legend /><Bar dataKey="Recebido" fill="var(--ger-verde)" isAnimationActive={false} /><Bar dataKey="Pago" fill="var(--ger-saida)" isAnimationActive={false} /></BarChart></ResponsiveContainer></div> : <p className="ger-caixa-zerado">Entradas e saídas líquidas zeradas neste período.</p>}
            <div className="ger-tabela" tabIndex={0} role="region" aria-label="Valores mensais do caixa"><table className="consulta-tabela"><caption>Caixa por mês · * mês parcial</caption><thead><tr><th scope="col">Mês</th><th scope="col">Recebido</th><th scope="col">Pago</th></tr></thead><tbody>{c.mensal.map(m => <tr key={m.mes}><th scope="row">{mesBR(m.mes)}{m.incompleto ? " · parcial" : ""}</th><td>{brl(m.entradas)}</td><td>{brl(m.saidas)}</td></tr>)}</tbody></table></div>
            {!c.fontes.length && <p className="ger-muted">Sem recebimentos ou pagamentos registrados neste período.</p>}
          </> : <p className="ger-vazio">Sem recebimentos ou pagamentos registrados neste período.</p>}
        </>}</BlocoPainel>
        <BlocoPainel titulo="Pagamentos por centro de custo" bloco={dados.caixa} className="ger-centros">{c => <>
          <p className="ger-muted">Total pago no período: {brl(c.saidas)} · líquido de estornos.</p>
          <BarrasHorizontais titulo="Pagamentos por centro de custo" itens={c.centros.map((v,i) => ({chave:v.id ?? `sem-centro-${i}`, rotulo:v.nome, valor:v.saidas}))} vazio="Sem movimentos por centro neste período." />
          <p className="ger-muted">Valores negativos indicam estornos superiores aos pagamentos do centro no período.</p>
          <div className="ger-rodape-link"><LinkOrigem href={link("/financeiro/contas")}>Ver contas</LinkOrigem></div>
        </>}</BlocoPainel>
        <BlocoPainel titulo="Nutrição registrada" bloco={dados.nutricao} className="ger-nutricao">{n => {
          const cobertura = n.cobertura.animalDias > 0 ? n.cobertura.diasAlimentados / n.cobertura.animalDias * 100 : null;
          const percentual = cobertura == null ? "Não apurado" : `${cobertura.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
          return <>
            <div className="ger-valor-linha"><p className="ger-valor">{dinheiro(n.rebanho.custoConhecido)}</p>{n.rebanho.parcial && <span className="ger-selo">Custo parcial</span>}</div>
            <div className="ger-cobertura"><p>{cobertura == null ? "Cobertura de alimentação não apurada." : <>Alimentação registrada em <strong>{percentual}</strong> dos animal-dias.</>}</p>{cobertura != null && <div className="ger-progresso-linha"><progress max={100} value={Math.min(100, Math.max(0, cobertura))} aria-label="Cobertura de alimentação registrada" /><span>{percentual}</span></div>}<p className="ger-muted">{numero(n.cobertura.diasAlimentados)} de {numero(n.cobertura.animalDias)} animal-dias.</p></div>
            <dl className="ger-indices"><Valor rotulo="R$/cabeça/dia" valor={dinheiroDiario(n.rebanho.porDia)} /><Valor rotulo="R$/cabeça no período" valor={dinheiro(n.rebanho.porPeriodo)} /></dl><p className="ger-muted">{media(n.rebanho.populacaoMedia)} cabeças em média.</p>
            <p className="ger-aviso">Ausência de registro não significa consumo zero. A cobertura não comprova classificação nem custo completos.</p>
            <p className="ger-muted">{numero(n.cobertura.diasClassificados)} de {numero(n.cobertura.animalDias)} animal-dias com classificação comprovada · {contagem(n.cobertura.itensPendentes,"componente pendente","componentes pendentes")}.</p>
            {n.lacunas.length > 0 && <p className="ger-aviso">{contagem(n.lacunas.length,"divergência histórica","divergências históricas")} limita a apuração neste período.</p>}
            <div className="ger-rodape-link"><LinkOrigem href={link("/pecuaria/nutricao")}>Ver nutrição</LinkOrigem></div>
          </>;
        }}</BlocoPainel>
        <BlocoPainel titulo="Custos diretos registrados" bloco={dados.custos} className="ger-custos">{c => <>
          <p className="ger-valor">{dinheiro(c.totalConhecido)}</p>
          {c.componentesPendentes > 0 && <p className="ger-pendente"><CircleAlert size={17} aria-hidden="true" />{contagem(c.componentesPendentes, "componente", "componentes")} com valor pendente</p>}
          {c.lacunasNutricao > 0 && <p className="ger-aviso">Há {c.lacunasNutricao} participações nutricionais sem recorte conciliável; este total é parcial.</p>}
          <dl className="ger-finalidades">{c.finalidades.map(f => <div key={f.finalidade}><dt>{finalidade(f.finalidade)}{f.componentesPendentes > 0 && <small>{contagem(f.componentesPendentes,"pendente","pendentes")}</small>}</dt><dd>{dinheiro(f.totalConhecido)}</dd>{f.totalConhecido != null && Number(f.totalConhecido) > 0 && <span className="ger-finalidade-barra" aria-hidden="true"><span style={{ width: `${Number(f.totalConhecido) / Math.max(1, ...c.finalidades.map(v => Number(v.totalConhecido ?? 0))) * 100}%` }} /></span>}</div>)}</dl>
          <p className="ger-muted">Custos sem atribuição operacional não são distribuídos entre animais.</p>
          {c.cobertura === "PARCIAL" && <p className="ger-muted">Valores parciais.</p>}
        </>}</BlocoPainel>
        <BlocoPainel titulo={`Estoque atual em ${dados.estoque.estado === "DISPONIVEL" ? dataBR(dados.estoque.dados.data) : "data de referência"}`} bloco={dados.estoque} className="ger-estoque">{e => <>
          <p className="ger-valor">{dinheiro(e.valorConhecido)}</p>
          <p>{contagem(new Set(e.itens.map(i => i.produtoId)).size,"produto","produtos")} · {e.gruposPendentes ? `${contagem(e.gruposPendentes,"grupo","grupos")} com valor pendente` : "sem valor pendente neste recorte"}.</p>
          {e.situacao === "PARCIAL" && <p className="ger-aviso">Valor parcial: há grupos com valor pendente.</p>}
          {e.situacao === "DESCONHECIDO" && <p className="ger-aviso">Valor não apurado: os grupos em estoque não têm valor conhecido.</p>}
          <p className="ger-muted">O estoque usa a data de referência indicada.</p><div className="ger-rodape-link"><LinkOrigem href={propriedadeId == null ? "/estoque" : `/estoque?${new URLSearchParams({propriedadeId:String(propriedadeId)})}`}>Ver estoque</LinkOrigem></div>
        </>}</BlocoPainel>
        {(dados.clinico.estado === "RESTRITO" || dados.clinico.dados.acompanhamentosPendentes === 0) && <BlocoPainel<{ data: string; acompanhamentosPendentes: number }> titulo="Pontos de atenção" bloco={dados.clinico} className="ger-clinico">{c => <><p>{c.acompanhamentosPendentes} acompanhamentos reprodutivos pendentes até {dataBR(c.data)}.</p><div className="ger-rodape-link"><LinkOrigem href={link("/pecuaria/reproducao")}>Ver reprodução</LinkOrigem></div></>}</BlocoPainel>}
      </div>
      <div className="ger-nota"><AjudaCampo rotulo="Sobre as leituras do painel" texto="Caixa, consumo e estoque representam momentos diferentes e não devem ser somados. Nutrição já integra os custos diretos; não some novamente. Não apurado preserva um valor desconhecido; zero representa zero comprovado." />Sobre as leituras do painel</div>
    </>}
  </div></PaginaFinanceira>;
}
