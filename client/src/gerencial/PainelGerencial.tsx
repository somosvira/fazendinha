import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CircleAlert, LockKeyhole } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Button, ErrorBox, PaginaFinanceira, brl, dataBR } from "../financeiro/financeiro-ui";
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
    {bloco.estado === "RESTRITO" ? <div className="ger-restrito"><p><LockKeyhole size={17} aria-hidden="true" /> Acesso restrito</p><details><summary>Entender a restrição</summary><p>{bloco.motivo}</p></details></div> : children(bloco.dados)}
  </section>;
}
function Detalhes<T>({ titulo, itens, children, id }: { titulo: string; itens: T[]; children: (item: T, i: number) => ReactNode; id?: string }) {
  const [limite, setLimite] = useState(10);
  return <details id={id} className="ger-detalhes"><summary>{titulo} · {itens.length}</summary><div className="ger-detalhes-conteudo">{itens.length ? itens.slice(0, limite).map(children) : <p className="ger-muted">Sem fatos neste recorte.</p>}{limite < itens.length && <Button secondary onClick={() => setLimite(l => l + 20)}>Mostrar mais</Button>}</div></details>;
}
function Valor({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return <div className="ger-indicador"><dt>{rotulo}</dt><dd>{valor}</dd>{detalhe && <p className="ger-muted">{detalhe}</p>}</div>;
}
function LinkOrigem({ href, children }: { href: string; children: ReactNode }) {
  return <a className="ger-link" href={href}>{children}<ArrowRight size={16} aria-hidden="true" /></a>;
}

export function PainelGerencial({ locationRevision = 0, propriedadeId, onPeriodo }: { locationRevision?: number; propriedadeId: number | null; onPeriodo: (periodo: { inicio: string; fim: string }) => void }) {
  const [periodo, setPeriodo] = useState(() => periodoGerencial(window.location.search));
  const [edicao, setEdicao] = useState(periodo);
  const [dados, setDados] = useState<ResumoGerencial | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [secao, setSecao] = useState("ger-visao");
  useEffect(() => { const p = periodoGerencial(window.location.search); setPeriodo(p); setEdicao(p); }, [locationRevision]);
  useEffect(() => {
    const controle = new AbortController(); let vigente = true; setCarregando(true); setErro(null); setDados(null);
    consultarResumo(periodo.inicio, periodo.fim, controle.signal).then(d => { if (vigente) setDados(d); }).catch(e => { if (vigente && !controle.signal.aborted) setErro(e.message); }).finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; controle.abort(); };
  }, [periodo.inicio, periodo.fim, propriedadeId, revisao]);
  const params = new URLSearchParams({ ...periodo, ...(propriedadeId == null ? {} : { propriedadeId: String(propriedadeId) }) });
  const link = (path: string, extra: Record<string, string> = {}) => `${path}?${new URLSearchParams({ ...Object.fromEntries(params), ...extra })}`;
  const irPara = (id: string) => { setSecao(id); const alvo = document.getElementById(id); alvo?.scrollIntoView?.({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); alvo?.focus({ preventScroll: true }); };
  const origemCusto = (v: Extract<ResumoGerencial["custos"], { estado: "DISPONIVEL" }>["dados"]["componentes"][number]) => {
    if (v.tipoFonte === "NUTRICAO") {
      const fechamento = dados?.nutricao.estado === "DISPONIVEL" ? dados.nutricao.dados.fontes.find(f => f.participacaoId === v.fonteId)?.fechamentoId : undefined;
      return link("/pecuaria/nutricao", { ...(fechamento ? { fechamentoId: fechamento } : {}), propriedadeId: String(v.propriedadeId) });
    }
    return v.tipoFonte === "TENTATIVA" ? link("/pecuaria/reproducao", { animalId: v.animalId, fatoId: v.fonteId, propriedadeId: String(v.propriedadeId) }) : link("/pecuaria/sanidade", { detalheTipo: v.tipoFonte === "EXAME" ? "exame" : v.tipoFonte === "APLICACAO" ? "aplicacao" : "execucao", detalheId: v.fonteId, propriedadeId: String(v.propriedadeId) });
  };
  return <PaginaFinanceira><div className="painel-gerencial">
    <header className="ger-cabecalho">
      <div><h1>Painel administrativo</h1><p>Valores registrados, contexto e origens.</p></div>
      <form className="ger-filtros" onSubmit={e => { e.preventDefault(); setPeriodo({ ...edicao }); onPeriodo(edicao); }}>
        <label>Início<input required type="date" className={classeInput} value={edicao.inicio} max={edicao.fim} onChange={e => setEdicao(p => ({ ...p, inicio: e.target.value }))} /></label>
        <label>Fim<input required type="date" className={classeInput} value={edicao.fim} min={edicao.inicio} max={hojeGerencial()} onChange={e => setEdicao(p => ({ ...p, fim: e.target.value }))} /></label>
        <Button type="submit">Aplicar período</Button><Button secondary type="button" disabled={carregando} onClick={() => setRevisao(r => r + 1)}>Atualizar</Button>
      </form>
    </header>
    <p className="ger-contexto">{dados ? <>{dados.escopo.propriedadeId == null ? "Todos os sítios · consolidado" : dados.escopo.sitios[0]?.nome ?? "Sítio selecionado"} <span>· {dataBR(dados.periodo.inicio)} a {dataBR(dados.periodo.fim)} · consulta em {new Date(dados.corte).toLocaleString("pt-BR")}</span></> : "Selecione o sítio no menu da fazenda."}</p>
    <nav className="ger-atalhos" aria-label="Seções do painel">{[["ger-visao", "Visão geral"], ["ger-centros", "Centros de custo"], ["ger-nutricao", "Nutrição"], ["ger-estoque", "Estoque"]].map(([id, titulo]) => <button key={id} type="button" aria-current={secao === id ? "location" : undefined} onClick={() => irPara(id)}>{titulo}</button>)}</nav>
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button>}
    {carregando && <p role="status" className="ger-carregando">Consultando as fontes do painel…</p>}
    {dados && !carregando && <>
      <div className="ger-grade">
        <BlocoPainel titulo="Caixa no período" bloco={dados.caixa} id="ger-visao" className="ger-caixa">{c => <>
          <div className="ger-caixa-resumo"><p className="ger-muted">{contagem(new Set(c.fontes.map(f => f.transacaoId)).size, "transação", "transações")} no período · valores líquidos de estornos.</p><dl className="ger-caixa-valores"><Valor rotulo="Recebido" valor={brl(c.entradas)} /><Valor rotulo="Pago" valor={brl(c.saidas)} /><Valor rotulo="Resultado de caixa" valor={brl(c.resultado)} /></dl></div>
        </>}</BlocoPainel>
        <BlocoPainel titulo="Caixa por centro de custo" bloco={dados.caixa} id="ger-centros" className="ger-centros">{c => <>
          <p className="ger-muted">Valores realizados no período.</p><div className="ger-tabela"><table><caption className="sr-only">Caixa por centro de custo</caption><thead><tr><th scope="col">Centro</th><th scope="col">Recebido</th><th scope="col">Pago</th><th scope="col">Resultado</th></tr></thead><tbody>{c.centros.map((v, i) => <tr key={v.id ?? i}><th scope="row">{v.nome}</th><td>{brl(v.entradas)}</td><td>{brl(v.saidas)}</td><td>{brl(v.resultado)}</td></tr>)}{!c.centros.length && <tr><td colSpan={4}>Sem movimentos por centro neste período.</td></tr>}</tbody></table></div>
          <Detalhes titulo="Transações de origem" itens={c.fontes}>{(v, i) => <a key={i} className="ger-origem" href={link(`/financeiro/contas/${v.contaId}`, { propriedadeId: String(v.propriedadeId) }) + `#movimento-${v.movimentoId}`}>{dataBR(v.data)} · {v.campo === "entradas" ? "Recebimento" : "Pagamento"} · {brl(v.valor)} · {v.transacaoId}</a>}</Detalhes>
        </>}</BlocoPainel>
        <BlocoPainel titulo="Nutrição registrada" bloco={dados.nutricao} id="ger-nutricao" className="ger-nutricao">{n => {
          const cobertura = n.cobertura.animalDias > 0 ? n.cobertura.diasAlimentados / n.cobertura.animalDias * 100 : null;
          const percentual = cobertura == null ? "Não apurado" : `${cobertura.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
          return <>
            <div className="ger-valor-linha"><p className="ger-valor ger-valor-destaque">{dinheiro(n.rebanho.custoConhecido)}</p>{n.rebanho.parcial && <span className="ger-selo">Cobertura parcial</span>}</div>
            <div className="ger-cobertura"><p>{cobertura == null ? "Cobertura de alimentação não apurada." : <>Alimentação registrada em <strong>{percentual}</strong> dos animal-dias.</>}</p>{cobertura != null && <div className="ger-progresso-linha"><progress max={100} value={Math.min(100, Math.max(0, cobertura))} aria-label="Cobertura de alimentação registrada" /><span>{percentual}</span></div>}<p className="ger-muted">{numero(n.cobertura.diasAlimentados)} de {numero(n.cobertura.animalDias)} animal-dias no período.</p><p className="ger-muted">Os valores refletem apenas os registros disponíveis.</p></div>
            {n.rebanho.parcial && <p className="ger-aviso" role="status">Subtotal parcial: ausência de registro não significa consumo zero. A cobertura não comprova classificação nem custo completos.</p>}
            <dl className="ger-indices"><Valor rotulo="R$/cabeça/dia" valor={dinheiroDiario(n.rebanho.porDia)} /><Valor rotulo="R$/cabeça no período" valor={dinheiro(n.rebanho.porPeriodo)} /></dl><p className="ger-muted">{media(n.rebanho.populacaoMedia)} cabeças em média.</p>
            <div className="ger-rodape-link"><LinkOrigem href={link("/pecuaria/nutricao")}>Conferir registros de consumo</LinkOrigem></div>
            <details className="ger-detalhes"><summary>Detalhes da nutrição</summary><div className="ger-detalhes-conteudo"><details className="ger-detalhes"><summary>Vacas · secas e lactantes</summary><div className="ger-detalhes-conteudo"><p className="ger-muted">População com paridade comprovada; numerador exclusivo das vacas.</p>{n.vacas.parcial && <p className="ger-aviso">Cobertura parcial das vacas.</p>}<dl className="ger-vacas"><Valor rotulo="Consumo das vacas" valor={dinheiro(n.vacas.custoConhecido)} /><Valor rotulo="R$/vaca/dia" valor={dinheiroDiario(n.vacas.porDia)} /><Valor rotulo="R$/vaca no período" valor={dinheiro(n.vacas.porPeriodo)} /></dl><p>{media(n.vacas.populacaoMedia)} vacas em média · {numero(n.vacas.animalDias)} vaca-dias.</p></div></details>
            <details className="ger-detalhes"><summary>Cobertura do cálculo</summary><div className="ger-detalhes-conteudo"><p>{n.cobertura.diasAlimentados} / {n.cobertura.animalDias} animal-dias com alimentação registrada.</p><p>{n.cobertura.diasClassificados} / {n.cobertura.animalDias} animal-dias com classificação comprovada.</p><p>{contagem(n.cobertura.itensComCusto, "componente", "componentes")} com custo · {contagem(n.cobertura.itensPendentes, "pendente", "pendentes")}.</p>{n.cobertura.quantidades.map(q => <p key={q.unidade}>{numero(q.quantidadeConhecida)} {q.unidade} com custo · {numero(q.quantidadePendente)} {q.unidade} pendentes.</p>)}<p className="ger-muted">{n.metodologia}</p></div></details>
            <Detalhes titulo="Origens e atribuições da nutrição" itens={n.fontes}>{(f, i) => <div key={i} className="ger-fato"><a className="ger-origem" href={link("/pecuaria/nutricao", { fechamentoId: f.fechamentoId, propriedadeId: String(f.propriedadeId) })}>Fechamento de consumo · {f.centroCustoNome}</a><p>{finalidade(f.finalidade)} · {numero(f.quantidade)} {f.unidade} · {dinheiro(f.custoConhecido)}</p><p className="ger-referencia">Animal {f.animalId} · fechamento {f.fechamentoId} · prova {f.prova.toLowerCase().replaceAll("_", " ")}</p></div>}</Detalhes>
            <Detalhes titulo="Divergências históricas" itens={n.lacunas}>{(l, i) => <p key={i} className="ger-fato">{l.motivo} · fechamento {l.fechamentoId}</p>}</Detalhes></div></details>
          </>;
        }}</BlocoPainel>
        <BlocoPainel titulo="Custos diretos registrados" bloco={dados.custos} id="ger-custos" className="ger-custos">{c => <>
          <div className="ger-valor-linha"><p className="ger-valor">{dinheiro(c.totalConhecido)}</p>{c.componentesPendentes > 0 && <p className="ger-pendente"><CircleAlert size={19} aria-hidden="true" />{contagem(c.componentesPendentes, "componente", "componentes")} com valor pendente</p>}</div>
          {c.lacunasNutricao > 0 && <p role="status" className="ger-aviso">Há {c.lacunasNutricao} participações nutricionais sem recorte conciliável; este total é parcial.</p>}
          <dl className="ger-finalidades">{c.finalidades.map(f => <div key={f.finalidade}><dt>{finalidade(f.finalidade)}{f.componentesPendentes > 0 && <small>{contagem(f.componentesPendentes, "pendente", "pendentes")}</small>}</dt><dd>{dinheiro(f.totalConhecido)}</dd></div>)}</dl>
          <p className="ger-muted">{dados.nutricao.estado === "DISPONIVEL" && dados.nutricao.dados.rebanho.custoConhecido === null ? "O custo de nutrição não está apurado neste recorte." : <>Inclui {dados.nutricao.estado === "DISPONIVEL" ? `${dinheiro(dados.nutricao.dados.rebanho.custoConhecido)} de nutrição` : "a nutrição"}.</>} Nutrição integra os custos diretos; não some novamente os dois totais.</p>
          <details className="ger-detalhes"><summary>Detalhes dos custos diretos</summary><div className="ger-detalhes-conteudo"><Detalhes titulo="Componentes únicos dos custos" itens={c.componentes}>{(v, i) => <p key={i} className="ger-fato"><a className="ger-origem" href={origemCusto(v)}>{v.descricao}</a> · {finalidade(v.finalidade)} · {dinheiro(v.valor)} · {v.estado.toLowerCase().replaceAll("_", " ")}</p>}</Detalhes>
          <details className="ger-detalhes"><summary>Limites dos custos diretos</summary><div className="ger-detalhes-conteudo"><p>{c.cobertura}</p>{c.limitacoes.map(l => <p key={l}>{l}</p>)}</div></details></div></details>
        </>}</BlocoPainel>
        <BlocoPainel titulo={`Estoque em ${dados.estoque.estado === "DISPONIVEL" ? dataBR(dados.estoque.dados.data) : "data de referência"}`} bloco={dados.estoque} id="ger-estoque" className="ger-estoque">{e => <>
          <div className="ger-estoque-resumo"><p className="ger-valor">{brl(e.valorConhecido)}</p><div><p>{contagem(new Set(e.itens.map(i => i.produtoId)).size, "produto", "produtos")} · {e.gruposPendentes ? `${contagem(e.gruposPendentes, "grupo", "grupos")} com valor pendente` : "sem valor pendente neste recorte"}.</p><p className="ger-muted">O estoque usa a data de referência indicada.</p></div></div>
          {e.gruposPendentes > 0 && <p className="ger-aviso">Valor parcial: há grupos com valor pendente.</p>}
          <Detalhes titulo="Produtos e composição do valor" itens={e.itens}>{(i, k) => <div key={k} className="ger-fato"><a className="ger-origem" href={link(`/estoque/produtos/${i.produtoId}`, { propriedadeId: String(i.propriedadeId) })}>{i.produto}</a><p>{numero(i.quantidade)} {i.unidade} · {dinheiro(i.valor)} · sítio {dados.escopo.sitios.find(s => s.id === i.propriedadeId)?.nome ?? i.propriedadeId}</p><details><summary>{i.bases.length} bases de valor · grupo {i.partidaId ?? "sem rastreio"}</summary>{i.bases.map(c => <p key={c.id} className="ger-referencia">{numero(c.quantidade)} {i.unidade} · {brl(c.valor)} · {c.metodo} · origem {c.baseOrigemId ?? c.id}</p>)}</details></div>}</Detalhes><p className="ger-muted ger-metodologia">{e.metodologia}</p>
        </>}</BlocoPainel>
      </div>
      {dados.caixa.estado === "DISPONIVEL" && <details className="ger-detalhes ger-detalhe-externo"><summary>Evolução mensal do caixa</summary><div className="ger-detalhes-conteudo"><p className="ger-muted">{dados.caixa.dados.metodologia}</p><div className="ger-grafico" role="img" aria-label="Gráfico de recebimentos e pagamentos mensais; valores disponíveis na tabela abaixo"><ResponsiveContainer width="100%" height="100%"><BarChart data={dados.caixa.dados.mensal.map(m => ({ ...m, Recebido: Number(m.entradas), Pago: Number(m.saidas) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis tickFormatter={v => numero(v)} /><Tooltip formatter={v => brl(Number(v))} /><Legend /><Bar dataKey="Recebido" fill="#61765a" /><Bar dataKey="Pago" fill="#a28a6d" /></BarChart></ResponsiveContainer></div><div className="ger-tabela"><table><caption className="sr-only">Caixa por mês</caption><thead><tr><th scope="col">Mês</th><th scope="col">Recebido</th><th scope="col">Pago</th><th scope="col">Resultado</th></tr></thead><tbody>{dados.caixa.dados.mensal.map(m => <tr key={m.mes}><th scope="row">{m.mes}{m.incompleto ? " · parcial" : ""}</th><td>{brl(m.entradas)}</td><td>{brl(m.saidas)}</td><td>{brl(m.resultado)}</td></tr>)}</tbody></table></div></div></details>}
      <BlocoPainel titulo="Pontos de atenção" bloco={dados.clinico} className="ger-clinico">{c => <><p>{c.acompanhamentosPendentes} acompanhamentos reprodutivos pendentes até {dataBR(c.data)}.</p><LinkOrigem href={link("/pecuaria/reproducao")}>Conferir acompanhamento reprodutivo</LinkOrigem></>}</BlocoPainel>
      <details className="ger-detalhes ger-detalhe-externo"><summary>Como interpretar estes valores <span>Caixa, consumo e estoque representam momentos diferentes.</span></summary><div className="ger-detalhes-conteudo"><p>Resultado de caixa compara recebimentos e pagamentos; não representa lucro. Nutrição já integra os custos diretos e não deve ser somada novamente.</p><p>A cobertura compara animal-dias com alimentação registrada à presença histórica. Não é um percentual monetário nem uma medição de ingestão individual. “Não apurado” preserva um valor desconhecido; zero continua sendo zero comprovado.</p>{dados.avisos.length > 0 && <ul>{dados.avisos.map(a => <li key={a}>{a}</li>)}</ul>}</div></details>
    </>}
  </div></PaginaFinanceira>;
}
