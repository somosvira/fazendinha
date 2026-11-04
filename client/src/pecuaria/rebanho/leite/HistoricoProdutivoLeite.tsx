import { useEffect, useState, type ReactNode } from "react";
import { Milk, ShieldCheck, Search, SlidersHorizontal, ChartLine, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AjudaCampo } from "@/components/Dica";
import { useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { LactacaoIndividual, type LactacaoIndividualProps } from "../reproducao/LactacaoIndividual";
import { dataHoraSanitaria, dataSanitaria } from "../sanidade/rotulos";
import { EvolucaoProducaoIndividual } from "./EvolucaoProducaoIndividual";
import { resumirAfericoesIndividuais } from "./producao-individual.calc";
import { formatarLitros } from "./modelo";
import { periodoProducao, useHistoricoProdutivo } from "./consulta-producao-animal";
import { PeriodoProducao, VazioProducao } from "./ProducaoAnimalUI";
import { AfericaoAnimalDetalhe } from "./AfericaoAnimalDetalhe";
import type { DiaHistoricoProdutivo, ContextoCarenciaLeite } from "./historico-types";
import "./historico-produtivo.css";

const situacaoDia = (d: DiaHistoricoProdutivo) => d.excluidoEm ? "Excluída" : d.totais.completa ? "Completa" : "Parcial";
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function ContextoCarencia({ contexto, animalId }: { contexto: ContextoCarenciaLeite; animalId: string }) {
  let texto = "Contexto disponível em Sanidade, no sítio atual do animal.";
  if (contexto.disponibilidade === "DISPONIVEL") {
    const prazo = contexto.leite;
    texto = contexto.revisaoLeitePendente || contexto.revisaoAdministracaoPendente ? "Carência em revisão — confira os registros sanitários."
      : prazo.estado === "NAO_INFORMADO" ? "Carência não informada — confira os registros sanitários."
      : prazo.estado === "NENHUMA" ? "Sem aplicações válidas registradas até a data de referência."
      : prazo.estado === "NAO_APLICAVEL" ? "Não se aplica, conforme registro sanitário."
      : prazo.estado === "CONHECIDO" ? prazo.prazoZero ? "Prazo zero confirmado no registro sanitário."
      : `Prazo registrado até ${dataHoraSanitaria(prazo.ate)}${prazo.precisaoAproximada ? " (data aproximada)" : ""}.` : "Carência não informada.";
  }
  return <section id="carencia-producao-leite" aria-label="Carência do leite" className="producao-carencia-faixa">
    <div><h3><ShieldCheck size={20} aria-hidden="true"/>Carência do leite<AjudaCampo rotulo="Sobre carência do leite" texto="Destino registrado separadamente; esta consulta não confirma descarte nem aptidão sanitária."/></h3><p>{texto}</p></div>
    <span>Referência: {dataSanitaria(contexto.dataReferencia)}</span>
    <Button variant="outline" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${animalId}#sanidade`)}>Conferir Sanidade</Button>
  </section>;
}
export function HistoricoProdutivoLeite({ animalId, propriedadeId, recarregarToken = 0, lactacao }: {
  animalId: string; propriedadeId: number | null; recarregarToken?: number;
  lactacao?: Omit<LactacaoIndividualProps, "animalId" | "recarregarToken" | "compor">;
}) {
  const visualizacao = useVisualizacaoConsulta("animalProducaoVisualizacao", "leite", "visual");
  const [periodo, setPeriodo] = useState(periodoProducao);
  const [pagina, setPagina] = useState(1), [busca, setBusca] = useState(""), [situacao, setSituacao] = useState("todas"), [filtros, setFiltros] = useState(false);
  const [detalhe, setDetalhe] = useState<DiaHistoricoProdutivo | null>(null);
  const { dados, erro, carregando, tentarNovamente } = useHistoricoProdutivo(animalId, propriedadeId, periodo, recarregarToken);
  useEffect(() => { setPagina(1); setDetalhe(null); }, [animalId, propriedadeId, periodo, recarregarToken]);
  const serie = dados?.seriePeriodo ?? dados?.itens.map(d => ({ participanteId: d.participanteId, data: d.dataOperacional, litros: d.totais.litros, completa: d.totais.completa, excluido: d.excluidoEm !== null, lactacaoId: d.lactacao?.id ?? null, comparabilidade: d.medicoes.map(m => `${m.posicaoId}:${m.estado}`).sort().join("|"), finalidade: d.finalidade.estado })) ?? [];
  const resumo = resumirAfericoesIndividuais(serie);
  const registros = dados?.itens.filter(d => normalizar(`${dataSanitaria(d.dataOperacional)} ${d.dataOperacional} ${situacaoDia(d)}`).includes(normalizar(busca.trim())) && (situacao === "todas" || situacaoDia(d) === situacao)) ?? [];
  const idsFiltrados = new Set(registros.map(d => d.participanteId));
  const pontos = resumo.pontos.filter(p => idsFiltrados.has(p.participanteId));
  const paginaAtual = Math.min(pagina, Math.max(1, Math.ceil(registros.length / 10)));
  const paginaItens = registros.slice((paginaAtual - 1) * 10, paginaAtual * 10);
  const periodoPicker = <PeriodoProducao periodo={periodo} onChange={p => { setPeriodo(p); setPagina(1); }} rotulo="Período da produção"/>;
  const conteudo = <>
    <h3 className="producao-subtitulo">Aferições</h3>
    {propriedadeId == null ? <p>Selecione o sítio autorizado para consultar a produção individual.</p> : <>
    <ErrorBox erro={erro}/>{erro && <Button variant="outline" onClick={tentarNovamente}>Tentar novamente</Button>}
    {carregando && <p role="status">Consultando histórico produtivo…</p>}
    {!carregando && !erro && dados && resumo.ultima && <div className="producao-metricas">
      <section aria-label="Última aferição"><span>Última aferição<AjudaCampo rotulo="Sobre a variação da produção" texto="Exige duas aferições completas consecutivas, na mesma lactação conhecida e com as mesmas ordenhas e estados. Parciais e mudanças de rotina não são comparadas."/></span><strong>{formatarLitros(resumo.ultima.litros)}</strong><small>{dataSanitaria(resumo.ultima.data)}{!resumo.ultima.completa && " · Parcial"}</small>
      <small>{resumo.variacao === null ? "Sem comparação equivalente" : `${resumo.variacao < 0 ? "−" : "+"}${formatarLitros(Math.abs(resumo.variacao))} frente à anterior`}</small></section>
      <section aria-label="Média dos dias medidos"><span>Média dos dias medidos<AjudaCampo rotulo="Sobre a média das aferições" texto="Média dos volumes conhecidos somente nos dias aferidos, incluindo subtotais parciais identificados. Não estima intervalos sem controle."/></span><strong>{formatarLitros(resumo.media)}</strong><small>{resumo.pontos.length} {resumo.pontos.length === 1 ? "dia aferido" : "dias aferidos"}{resumo.pontos.some(p => !p.completa) && " · Inclui parciais"}</small></section>
      <section aria-label="Maior aferição"><span>Maior aferição</span><strong>{formatarLitros(resumo.maior?.litros ?? null)}</strong><small>{resumo.maior && dataSanitaria(resumo.maior.data)}{resumo.maior && !resumo.maior.completa && " · Parcial"}</small></section>
      <section aria-label="Volume conhecido"><span>Volume conhecido<AjudaCampo rotulo="Sobre o volume individual do período" texto="Soma somente os litros individuais medidos em todo o período, sem exclusões. A busca e os filtros de situação alteram a consulta abaixo; os indicadores mantêm todo o período. Pendências não recebem zero presumido."/></span><strong>{formatarLitros(dados.totaisPeriodo.litros)}</strong>{dados.totaisPeriodo.pendentes > 0 && <small>{dados.totaisPeriodo.pendentes} ordenha(s) · Produção parcial</small>}</section>
    </div>}
    <div className="producao-barra"><label className="producao-busca"><Search size={17} aria-hidden="true"/><Input aria-label="Buscar aferição" placeholder="Buscar aferição" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); visualizacao.mudar("tabela"); }}/></label>
      {periodoPicker}<Button variant="outline" aria-expanded={filtros} onClick={() => setFiltros(v => !v)}><SlidersHorizontal size={16}/>Filtros{situacao !== "todas" && " · 1"}</Button>
      <div className="producao-alternador" role="group" aria-label="Apresentação das aferições"><Button variant={visualizacao.modo === "visual" ? "default" : "outline"} aria-pressed={visualizacao.modo === "visual"} onClick={() => visualizacao.mudar("visual")}><ChartLine size={16}/>Gráfico</Button><Button variant={visualizacao.modo === "tabela" ? "default" : "outline"} aria-pressed={visualizacao.modo === "tabela"} onClick={() => visualizacao.mudar("tabela")}><Table2 size={16}/>Tabela</Button></div>
    </div>
    {filtros && <div className="producao-filtros"><label>Situação<select value={situacao} onChange={e => { setSituacao(e.target.value); setPagina(1); visualizacao.mudar("tabela"); }}><option value="todas">Todas</option><option value="Completa">Completas</option><option value="Parcial">Parciais</option><option value="Excluída">Excluídas</option></select></label><Button variant="outline" onClick={() => { setSituacao("todas"); setBusca(""); setPagina(1); }}>Limpar filtros</Button></div>}
    {!carregando && !erro && dados && <>
      {!registros.length ? <VazioProducao>{busca || situacao !== "todas" ? "Nenhuma aferição corresponde aos filtros" : <>Nenhuma aferição no período</>}</VazioProducao>
      : visualizacao.modo === "visual" ? pontos.length ? <EvolucaoProducaoIndividual pontos={pontos}/> : <VazioProducao>Nenhum volume conhecido para o gráfico. Consulte os registros na tabela.</VazioProducao>
      : <><div className="producao-tabela" role="region" aria-label="Aferições do animal" tabIndex={0}><table><caption className="sr-only">Aferições do animal</caption><thead><tr><th scope="col">Data</th><th scope="col">Volume conhecido</th><th scope="col">DEL</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead><tbody>{paginaItens.map(d => <tr key={d.participanteId}><td><strong>{dataSanitaria(d.dataOperacional)}</strong></td><td>{formatarLitros(d.totais.litros)}</td><td>{d.del === null ? "Não informado" : `${d.del} dias`}</td><td><span className="producao-situacao">{situacaoDia(d)}</span></td><td><Button onClick={() => setDetalhe(d)}>Detalhes</Button></td></tr>)}</tbody></table></div>
      <nav className="historico-produtivo-paginas" aria-label="Páginas do histórico produtivo"><span>{registros.length} {registros.length === 1 ? "registro" : "registros"} · página {paginaAtual} de {Math.max(1, Math.ceil(registros.length / 10))}</span>{registros.length > 10 && <><Button variant="outline" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button><Button variant="outline" disabled={paginaAtual * 10 >= registros.length} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button></>}</nav></>}
      <section className="producao-rotina"><h3>Controle individual</h3>
      <dl className="producao-ficha-rotina" role="group" aria-label="Rotina e cobertura do controle individual">
        {dados.controleIndividual && <>
          <div><dt>Intervalo individual</dt><dd>A cada {dados.controleIndividual.quantidade} {dados.controleIndividual.unidade === "MESES" ? dados.controleIndividual.quantidade === 1 ? "mês" : "meses" : dados.controleIndividual.quantidade === 1 ? "dia" : "dias"}</dd></div>
          <div><dt>Última aferição até {dataSanitaria(dados.periodo.fim)}</dt><dd>{dados.controleIndividual.ultimaAfericao ? dataSanitaria(dados.controleIndividual.ultimaAfericao) : "Não registrada"}</dd></div>
          <div><dt>Próxima referência<AjudaCampo rotulo="Sobre a próxima referência" texto="Data de referência calculada pelo intervalo configurado a partir do último controle, sem criar aferição ou estimar litros."/></dt><dd>{dados.controleIndividual.proximaAfericao ? dataSanitaria(dados.controleIndividual.proximaAfericao) : "Aguarda a primeira aferição"}</dd></div>
        </>}
        <div><dt>Dias com participação registrada<AjudaCampo rotulo="Sobre a cobertura do período" texto="Dias com participação ativa em todo o recorte, inclusive pendentes. Não certifica volume conhecido para todas as ordenhas."/></dt><dd>{dados.coberturaPeriodo.diasComRegistro} de {dados.coberturaPeriodo.diasCalendario} dias</dd></div>
      </dl>
      </section><ContextoCarencia contexto={dados.carenciaLeite} animalId={animalId}/>
    </>}
    </>}
  </>;
  const compor = (contexto: ReactNode, acoes: ReactNode) => <SecaoGeralAnimal icon={Milk} id="historico-produtivo-leite" className="historico-produtivo producao-individual" titulo="Produção individual" acao={<>{acoes}<Button onClick={() => navegarPara(`/pecuaria/leite?leiteModo=individual${dados ? `&leiteBusca=${encodeURIComponent(dados.animal.brinco)}` : ""}`)}>Abrir controle individual</Button></>}>
    {contexto && <div id="lactacao-atual-animal" className="producao-contexto-lactacao">{contexto}</div>}{conteudo}
  </SecaoGeralAnimal>;
  return <>{lactacao ? <LactacaoIndividual {...lactacao} animalId={animalId} recarregarToken={recarregarToken} compor={compor}/> : compor(null, null)}
    {detalhe && dados && <AfericaoAnimalDetalhe dia={detalhe} animal={`${dados.animal.brinco}${dados.animal.nome ? ` · ${dados.animal.nome}` : ""}`} fechar={() => setDetalhe(null)}/>}
  </>;
}
