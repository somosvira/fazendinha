import { useOrdenacaoTabela } from "./OrdenarConsulta";
import { BuscaLista } from "@/components/BuscaLista";
import "./extrato-consulta.css";
import { ArrowRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filtrosDasColunas, type CampoConsulta } from "./FiltroColunaConsulta";
import { CampoFiltro } from "./PainelFiltros";
import { FiltroFaixaValor } from "./FiltroFaixaValor";
import { DatePicker } from "@/components/DatePicker";
import { valorMonetario } from "./lib/validacao";
import { useRascunhoConsulta } from "./useRascunhoConsulta";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { useEffect, useState, type ReactNode } from "react";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { SelectCampo } from "./SelectCampo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Conta, MovimentoGeral } from "./novo-api";
import { brl, dataBR, Empty, ErrorBox, Panel, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { infoReversao } from "./lib/reversao";

const CAMPO = "mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal";

export type FiltrosExtratoGeral = {
  inicio: string;
  fim: string;
  conta: string;
  instituicao: string;
  natureza?: string;
  busca?: string;
  minimo?: string;
  maximo?: string;
};

export const FILTROS_EXTRATO_GERAL_INICIAIS: FiltrosExtratoGeral = { inicio: "", fim: "", conta: "", instituicao: "" };

export function filtrarMovimentosExtratoGeral(movimentos: MovimentoGeral[], filtros: FiltrosExtratoGeral): MovimentoGeral[] {
  const { inicio, fim, conta, instituicao, natureza, busca } = filtros;
  return movimentos.filter(m => {
    const data = m.transacao.data.slice(0, 10);
    if (natureza) {
      const tipo = m.transacao.reversaoDe?.tipo ?? m.transacao.tipo;
      const entradaOriginal = m.transacao.tipo === "REVERSAO" ? m.direcao === "SAIDA" : m.direcao === "ENTRADA";
      if (tipo === "TRANSFERENCIA" || !["CONFIRMADA", "REVERTIDA"].includes(m.transacao.status) || (natureza === "recebimentos") !== entradaOriginal) return false;
    }
    const termo = busca?.trim().toLocaleLowerCase("pt-BR");
    const texto = [m.transacao.descricao, infoReversao(m.transacao)?.detalhe, m.conta.nome, m.conta.instituicao, m.transacao.parceiro?.nome].join(" ").toLocaleLowerCase("pt-BR");
    return (!filtros.minimo || Number(m.valor) >= valorMonetario(filtros.minimo)) && (!filtros.maximo || Number(m.valor) <= valorMonetario(filtros.maximo)) && (!termo || texto.includes(termo)) && (!inicio || data >= inicio) && (!fim || data <= fim) && (!conta || String(m.contaId) === conta)
      && (!instituicao || (instituicao === "__sem__" ? !m.conta.instituicao : m.conta.instituicao === instituicao));
  });
}

function useFiltrosExtrato(contas: Conta[], filtros: FiltrosExtratoGeral, onChangeFiltros: (v: FiltrosExtratoGeral) => void, limiteValor: number) {
  const edicao = useRascunhoConsulta({...filtros,minimo:filtros.minimo??"",maximo:filtros.maximo??""},{...FILTROS_EXTRATO_GERAL_INICIAIS,minimo:"",maximo:"",natureza:filtros.natureza},v=>onChangeFiltros(v));
  const v = edicao.rascunho;
  const campos: CampoConsulta[] = [
    {chave:"descricao", naBarra: true,ativo:!!filtros.busca,limpar:()=>edicao.editar("busca",""),conteudo:<CampoFiltro rotulo="Movimentação"><Input aria-label="Buscar movimento no filtro" value={v.busca??""} onChange={e=>edicao.editar("busca",e.target.value)} placeholder="Descrição, conta ou parceiro"/></CampoFiltro>},
    {chave:"data", naBarra: true,ativo:!!filtros.inicio||!!filtros.fim,limpar:()=>{edicao.editar("inicio","");edicao.editar("fim","");},conteudo:<div className="filtros-grupo-campos"><CampoFiltro rotulo="Data inicial"><DatePicker value={v.inicio} onChange={de=>edicao.editar("inicio",de)}/></CampoFiltro><CampoFiltro rotulo="Data final"><DatePicker value={v.fim} onChange={ate=>edicao.editar("fim",ate)}/></CampoFiltro></div>},
    {chave:"conta",ativo:!!filtros.conta||!!filtros.instituicao,limpar:()=>{edicao.editar("conta","");edicao.editar("instituicao","");},conteudo:<><CampoFiltro rotulo="Conta"><SelectCampo aria-label="Filtrar por conta" value={v.conta} onValueChange={valor=>edicao.editar("conta",valor)}><option value="">Todas as contas</option>{contas.map(c=><option key={c.id} value={c.id}>{c.nome}{!c.ativo?" (inativa)":""}</option>)}</SelectCampo></CampoFiltro><CampoFiltro rotulo="Instituição"><SelectCampo aria-label="Filtrar por instituição" value={v.instituicao} onValueChange={valor=>edicao.editar("instituicao",valor)}><option value="">Todas as instituições</option>{Array.from(new Set(contas.map(c=>c.instituicao).filter((i): i is string=>!!i))).sort().map(i=><option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></SelectCampo></CampoFiltro></>},
    {chave:"valor",ativo:!!filtros.minimo||!!filtros.maximo,limpar:()=>{edicao.editar("minimo","");edicao.editar("maximo","");},conteudo:<FiltroFaixaValor rotulo="Valor do movimento" minimo={v.minimo} maximo={v.maximo} limiteSugerido={limiteValor} onMinimoChange={valor=>edicao.editar("minimo",valor)} onMaximoChange={valor=>edicao.editar("maximo",valor)}/>},
  ];
  const erro = v.inicio && v.fim && v.inicio>v.fim ? "A data inicial deve ser igual ou anterior à final." : [v.minimo,v.maximo].some(n=>n.trim()&&(!/^\d+(?:[.,]\d+)*$/.test(n.trim())||!Number.isFinite(valorMonetario(n)))) || v.minimo && v.maximo && valorMonetario(v.minimo)>valorMonetario(v.maximo) ? "Confira os limites de valor." : null;
  const criterios = [
    ...(filtros.conta?[{id:"conta",rotulo:`Conta: ${contas.find(c=>c.id===filtros.conta)?.nome??"Selecionada"}`,limpar:()=>onChangeFiltros({...filtros,conta:""})}]:[]),
    ...(filtros.instituicao?[{id:"instituicao",rotulo:`Instituição: ${filtros.instituicao==="__sem__"?"Sem instituição":filtros.instituicao}`,limpar:()=>onChangeFiltros({...filtros,instituicao:""})}]:[]),
    ...(filtros.minimo||filtros.maximo?[{id:"valor",rotulo:`Valor: ${filtros.minimo||"Sem mínimo"} – ${filtros.maximo||"Sem máximo"}`,limpar:()=>onChangeFiltros({...filtros,minimo:"",maximo:""})}]:[]),
  ];
  return {edicao,campos,erro,criterios};
}

function MovimentacaoExtrato({ movimento, onAbrir }: { movimento: MovimentoGeral; onAbrir: (movimento: MovimentoGeral) => void }) {
  const [aberto, setAberto] = useState(false);
  const transacao = movimento.transacao;
  const reversao = infoReversao(transacao);
  const estornada = transacao.status === "REVERTIDA";
  const titulo = reversao?.detalhe ?? transacao.descricao ?? transacao.tipo.replaceAll("_", " ");
  const etiqueta = reversao ? "Estorno" : "Estornada";
  return <>
    <div className="extrato-movimentacao-titulo">
      <strong>{titulo}</strong>
      {(reversao || estornada) && <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button type="button" className={`extrato-situacao h-auto ${reversao ? "extrato-situacao-estorno" : ""}`} aria-label={`Detalhes: ${etiqueta.toLocaleLowerCase("pt-BR")}`} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{etiqueta}</button>
        </PopoverTrigger>
        <PopoverContent className="extrato-situacao-popover" align="start" sideOffset={8} aria-label={reversao ? "Detalhes do estorno" : "Detalhes do lançamento estornado"} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <div className="extrato-popover-titulo"><h2>{reversao?.detalhe ?? "Lançamento estornado"}</h2><Button variant="ghost" size="icon" aria-label="Fechar detalhes" onClick={() => setAberto(false)}><X size={16} aria-hidden="true" /></Button></div>
          <p>{reversao ? "Este movimento registra o valor na direção oposta à do lançamento original." : "Este lançamento foi estornado. O movimento original permanece no histórico."}</p>
          {transacao.descricao && <div className="extrato-descricao-registrada"><span>Descrição registrada</span><p>{transacao.descricao}</p></div>}
          {transacao.reversaoDe?.descricao && <div className="extrato-descricao-registrada"><span>Lançamento original</span><p>{transacao.reversaoDe.descricao}</p></div>}
          <Button variant="link" className="extrato-ver-movimento" onClick={() => { setAberto(false); onAbrir(movimento); }}>Ver movimento<ArrowRight size={16} aria-hidden="true" /></Button>
        </PopoverContent>
      </Popover>}
    </div>
    {transacao.operacao && <div className="extrato-origem"><LinkOperacaoFinanceira id={transacao.operacao.id} numero={transacao.operacao.numero} /></div>}
  </>;
}

export function ExtratoGeral({ contas, movimentos, filtros, onChangeFiltros, carregando, erro, onAbrir, controles, ocultarFiltros = false }: {
  controles?: ReactNode;
  ocultarFiltros?: boolean;
  contas: Conta[];
  movimentos: MovimentoGeral[];
  filtros: FiltrosExtratoGeral;
  onChangeFiltros: (filtros: FiltrosExtratoGeral) => void;
  carregando: boolean;
  erro: string | null;
  onAbrir: (movimento: MovimentoGeral) => void;
}) {
  const { inicio, fim, conta, instituicao } = filtros;
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [inicio, fim, conta, instituicao, filtros.natureza, filtros.busca, filtros.minimo, filtros.maximo, movimentos]);
  const consulta = useFiltrosExtrato(contas,filtros,onChangeFiltros,Math.max(1,...movimentos.map(m=>Number(m.valor))));
  const intervaloInvalido = !!inicio && !!fim && inicio > fim;
  const ordem = useOrdenacaoTabela<typeof movimentos[number]>([{ chave: "data", rotulo: "Data", tipo: "data", obter: m => m.transacao.data }, { chave: "valor", rotulo: "Valor com sinal", tipo: "numero", obter: m => m.direcao === "SAIDA" ? `-${String(m.valor).replace(/^-/, "")}` : m.valor }], "ordemExtratoGeral", () => setPagina(1));
  const filtrados = ordem.ordenar(filtrarMovimentosExtratoGeral(movimentos, filtros));
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  return <section id="extrato-geral" className="mt-6 min-w-0 scroll-mt-6" aria-label="Extrato geral">
    <Panel tom="info" className="fin-painel overflow-hidden">
      {!ocultarFiltros && <BarraConsulta ordenacao={ordem.controle} campos={consulta.campos} edicaoFiltros={consulta.edicao} erroFiltros={consulta.erro} criterios={consulta.criterios} onLimpar={()=>onChangeFiltros({...filtros,conta:"",instituicao:"",busca:"",minimo:"",maximo:""})}><BuscaLista rotulo="Buscar movimento" placeholder="Buscar descrição, conta ou parceiro" valor={filtros.busca??""} onChange={busca=>onChangeFiltros({...filtros,busca})}/>{controles}</BarraConsulta>}
      {filtros.natureza && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 text-sm"><span>{filtros.natureza === "recebimentos" ? "Recebimentos" : "Pagamentos"} realizados, líquidos de estornos · transferências excluídas</span><Button variant="link" onClick={() => onChangeFiltros({ ...filtros, natureza: undefined })}>Mostrar todas as movimentações</Button></div>}
      <ErrorBox erro={erro} />
      {intervaloInvalido ? <p role="alert" className="p-3">A data final deve ser igual ou posterior à data inicial.</p> : carregando ? <SkeletonListaFinanceira label="Carregando extrato geral" /> : erro ? <p className="p-3">Não foi possível carregar as movimentações.</p> : filtrados.length ? <><TabelaFinanceira ordenacao={ordem.controle} filtrosColunas={filtrosDasColunas(consulta.campos,consulta.edicao,consulta.erro)} cartaoComLinks compacta barraRolagemSuperior rotulo="Extrato geral" itens={filtrados.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={m => m.id} onAbrir={onAbrir} colunas={[
        { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 110, celula: m => dataBR(m.transacao.data) },
        { chave: "descricao", titulo: "Movimentação", principal: true, larguraMinima: 260, celula: m => <MovimentacaoExtrato movimento={m} onAbrir={onAbrir} /> },
        { chave: "conta", titulo: "Conta", larguraMinima: 160, celula: m => m.conta.nome },
        { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 150, celula: m => <span className="whitespace-nowrap font-semibold" style={{ color: m.direcao === "ENTRADA" ? "var(--primary)" : "var(--ink)" }}><span className="sr-only">{m.direcao === "ENTRADA" ? "Entrada de " : "Saída de "}</span>{m.direcao === "ENTRADA" ? "+" : "−"}{brl(m.valor)}</span> },
      ]} /><Paginacao ocultarControlesPaginaUnica pagina={paginaAtual} totalPaginas={totalPaginas} total={filtrados.length} porPagina={15} rotulo="Paginação do extrato geral" substantivo="movimentos" idSelect="pagina-extrato-geral" onPagina={setPagina} /></> : <Empty>Nenhuma movimentação encontrada para os filtros selecionados.</Empty>}
    </Panel>
  </section>;
}
