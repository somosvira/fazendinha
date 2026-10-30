import { AjudaCampo } from "@/components/Dica";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { LinhaTempoDietas } from "./LinhaTempoDietas";
import { Leaf, CalendarDays, Layers } from "lucide-react";
import { VacaIcon } from "@/components/icons/VacaIcon";
import { formatarLitros } from "../leite/modelo";
import { useCallback, useState } from "react";
import { PageHeader, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import { consultarResumoNutricional, listarVigencias } from "./api";
import { rotaOperacaoNutricional } from "./navegacao";
import { useConsulta } from "./consulta";
import { custoTexto, CustosLote, EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";
import { FechamentosNutricao } from "./FechamentosNutricao";
import { PaginacaoNutricao } from "./PaginacaoNutricao";
import "./nutricao.css";

export function NutricaoLote({ loteId, podeLancar, vista }: { loteId: string; propriedadeId?: number; podeLancar: boolean; vista?: "lotes" }) {
  const visual = useVisualizacaoConsulta("visualDietasLote", "nutricao");
  const [pagina, setPagina] = useState(1);
  const consulta = useConsulta(useCallback(() => consultarResumoNutricional(loteId), [loteId]));
  const historico = useConsulta(useCallback(() => listarVigencias(loteId, pagina), [loteId, pagina]));
  const r = consulta.dados;
  const completa = vista === "lotes";
  const escrever = podeLancar && r?.lote.ativo;
  return <div className="nutricao-lote"><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} estrutura="detalhe" label="Carregando nutrição do lote…" />{r && <>
    {completa ? <><nav className="nutricao-breadcrumb" aria-label="Navegação"><LinkNutricional href={rotaNutricao()}>Nutrição</LinkNutricional><span>/</span><span>{r.lote.nome}</span></nav><PageHeader eyebrow="" titulo={r.lote.nome} descricao={`${r.lote.propriedade.nome}${r.lote.ativo ? "" : " · lote inativo"}`} acao={<LinkNutricional className="nutricao-botao-secundario" href={`/pecuaria/rebanho/lotes/${r.lote.id}`}>Ver lote e animais</LinkNutricional>} /></> : <div className="nutricao-card-cabecalho"><h2 className="h3">Nutrição do lote</h2><LinkNutricional href={rotaNutricao({ loteId })}>Abrir nutrição do lote</LinkNutricional></div>}
    <div className="nutricao-conteudo nutricao-lote-conteudo nutricao-lote-visual">
      <Panel className="nutricao-dieta-vigente">
        <header className="lote-dieta-identidade"><span className="receita-emblema" aria-hidden="true"><Leaf size={26} /></span><div><h2>Dieta vigente</h2><p>{r.vigente ? "Planejamento de alimentação do lote" : "Nenhuma dieta atribuída"}</p></div><Pill tone={r.vigente ? "green" : "amber"}>{r.vigente ? "Em uso" : "Sem dieta"}</Pill></header>
        <div className="lote-dieta-principal"><h3>{r.vigente ? r.vigente.dieta.nome : "Defina a alimentação do lote"}</h3>{r.vigente && <span>Versão {r.vigente.dieta.versao}</span>}</div>
        <dl className="lote-dieta-fatos"><div><dt><VacaIcon width={20} height={20} aria-hidden="true" />Efetivo hoje</dt><dd>{r.lote.animaisAtivos} animais ativos</dd></div><div><dt><CalendarDays size={19} aria-hidden="true" />Vigência</dt><dd>{r.vigente ? `Desde ${formatarDataBR(r.vigente.desde)}` : "Não atribuída"}</dd></div></dl>
        {r.programada && <div className="lote-dieta-programada"><Layers size={19} aria-hidden="true" /><div><strong>Próxima dieta</strong><p>{r.programada.dieta.nome} · v{r.programada.dieta.versao}</p><span>A partir de {formatarDataBR(r.programada.desde)}</span></div></div>}
        {escrever && <footer className="lote-dieta-acoes"><LinkNutricional className="nutricao-botao" href={rotaOperacaoNutricional("consumo", loteId)}>Conferir consumo</LinkNutricional><LinkNutricional className="nutricao-botao-secundario" href={rotaOperacaoNutricional("atribuir", loteId)}>{r.vigente ? "Trocar dieta" : "Atribuir dieta"}</LinkNutricional></footer>}
      </Panel>
      <CustosLote resumo={r} />
      {r.referenciaLeite && <Panel><div className="nutricao-card-cabecalho"><h2 className="h3">Referência comercial do leite fornecido <AjudaCampo rotulo="Sobre a referência comercial do leite" texto={"Medida gerencial separada do custo de produção, sem somar um novo gasto da fazenda. Confira a fonte e revise após o fechamento comercial nos detalhes do consumo."} /></h2></div><div className="nutricao-card-corpo grid gap-2"><p>{formatarLitros(Number(r.referenciaLeite.quantidadeLitros))} confirmados · referência conhecida <strong>{custoTexto(r.referenciaLeite.valorConhecido)}</strong></p><p>{r.referenciaLeite.pendentes} fornecimento(s) com preço pendente · {r.referenciaLeite.provisorios} com preço provisório do mês anterior.</p></div></Panel>}
      {completa && <Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Histórico de dietas</h2></div><AlternarVisualizacaoConsulta {...visual} visual="Linha do tempo" rotulo="Visualização das dietas do lote" /></div><div className="px-5"><EstadoConsulta erro={historico.erro} carregando={historico.carregando} recarregar={historico.carregar} estrutura="lista" label="Carregando histórico de dietas…" /></div>
        {historico.dados && <>{!historico.dados.itens.length ? <p className="nutricao-vazio">Nenhuma dieta atribuída.</p> : visual.modo === "visual" ? <LinhaTempoDietas itens={historico.dados.itens} vigenteId={r.vigente?.id} programada={r.programada} escrever={escrever} loteId={loteId} /> : <TabelaFinanceira rotulo="Histórico de dietas do lote" itens={historico.dados.itens} chaveDe={(v) => v.id} colunas={[
          { chave: "receita", titulo: "Receita / versão", principal: true, celula: (v) => <strong>{v.dieta.nome} · v{v.dieta.versao}</strong> },
          { chave: "inicio", titulo: "Início", celula: (v) => formatarDataBR(v.desde) },
          { chave: "fim", titulo: "Fim (troca)", celula: (v) => v.ate ? formatarDataBR(v.ate) : "Sem fim programado" },
          { chave: "situacao", titulo: "Situação", celula: (v) => <Pill tone={r.vigente?.id === v.id ? "green" : r.programada?.id === v.id ? "blue" : "neutral"}>{r.vigente?.id === v.id ? "Vigente" : r.programada != null && v.desde >= r.programada.desde ? "Programada" : "Histórica"}</Pill> },
          ...(escrever ? [{ chave: "acao", titulo: "", acoes: true, celula: (v: typeof historico.dados.itens[number]) => <LinkNutricional className="nutricao-botao-secundario" href={rotaOperacaoNutricional("corrigir", loteId, v.id)}>Corrigir vigência</LinkNutricional> }] : []),
        ]} />}<PaginacaoNutricao pagina={pagina} total={historico.dados.total} limite={historico.dados.limite} onPagina={setPagina} nome="dietas" /></>}
      </Panel>}
      {completa && !r.programada && <p className="nutricao-nota">Nenhuma troca programada.</p>}
      {completa && <FechamentosNutricao loteId={loteId} />}
    </div>
  </>}</div>;
}
