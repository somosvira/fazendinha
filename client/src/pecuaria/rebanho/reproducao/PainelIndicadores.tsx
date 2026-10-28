import {Card} from "@/components/ui/card";
import {CalendarDays} from "lucide-react";
import {AlternarVisualizacaoConsulta,useVisualizacaoConsulta} from "@/components/VisualizacaoConsulta";
import { Button } from "../../../components/ui/button";
import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Modal, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { descreverMotivo } from "./elegibilidade-api";
import { IdentificacaoReproducao, LinkReproducao } from "./ConsultaReproducaoUI";
import type { DetalheAnimalIndicador, SnapshotIndicadoresReprodutivos } from "./indicadores-api";

const numero = (n: number | null) => n === null ? "Sem base suficiente" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const taxa = (n: number | null) => n === null ? "Sem base suficiente" : `${numero(n)}%`;
const pendente = (a: DetalheAnimalIndicador) => a.incluidaNaBase === false || a.incluidaNaBase === undefined && a.contribuicaoElegiveis === null;

export function PainelIndicadores({ snapshot: s, mostrarMetodo = true }: { snapshot: SnapshotIndicadoresReprodutivos; mostrarMetodo?: boolean }) {
  const visualizacao=useVisualizacaoConsulta("indicadoresVisualizacao","reproducao");
  const [pagina, setPagina] = useState(1);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [paginaAnimais, setPaginaAnimais] = useState(1);
  const periodos = [...s.periodos].reverse();
  const totalPaginas = Math.max(1, Math.ceil(periodos.length / 10));
  const atual = Math.min(pagina, totalPaginas);
  const base = s.totais.baseCalculo;
  const t = s.totais.taxas, c = s.totais.contagens;
  const periodo = periodos.find(p => p.id === consulta);
  const detalhes = consulta === "pendencias" ? s.periodos.flatMap(p => p.detalhamento.filter(pendente)) : periodo?.detalhamento.filter(a => !pendente(a) && (a.contribuicaoElegiveis !== 0 || a.servida)) ?? [];
  const animais = [...new Map(detalhes.map(a => [a.animalId, { ...a, motivos: [...new Set(detalhes.filter(d => d.animalId === a.animalId).flatMap(d => d.motivos))] }])).values()];
  const abrir = (id: string) => { setConsulta(id); setPaginaAnimais(1); };
  return <Panel className="repro-indicadores-painel overflow-hidden">
    {base?.parcial && <aside className="reproducao-pendencias"><TriangleAlert aria-hidden size={20}/><div><strong>Resultado parcial · {base.animaisPendentes} {base.animaisPendentes === 1 ? "animal com pendência" : "animais com pendências"}</strong><p>{base.animaisValidos} animais na base válida. Participações pendentes ficam fora dos numeradores e denominadores.</p></div><Button variant="outline" onClick={() => abrir("pendencias")}>Revisar pendências</Button></aside>}
    <header className="repro-consulta-titulo"><div><h2>Resultado do período consultado</h2><p>{formatBRDateISO(s.filtros.inicio)} – {formatBRDateISO(s.filtros.fim)} · corte em {formatBRDateISO(s.filtros.corte)}</p></div></header>
    <div className="indicadores-taxas">
      <section><h2>Taxa de serviço</h2><strong>{taxa(t.servico)}</strong><p>{c.matrizesServidas} serviços / {numero(c.elegiveis)} elegíveis ponderadas nos períodos</p></section>
      <section><h2>Taxa de concepção</h2><strong>{taxa(t.concepcao)}</strong><p>{c.positivas} positivas / {c.denominadorConcepcao} tentativas com resultado</p></section>
      <section><h2>Taxa de prenhez</h2><strong>{taxa(t.prenhez)}</strong><p>Serviço × concepção sobre dados válidos</p></section>
    </div>
    <header className="repro-desempenho-cabecalho"><div><h2>Desempenho por período</h2><p>{base?.animaisValidos ?? s.totais.animaisUnicos} animais na base válida · janelas de 21 dias</p></div><AlternarVisualizacaoConsulta modo={visualizacao.modo} mudar={visualizacao.mudar} rotulo="Visualização do desempenho"/></header>
    {visualizacao.modo === "visual" ? <div className="repro-periodos-visuais">{periodos.slice((atual-1)*10,atual*10).map(p=><Card key={p.id} className="repro-periodo-visual"><header><CalendarDays size={17} aria-hidden/><h3>{formatBRDateISO(p.inicio)} – {formatBRDateISO(p.fim)}</h3></header><div className="repro-periodo-servico"><span>Serviço</span><strong>{taxa(p.taxas.servico)}</strong></div>{p.taxas.servico!==null&&<div className="repro-periodo-barra" role="img" aria-label={`Taxa de serviço: ${taxa(p.taxas.servico)}`}><i style={{width:`${Math.max(0,Math.min(100,p.taxas.servico))}%`}}/></div>}<p>{p.contagens.matrizesServidas} / {numero(p.contagens.elegiveis)} elegíveis</p><dl><div><dt>Concepção</dt><dd>{taxa(p.taxas.concepcao)}</dd><small>{p.contagens.positivas} / {p.contagens.denominadorConcepcao} tentativas</small></div><div><dt>Prenhez</dt><dd>{taxa(p.taxas.prenhez)}</dd></div></dl><Button variant="outline" onClick={()=>abrir(p.id)}>Ver animais</Button></Card>)}</div> :
    <TabelaFinanceira visualizacao="tabela" rotulo="Indicadores na base válida" itens={periodos.slice((atual-1)*10,atual*10)} chaveDe={p=>p.id} colunas={[
      {chave:"periodo",titulo:"Período",principal:true,larguraMinima:220,celula:p=><strong>{formatBRDateISO(p.inicio)} – {formatBRDateISO(p.fim)}</strong>},
      {chave:"servico",titulo:"Serviço",celula:p=><div>{taxa(p.taxas.servico)}<p className="text-xs text-muted-foreground">{p.contagens.matrizesServidas} / {numero(p.contagens.elegiveis)} elegíveis</p></div>},
      {chave:"concepcao",titulo:"Concepção",celula:p=><div>{taxa(p.taxas.concepcao)}<p className="text-xs text-muted-foreground">{p.contagens.positivas} / {p.contagens.denominadorConcepcao} tentativas</p></div>},
      {chave:"prenhez",titulo:"Prenhez",celula:p=>taxa(p.taxas.prenhez)},
      {chave:"acao",titulo:"Consulta",acoes:true,celula:p=><Button variant="outline" onClick={()=>abrir(p.id)}>Ver animais</Button>},
    ]}/>}
    {!periodos.length && <p role="status" className="p-5">Nenhum período completo de 21 dias. Amplie o intervalo para consultar o desempenho.</p>}
    {periodos.length>10 && <Paginacao paginaAtual={atual} totalPaginas={totalPaginas} totalItens={periodos.length} itensPorPagina={10} onPaginaChange={setPagina} rotulo="períodos" idSelect="pagina-periodos-indicadores"/>}
    {s.sobraInicial && <p role="status" className="px-4 py-3 text-xs text-muted-foreground">{s.sobraInicial.dias} dias iniciais fora das janelas completas de 21 dias.</p>}
    {mostrarMetodo && <details className="repro-indicadores-metodo"><summary>Método e critérios do cálculo</summary><h3>{s.metodologia.rotulo}</h3><p>Versão {s.versaoMetodologia} · deslocamento TE: {s.metodologia.deslocamentoTeDias} dias · concepção estimada: {s.metodologia.concepcaoEstimada === null ? "não informada" : `${s.metodologia.concepcaoEstimada}%`}</p><ul>{s.metodologia.regras.map((regra, i) => <li key={i}>{regra}</li>)}</ul><p>Fontes: {s.metodologia.fontes.join("; ")}</p></details>}
    {consulta && <Modal eyebrow="Indicadores reprodutivos" titulo={consulta === "pendencias" ? "Pendências fora da base de cálculo" : "Animais da base válida"} onClose={()=>setConsulta(null)}>
      <div className="p-4 space-y-4">{periodo && <p>{formatBRDateISO(periodo.inicio)} – {formatBRDateISO(periodo.fim)}</p>}
        <TabelaFinanceira rotulo={consulta === "pendencias" ? "Animais com pendências" : "Animais do período"} itens={animais.slice((paginaAnimais-1)*10,paginaAnimais*10)} chaveDe={a=>a.animalId} colunas={[
          {chave:"animal",titulo:"Animal",principal:true,celula:a=><IdentificacaoReproducao id={a.animalId} brinco={a.brinco} nome={a.nome} sitio={s.filtros.propriedadeId}/>},
          {chave:"base",titulo:consulta==="pendencias"?"Pendência":"Contribuição elegível",celula:a=>consulta==="pendencias"?a.motivos.map(descreverMotivo).join(" "):numero(a.contribuicaoElegiveis)},
          {chave:"acao",titulo:"Ação",acoes:true,celula:a=><LinkReproducao botao sitio={s.filtros.propriedadeId} href={`/pecuaria/rebanho/animais/${a.animalId}#reproducao`}>Abrir ficha</LinkReproducao>},
        ]}/>
        {animais.length>10 && <Paginacao paginaAtual={paginaAnimais} totalPaginas={Math.ceil(animais.length/10)} totalItens={animais.length} itensPorPagina={10} onPaginaChange={setPaginaAnimais} rotulo="animais" idSelect="pagina-animais-indicadores"/>}
      </div>
    </Modal>}
  </Panel>;
}
