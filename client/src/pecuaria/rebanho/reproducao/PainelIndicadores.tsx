import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, Modal, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { descreverMotivo } from "./elegibilidade-api";
import { IdentificacaoReproducao, LinkReproducao } from "./ConsultaReproducaoUI";
import type { DetalheAnimalIndicador, SnapshotIndicadoresReprodutivos } from "./indicadores-api";

const numero = (n: number | null) => n === null ? "Sem base suficiente" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const taxa = (n: number | null) => n === null ? "Sem base suficiente" : `${numero(n)}%`;
const pendente = (a: DetalheAnimalIndicador) => a.incluidaNaBase === false || a.incluidaNaBase === undefined && a.contribuicaoElegiveis === null;

export function PainelIndicadores({ snapshot: s }: { snapshot: SnapshotIndicadoresReprodutivos }) {
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
  return <Panel className="overflow-hidden">
    {base?.parcial && <aside className="reproducao-pendencias"><TriangleAlert aria-hidden size={20}/><div><strong>Resultado parcial · {base.animaisPendentes} {base.animaisPendentes === 1 ? "animal com pendência" : "animais com pendências"}</strong><p>{base.animaisValidos} animais na base válida. Participações pendentes ficam fora dos numeradores e denominadores.</p></div><Button secondary onClick={() => abrir("pendencias")}>Revisar pendências</Button></aside>}
    <div className="indicadores-taxas">
      <section><h2>Taxa de serviço</h2><strong>{taxa(t.servico)}</strong><p>{c.matrizesServidas} serviços / {numero(c.elegiveis)} elegíveis ponderadas nos períodos</p></section>
      <section><h2>Taxa de concepção</h2><strong>{taxa(t.concepcao)}</strong><p>{c.positivas} positivas / {c.denominadorConcepcao} tentativas com resultado</p></section>
      <section><h2>Taxa de prenhez</h2><strong>{taxa(t.prenhez)}</strong><p>Serviço × concepção sobre dados válidos</p></section>
    </div>
    <header className="p-4"><h2 className="text-lg font-semibold">Desempenho por período</h2><p className="mt-1 text-sm text-muted-foreground">{base?.animaisValidos ?? s.totais.animaisUnicos} animais na base válida · janelas de 21 dias</p></header>
    <TabelaFinanceira rotulo="Indicadores na base válida" itens={periodos.slice((atual-1)*10,atual*10)} chaveDe={p=>p.id} colunas={[
      {chave:"periodo",titulo:"Período",principal:true,larguraMinima:220,celula:p=><strong>{formatBRDateISO(p.inicio)} – {formatBRDateISO(p.fim)}</strong>},
      {chave:"servico",titulo:"Serviço",celula:p=><div>{taxa(p.taxas.servico)}<p className="text-xs text-muted-foreground">{p.contagens.matrizesServidas} / {numero(p.contagens.elegiveis)} elegíveis</p></div>},
      {chave:"concepcao",titulo:"Concepção",celula:p=><div>{taxa(p.taxas.concepcao)}<p className="text-xs text-muted-foreground">{p.contagens.positivas} / {p.contagens.denominadorConcepcao} tentativas</p></div>},
      {chave:"prenhez",titulo:"Prenhez",celula:p=>taxa(p.taxas.prenhez)},
      {chave:"acao",titulo:"Consulta",acoes:true,celula:p=><Button secondary onClick={()=>abrir(p.id)}>Ver animais</Button>},
    ]}/>
    {!periodos.length && <p role="status" className="p-5">Nenhum período completo de 21 dias. Amplie o intervalo para consultar o desempenho.</p>}
    {periodos.length>10 && <Paginacao paginaAtual={atual} totalPaginas={totalPaginas} totalItens={periodos.length} itensPorPagina={10} onPaginaChange={setPagina} rotulo="períodos" idSelect="pagina-periodos-indicadores"/>}
    {s.sobraInicial && <p role="status" className="px-4 py-3 text-xs text-muted-foreground">{s.sobraInicial.dias} dias iniciais fora das janelas completas de 21 dias.</p>}
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
