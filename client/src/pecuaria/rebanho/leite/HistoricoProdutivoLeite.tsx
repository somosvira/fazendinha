import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { EvolucaoProducaoIndividual } from "./EvolucaoProducaoIndividual";
import { ControlesHistoricosLeite } from "./ControlesHistoricosLeite";
import { resumirAfericoesIndividuais } from "./producao-individual.calc";
import { DateRangePicker, dateFromIso, isoDate } from "@/components/DateRangePicker";
import { AjudaCampo } from "@/components/Dica";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { SecaoFicha } from "../components/SecaoRecolhivel";
import { dataHoraSanitaria, dataSanitaria } from "../sanidade/rotulos";
import { navegarPara } from "../../../router";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros } from "./modelo";
import type { HistoricoProdutivo, ContextoCarenciaLeite } from "./historico-types";
import "./historico-produtivo.css";
function periodoInicial() { const fim = hojeOperacional(), inicio = new Date(`${fim}T00:00:00Z`); inicio.setUTCDate(inicio.getUTCDate() - 29); return { inicio: inicio.toISOString().slice(0, 10), fim }; }
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
  return <SecaoFicha id="carencia-producao-leite" className="historico-produtivo-carencia" titulo="Carência do leite" acoes={<><AjudaCampo rotulo="Sobre carência do leite" texto="Destino registrado separadamente; esta consulta não confirma descarte nem aptidão sanitária."/><Button variant="outline" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${animalId}#sanidade`)}>Conferir Sanidade</Button></>}>
    <div className="historico-carencia-situacao"><p>{texto}</p><span>Referência: {dataSanitaria(contexto.dataReferencia)}</span></div>
  </SecaoFicha>;
}
export function HistoricoProdutivoLeite({ animalId, propriedadeId, recarregarToken = 0 }: { animalId: string; propriedadeId: number | null; recarregarToken?: number }) {
  const visualizacao = useVisualizacaoConsulta("animalProducaoVisualizacao", "leite");
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<HistoricoProdutivo | null>(null), [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(true);
  useEffect(() => { setPagina(1); setDados(null); }, [animalId, propriedadeId]);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null); setDados(null);
    consultarLeite<HistoricoProdutivo>(`/animais/${encodeURIComponent(animalId)}?${new URLSearchParams({ ...periodo, pagina: String(pagina), tamanho: "20" })}`, propriedadeId)
      .then(r => { if (vivo) setDados(r); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível consultar a produção"); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [animalId, propriedadeId, periodo, pagina, recarregarToken, revisao]);
  const serie = dados?.seriePeriodo ?? (dados && dados.total <= dados.itens.length ? dados.itens.map(d => ({ participanteId: d.participanteId, data: d.dataOperacional, litros: d.totais.litros, completa: d.totais.completa, excluido: d.excluidoEm !== null, lactacaoId: d.lactacao?.id ?? null, comparabilidade: d.medicoes.map(m => `${m.posicaoId}:${m.estado}`).sort().join("|"), finalidade: d.finalidade.estado })) : []);
  const resumo = resumirAfericoesIndividuais(serie);
  const sinal = resumo.variacao !== null && resumo.variacao < 0 ? "−" : "+";
  const filtroPeriodo = <DateRangePicker anchor="right" triggerAriaLabel="Período da produção" value={{ start: dateFromIso(periodo.inicio), end: dateFromIso(periodo.fim) }} onChange={({ start, end }) => {
      if (!start || !end) return;
      const hoje = hojeOperacional();
      const fim = isoDate(end) > hoje ? hoje : isoDate(end);
      if (isoDate(start) > fim) { setErro("Informe um período até a data de hoje."); return; }
      setPagina(1); setPeriodo({ inicio: isoDate(start), fim });
    }} />;
  return <><SecaoFicha id="historico-produtivo-leite" className="historico-produtivo" titulo="Histórico produtivo">
    <ErrorBox erro={erro} />{erro && <Button variant="outline" onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
    {carregando && <p role="status">Consultando histórico produtivo…</p>}
    {(carregando || erro) && <div className="producao-filtro-consulta">{filtroPeriodo}</div>}
    {!carregando && !erro && dados && <>
      <ControlesHistoricosLeite itens={dados.controlesDocumentais ?? []} />
      {resumo.ultima && <div className="animal-indicadores">
        <Card asChild><section aria-label="Última aferição"><span>Última aferição<AjudaCampo rotulo="Sobre a última aferição" texto="Último volume medido no período, sem participações excluídas. Parcial indica ordenhas pendentes, nunca produção zero."/></span><strong>{formatarLitros(resumo.ultima.litros)}</strong><div>{dataSanitaria(resumo.ultima.data)}{!resumo.ultima.completa && " · Parcial"}</div><div className={resumo.variacao !== null && resumo.variacao < 0 ? "variacao-negativa" : ""}>{resumo.variacao === null ? "Sem comparação equivalente" : `${sinal}${formatarLitros(Math.abs(resumo.variacao))} frente à anterior`}<AjudaCampo rotulo="Sobre a variação da produção" texto={resumo.variacao === null ? "Exige duas aferições completas consecutivas, na mesma lactação conhecida e com as mesmas ordenhas e estados. Parciais e mudanças de rotina não são comparadas." : `Compara ${dataSanitaria(resumo.ultima.data)} com ${dataSanitaria(resumo.anterior!.data)}.${resumo.percentual === null ? " Percentual não calculado porque a anterior é zero." : ` Variação de ${resumo.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%.`}`}/></div></section></Card>
        <Card asChild><section aria-label="Média dos dias medidos"><span>Média dos dias medidos<AjudaCampo rotulo="Sobre a média das aferições" texto="Média dos volumes conhecidos somente nos dias aferidos, incluindo subtotais parciais identificados. Não representa média do calendário nem estima intervalos sem controle."/></span><strong>{formatarLitros(resumo.media)}</strong><div>{resumo.pontos.length} dia(s) aferido(s){resumo.pontos.some(p => !p.completa) && " · Inclui parciais"}</div></section></Card>
        <Card asChild><section aria-label="Maior aferição"><span>Maior aferição<AjudaCampo rotulo="Sobre a maior aferição" texto="Maior volume observado em uma data do período completo, sem exclusões. Um subtotal parcial continua identificado e não estima as ordenhas pendentes."/></span><strong>{formatarLitros(resumo.maior?.litros ?? null)}</strong><div>{resumo.maior && dataSanitaria(resumo.maior.data)}{resumo.maior && !resumo.maior.completa && " · Parcial"}</div></section></Card>
      </div>}
      <div className="animal-curva-rotina" data-sem-evolucao={!resumo.pontos.length || undefined}>{resumo.pontos.length > 0 && <EvolucaoProducaoIndividual pontos={resumo.pontos}/>}<Card asChild className="animal-rotina"><section><h3>Controle individual</h3>
      <dl className="producao-ficha-rotina" role="group" aria-label="Rotina e cobertura do controle individual">
        {dados.controleIndividual && <>
          <div><dt>Intervalo individual<AjudaCampo rotulo="Sobre o intervalo individual" texto="Controles extras são permitidos. Dias entre aferições não são estimados."/></dt><dd>A cada {dados.controleIndividual.quantidade} {dados.controleIndividual.unidade === "MESES" ? dados.controleIndividual.quantidade === 1 ? "mês" : "meses" : dados.controleIndividual.quantidade === 1 ? "dia" : "dias"}</dd></div>
          <div><dt>Última aferição até {dataSanitaria(dados.periodo.fim)}<AjudaCampo rotulo="Sobre a última aferição da rotina" texto="Último controle individual conhecido até o fim do filtro, mesmo anterior ao início do período, sem participações excluídas."/></dt><dd>{dados.controleIndividual.ultimaAfericao ? dataSanitaria(dados.controleIndividual.ultimaAfericao) : "Não registrada"}</dd></div>
          <div><dt>Próxima referência<AjudaCampo rotulo="Sobre a próxima referência" texto="Data de referência calculada pelo intervalo configurado a partir do último controle, sem criar aferição ou estimar litros."/></dt><dd>{dados.controleIndividual.proximaAfericao ? dataSanitaria(dados.controleIndividual.proximaAfericao) : "Aguarda a primeira aferição"}</dd></div>
        </>}
        <div><dt>Dias com participação registrada<AjudaCampo rotulo="Sobre a cobertura do período" texto="Dias com participação ativa em todo o recorte, inclusive pendentes. Não certifica volume conhecido para todas as ordenhas."/></dt><dd>{dados.coberturaPeriodo.diasComRegistro} de {dados.coberturaPeriodo.diasCalendario} dias</dd></div>
      </dl></section></Card></div>
      {dados.itens.length > 0 && <dl className="historico-produtivo-resumo">
        <div><dt>Litros registrados no período<AjudaCampo rotulo="Sobre o volume individual do período" texto="Soma somente os litros individuais medidos em todo o recorte, antes da paginação, sem exclusões. Pendências e dias sem registro não recebem volume presumido."/></dt><dd>{formatarLitros(dados.totaisPeriodo.litros)}</dd></div>
        {dados.totaisPeriodo.pendentes > 0 && <div><dt>Medições pendentes<AjudaCampo rotulo="Sobre medições pendentes" texto="Ordenhas ainda sem aferição resolvida. O volume conhecido é parcial, sem zeros presumidos para essas ordenhas."/></dt><dd role="status">{dados.totaisPeriodo.pendentes} ordenha(s) · Produção parcial</dd></div>}
      </dl>}
      <header className="animal-historico-cabecalho"><h3>Aferições do animal<AjudaCampo rotulo="Sobre as aferições do animal" texto="Os cartões e a tabela mostram os mesmos registros da página. Indicadores e gráfico consideram todo o período, antes da paginação, sem rateio da produção geral."/></h3><div className="producao-filtro-consulta">{filtroPeriodo}{dados.itens.length > 0 && <AlternarVisualizacaoConsulta {...visualizacao} rotulo="Apresentação das aferições do animal"/>}</div></header>
      {dados.itens.length && visualizacao.modo === "visual" ? <div className="animal-afericoes">{dados.itens.map(d => <Card asChild key={d.participanteId}><article>
        <time dateTime={d.dataOperacional}>{dataSanitaria(d.dataOperacional)}</time><strong>{formatarLitros(d.totais.litros)}</strong>
        {d.excluidoEm && <p>Excluído dos totais{d.motivoExclusao ? ` · ${d.motivoExclusao}` : ""}</p>}{!d.totais.completa && <span>Parcial</span>}
        <dl><div><dt>Finalidade<AjudaCampo rotulo={`Sobre a finalidade em ${dataSanitaria(d.dataOperacional)}`} texto="Finalidade histórica na data da aferição; conciliação pendente preserva o volume medido."/></dt><dd>{d.finalidade?.estado === "COMPROVADA" ? "Leite comprovada na data" : "Finalidade histórica a conciliar"}</dd>{d.finalidade?.estado !== "COMPROVADA" && <p>Litros registrados preservados; finalidade ainda não comprovada.</p>}</div>
        <div><dt>Lactação e DEL<AjudaCampo rotulo={`Sobre a lactação em ${dataSanitaria(d.dataOperacional)}`} texto="DEL usa D0 no início da lactação; lactação ausente permanece não informada."/></dt><dd>{d.del === null ? "DEL não informado" : `${d.del} dias em lactação`}</dd><dd>{d.lactacao ? `Início em ${dataSanitaria(d.lactacao.inicio)}` : "Lactação não informada"}</dd></div></dl>
        <ul className="historico-produtivo-ordenhas" aria-label="Ordenhas registradas">{d.medicoes.map(m => <li key={m.posicaoId}><strong>{m.nomeOrdenha}:</strong> {m.estado === "MEDIDO" ? formatarLitros(m.litros) : m.estado === "NAO_ORDENHADO" ? "Não ordenhado" : "Medição pendente"}{m.motivo ? ` · ${m.motivo}` : ""}</li>)}</ul>
      </article></Card>)}</div> : dados.itens.length ? <div className="historico-produtivo-tabela" role="region" aria-label="Produção diária com rolagem horizontal" tabIndex={0}>
        <Table semContainer><TableCaption className="sr-only">Produção diária do animal entre {dataSanitaria(dados.periodo.inicio)} e {dataSanitaria(dados.periodo.fim)}</TableCaption>
          <TableHeader><TableRow><TableHead scope="col">Dia</TableHead><TableHead scope="col">Produção registrada<AjudaCampo rotulo="Sobre a produção registrada" texto="Ausências não são preenchidas com zero."/></TableHead><TableHead scope="col">Finalidade na produção</TableHead><TableHead scope="col">Lactação e DEL<AjudaCampo rotulo="Sobre lactação e DEL" texto="DEL usa D0 no início da lactação; lactação ausente permanece não informada."/></TableHead><TableHead scope="col">Ordenhas</TableHead></TableRow></TableHeader>
          <TableBody>{dados.itens.map(d => <TableRow key={d.participanteId}>
            <TableCell>{dataSanitaria(d.dataOperacional)}{d.excluidoEm && <p className="text-sm">Excluído dos totais{d.motivoExclusao ? ` · ${d.motivoExclusao}` : ""}</p>}</TableCell>
            <TableCell className="tabular-nums">{formatarLitros(d.totais.litros)}{!d.totais.completa && <p className="text-sm text-ink-3">Parcial</p>}</TableCell>
            <TableCell>{d.finalidade?.estado === "COMPROVADA" ? "Leite comprovada na data" : "Finalidade histórica a conciliar"}{d.finalidade?.estado !== "COMPROVADA" && <p className="text-sm text-ink-3">Litros registrados preservados; finalidade ainda não comprovada.</p>}</TableCell>
            <TableCell>{d.del === null ? "DEL não informado" : `${d.del} dias em lactação`}<p className="text-sm text-ink-3">{d.lactacao ? `Início em ${dataSanitaria(d.lactacao.inicio)}` : "Lactação não informada"}</p></TableCell>
            <TableCell><ul className="historico-produtivo-ordenhas" aria-label="Ordenhas registradas">{d.medicoes.map(m => <li key={m.posicaoId}><strong>{m.nomeOrdenha}:</strong> {m.estado === "MEDIDO" ? formatarLitros(m.litros) : m.estado === "NAO_ORDENHADO" ? "Não ordenhado" : "Medição pendente"}{m.motivo ? ` · ${m.motivo}` : ""}</li>)}</ul></TableCell>
          </TableRow>)}</TableBody></Table>
      </div> : <div className="producao-ficha-vazio" role="status"><h3 className="inline-flex items-center gap-1">Nenhuma aferição no período<AjudaCampo rotulo="Sobre ausência de aferições" texto="Sem registros não significa produção zero nem secagem."/></h3></div>}
      {dados.total > dados.tamanho && <nav aria-label="Páginas do histórico produtivo" className="historico-produtivo-paginas"><Button variant="outline" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button><span>Página {pagina} · {dados.total} registros</span><Button variant="outline" disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina(p => p + 1)}>Próxima</Button></nav>}
    </>}
  </SecaoFicha>{!carregando && !erro && dados && <ContextoCarencia contexto={dados.carenciaLeite} animalId={animalId} />}</>;
}
