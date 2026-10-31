import { useEffect, useState } from "react";
import { ClassificarCustoAplicacao } from "./ClassificarCustoAplicacao";
import { CarenciasSanitarias } from "./CarenciasSanitarias";
import type { CarenciaAnimal } from "./api";
import { reqSanidade } from "./api";
import "./detalhe-sanitario.css";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { nomeCampoExame } from "./CamposExame";
import { LinkInterno } from "../../../components/LinkInterno";
import { CustosDiretos } from "../custos/CustosDiretos";
import { getUsuario } from "../../../lib/auth";
import { rotuloSituacaoTarefa } from "./RegularizacaoTarefa";
import { linkOperacaoFinanceira } from "../../../financeiro/navegacao";
import { podeVerValoresFinanceiros } from "../../../financeiro/permissoes";
import { podeAcessarArea } from "../../../estoque/navegacao";
import { dataHoraSanitaria, dataSanitaria, origemSanitaria, estadoSanitario, unidadeSanitaria } from "./rotulos";
import { Activity, FlaskConical, Syringe, FileText, UserRound, CalendarDays, Clock3, Package, Hash, MapPin, Link2 } from "lucide-react";
import { DadoFicha } from "../ui";
import { ResumoCustoAplicacao } from "./ResumoCustoAplicacao";
import { TempoDesdeFato } from "./TempoDesdeFato";
import type { ResumoCustos } from "../custos/api";
import { HistoricoExame } from "./HistoricoExame";
import { resultadoExameSanitario } from "./rotulos";
import type { ExameResultado } from "./ResultadoExame";
import { valorComparacaoExecucao } from "./PreviaExecucao";

type RegistroDetalhe = Record<string, unknown>;
const registro = (valor: unknown): RegistroDetalhe => valor && typeof valor === "object" ? valor as RegistroDetalhe : {};
const textoDetalhe = (valor: unknown) => valor == null || valor === "" ? "Não informado" : String(valor);
function formatarCampo(chave: string, fato: RegistroDetalhe): string {
  const valor = chave === "partidaCodigoSnapshot" ? fato.loteNome || fato[chave] : chave === "aplicadaEm" ? fato.aplicadaEm || fato.data : fato[chave];
  if (["data", "inicio", "fim", "partidaValidadeSnapshot", "previstaPara"].includes(chave) || chave === "aplicadaEm" && !fato.aplicadaEm) return dataSanitaria(valor == null ? null : String(valor));
  if (["aplicadaEm", "canceladaEm"].includes(chave)) return dataHoraSanitaria(valor == null ? null : String(valor));
  if (chave === "origemInsumo") return origemSanitaria(String(valor ?? ""));
  if (chave === "unidadeDose") return unidadeSanitaria(String(valor ?? "")) || "Não informado";
  if (chave === "status" || chave.startsWith("estadoCarencia")) return estadoSanitario(String(valor ?? "Não informado"));
  return textoDetalhe(valor);
}
const dadosDetalhe: Record<string, Array<[string, string]>> = {
  ocorrencia: [["Início", "inicio"], ["Fim", "fim"], ["Situação", "status"], ["Desfecho", "desfecho"]],
  aplicacao: [["Data e hora", "aplicadaEm"], ["Tipo de aplicação", "tipoAplicacaoNomeSnapshot"], ["Situação", "status"], ["Quantidade", "dose"], ["Unidade", "unidadeDose"], ["Origem", "origemInsumo"], ["Responsável", "responsavel"], ["Via", "via"], ["Lote", "partidaCodigoSnapshot"], ["Validade do lote", "partidaValidadeSnapshot"], ["Carência leite", "estadoCarenciaLeite"], ["Prazo leite (h)", "carenciaLeiteHoras"], ["Carência carne", "estadoCarenciaCarne"], ["Prazo carne (h)", "carenciaCarneHoras"]],
  exame: [["Data", "data"], ["Responsável", "responsavel"]],
  tarefa: [["Data prevista", "previstaPara"]],
  execucao: [["Início", "inicio"], ["Situação", "status"], ["Cancelada em", "canceladaEm"]],
};
function DesvioProtocolo({ valor }: { valor: unknown }) {
  if (valor == null) return <section><h3 className="font-semibold">Execução do protocolo</h3><p>Desvio não aferido no registro original.</p></section>;
  const snapshot = registro(valor);
  const diferencas = Array.isArray(snapshot.diferencas) ? snapshot.diferencas.map(registro) : [];
  const rotulos: Record<string, string> = { data: "Data", produtoId: "Produto", tipoAplicacaoId: "Tipo de aplicação", dose: "Dose", unidadeDose: "Unidade", via: "Via", tipoExameId: "Tipo de exame" };
  const exibicao = registro(snapshot.exibicao);
  const planejado = registro(exibicao.planejado);
  const realizado = registro(exibicao.realizado);
  const naoAferido = snapshot.aferido === false || snapshot.referencia === "LEGADO_SEM_SNAPSHOT";
  return <section className="grid gap-2 rounded-lg border border-border p-3"><h3 className="font-semibold">Planejado e realizado</h3>{naoAferido && <p>Planejamento antigo sem todos os parâmetros congelados. Conformidade não aferida.</p>}{diferencas.length ? <ul className="list-inside list-disc">{diferencas.map((d, i) => <li key={i}>{rotulos[String(d.campo)] ?? String(d.campo)}: {valorComparacaoExecucao(String(d.campo), d.planejado, planejado[String(d.campo)])} → {valorComparacaoExecucao(String(d.campo), d.realizado, realizado[String(d.campo)])}</li>)}</ul> : !naoAferido && <p>Conforme o planejado.</p>}{(diferencas.length > 0 || naoAferido) && <p><strong>Motivo:</strong> {textoDetalhe(snapshot.motivo)}</p>}</section>;
}
export function DetalheSanitario({ tipo, valor, abrir, onAtualizado }: { tipo: string; valor: unknown; abrir: (tipo: string, id: string, propriedadeId?: number) => void; onAtualizado?: () => void }) {
  const IconeDetalhe = tipo === "exame" ? FlaskConical : tipo === "tarefa" ? CalendarDays : tipo === "aplicacao" ? Syringe : Activity;
  const fato = registro(valor);
  const [erroCusto, setErroCusto] = useState<string | null>(null);
  const [classificandoCusto, setClassificandoCusto] = useState(false);
  const [resumoCustoAtual, setResumoCustoAtual] = useState<ResumoCustos | null | undefined>(fato.resumoCusto as ResumoCustos | null | undefined);
  useEffect(() => { setResumoCustoAtual(fato.resumoCusto as ResumoCustos | null | undefined); }, [valor]);
  const acessoFinanceiro = podeAcessarArea("financeiro") && podeVerValoresFinanceiros();
  const execucaoTarefa = registro(fato.execucao);
  const parametros = registro(fato.parametros);
  const produto = registro(fato.produto);
  const servico = registro(fato.operacaoServico);
  const animal = registro(fato.animal ?? execucaoTarefa.animal);
  const protocolo = registro(fato.protocolo ?? execucaoTarefa.protocolo);
  const propriedade = registro(fato.propriedade ?? fato.propriedadePrevista);
  const doenca = registro(fato.doenca);
  const tipoExame = registro(fato.tipoExame);
  const ocorrencia = registro(fato.ocorrencia);
  const tarefa = registro(fato.tarefa);
  const movimento = registro(fato.movimentoEstoque);
  const compra = registro(fato.compraDireta);
  const operacaoCompra = registro(compra.operacao);
  const estorno = registro(fato.estorno);
  const linksJaExibidos = [
    ...[movimento.id, estorno.id].filter(Boolean).map(id => `/estoque?movimentoId=${encodeURIComponent(String(id))}&propriedadeId=${encodeURIComponent(String(fato.propriedadeId ?? ""))}`),
    ...(acessoFinanceiro ? [fato.operacaoServicoId, operacaoCompra.id].filter(Boolean).map(id => linkOperacaoFinanceira(String(id))) : []),
  ];
  const links: Array<[string, string, string, number?]> = [];
  if (ocorrencia.id) links.push(["Ocorrência relacionada", "ocorrencia", String(ocorrencia.id)]);
  if (tarefa.execucaoId) links.push(["Execução do protocolo", "execucao", String(tarefa.execucaoId)]);
  for (const [chave, nome, destino] of [["aplicacoes", "Aplicação", "aplicacao"], ["exames", "Exame", "exame"], ["execucoes", "Execução", "execucao"]] as const) {
    for (const item of Array.isArray(fato[chave]) ? fato[chave] : []) {
      const vinculo = registro(item);
      if (vinculo.id) links.push([`${nome} · ${vinculo.aplicadaEm ? dataHoraSanitaria(String(vinculo.aplicadaEm)) : dataSanitaria(String(vinculo.data ?? vinculo.inicio ?? ""))}`, destino, String(vinculo.id), typeof vinculo.propriedadeId === "number" ? vinculo.propriedadeId : undefined]);
    }
  }
  return <div className="pec-detalhe-sanitario">
    <section className="sanitario-bloco-estatico"><header><IconeDetalhe size={20} aria-hidden /><h3>Detalhes</h3>{(fato.status != null || fato.situacao != null) && <Badge variant="secondary">{tipo === "exame" && fato.status === "VALIDO" ? "Válido" : tipo === "tarefa" ? rotuloSituacaoTarefa(String(fato.situacao)) : estadoSanitario(String(fato.status))}</Badge>}</header><div className="sanitario-bloco-conteudo">
    {tipo !== "aplicacao" && <dl className="sanitario-dados sanitario-identidade">
      {!!propriedade.nome && <div><dt>Sítio do fato</dt><dd>{String(propriedade.nome)}</dd></div>}
      <div><dt>Animal</dt><dd>{animal.id ? <LinkInterno area="pecuaria" href={`/pecuaria/rebanho/animais/${encodeURIComponent(String(animal.id))}`}>{textoDetalhe(animal.brinco)}{animal.nome ? ` · ${String(animal.nome)}` : ""}</LinkInterno> : "Não informado"}</dd></div>
      {!!doenca.nome && <div><dt>Doença</dt><dd>{String(doenca.nome)}</dd></div>}
      {!!tipoExame.nome && <div><dt>Tipo de exame</dt><dd>{String(tipoExame.nome)}</dd></div>}
      {!!protocolo.nome && <div><dt>Protocolo</dt><dd>{String(protocolo.nome)} · versão {textoDetalhe(protocolo.versao)}</dd></div>}

    </dl>}
    {tipo === "aplicacao" && <dl className="sanitario-dados sanitario-aplicacao-dados">
      <DadoFicha icon={UserRound} rotulo="Animal">{animal.id ? <LinkInterno area="pecuaria" href={`/pecuaria/rebanho/animais/${encodeURIComponent(String(animal.id))}`}>{textoDetalhe(animal.brinco)}{animal.nome ? ` · ${String(animal.nome)}` : ""}</LinkInterno> : "Não informado"}</DadoFicha>
      <DadoFicha icon={UserRound} rotulo="Responsável">{textoDetalhe(fato.responsavel)}</DadoFicha>
      <DadoFicha icon={CalendarDays} rotulo="Data">{formatarCampo("aplicadaEm", fato)}</DadoFicha>
      <DadoFicha icon={Clock3} rotulo="Tempo desde a aplicação"><TempoDesdeFato data={typeof fato.data === "string" ? fato.data : fato.aplicadaEm ? new Date(String(fato.aplicadaEm)).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : ""} /></DadoFicha>
      <DadoFicha icon={Package} rotulo="Produto">{produto.id ? <LinkInterno area="estoque" href={`/estoque/produtos/${encodeURIComponent(String(produto.id))}`}>{textoDetalhe(produto.nome)}</LinkInterno> : textoDetalhe(fato.nomeProdutoAplicado)}</DadoFicha>
      <DadoFicha icon={Hash} rotulo="Lote do produto">{formatarCampo("partidaCodigoSnapshot", fato)}</DadoFicha>
      <DadoFicha icon={Syringe} rotulo="Dose / via">{fato.dose != null ? `${textoDetalhe(fato.dose)} ${unidadeSanitaria(String(fato.unidadeDose ?? ""))}` : "Dose não informada"} · {fato.via ? String(fato.via) : "Via não informada"}</DadoFicha>
      <DadoFicha icon={Link2} rotulo="Vínculo">{ocorrencia.id ? textoDetalhe(ocorrencia.doencaNomeSnapshot) : tarefa.execucaoId ? "Protocolo" : "Aplicação avulsa"}</DadoFicha>
      <DadoFicha icon={MapPin} rotulo="Sítio do fato">{textoDetalhe(propriedade.nome)}</DadoFicha>
      {!!fato.operacaoServicoId && <DadoFicha icon={FileText} rotulo="Serviço veterinário">{acessoFinanceiro ? <LinkInterno area="financeiro" href={linkOperacaoFinanceira(String(fato.operacaoServicoId), window.location.pathname + window.location.search)}>{servico.numero != null ? `Operação #${String(servico.numero)}` : "Ver origem financeira"}</LinkInterno> : "Serviço vinculado"}</DadoFicha>}
    </dl>}
    {tipo === "tarefa" && <dl className="sanitario-dados"><div><dt>Tarefa</dt><dd>{textoDetalhe(parametros.tipoAplicacaoNomeSnapshot ?? parametros.tipoExameNomeSnapshot ?? parametros.tipo)}</dd></div><div><dt>Produto planejado</dt><dd>{textoDetalhe(parametros.produtoNomeSnapshot)}</dd></div><div><dt>Dose / via planejada</dt><dd>{textoDetalhe(parametros.dose)} {unidadeSanitaria(String(parametros.unidade ?? ""))} · {textoDetalhe(parametros.via)}</dd></div></dl>}
    {!!fato.justificativaSemOrigem && <p><strong>Justificativa original da origem:</strong> {String(fato.justificativaSemOrigem)}</p>}
    {(tipo === "aplicacao" || tipo === "exame") && (!!fato.tarefaId || !!tarefa.id || fato.desvioProtocoloSnapshot != null) && <DesvioProtocolo valor={fato.desvioProtocoloSnapshot} />}
    {tipo === "aplicacao" && !!produto.id && produto.nome !== fato.nomeProdutoAplicado && <><p><strong>Produto vinculado:</strong> {textoDetalhe(produto.nome)}</p><p><strong>Nome histórico do medicamento:</strong> {textoDetalhe(fato.nomeProdutoAplicado)}</p></>}
    <dl className="sanitario-dados">{(tipo === "aplicacao" ? dadosDetalhe.aplicacao.filter(([, chave]) => ["tipoAplicacaoNomeSnapshot", "origemInsumo", "partidaValidadeSnapshot", "estadoCarenciaLeite", "carenciaLeiteHoras", "estadoCarenciaCarne", "carenciaCarneHoras"].includes(chave) && !(fato.prazosRegistrados && chave.startsWith("estadoCarencia") || fato.prazosRegistrados && chave.startsWith("carencia"))) : dadosDetalhe[tipo] ?? []).map(([rotulo, chave]) => <div key={chave}><dt className="text-ink-3">{rotulo}</dt><dd>{formatarCampo(chave, fato)}</dd></div>)}</dl>
    {tipo === "aplicacao" && !!fato.prazosRegistrados && <><CarenciasSanitarias integrado rotulo="Prazos registrados na aplicação" carencia={fato.prazosRegistrados as CarenciaAnimal} horasRegistradas={{ leite: typeof fato.carenciaLeiteHoras === "number" ? fato.carenciaLeiteHoras : null, carne: typeof fato.carenciaCarneHoras === "number" ? fato.carenciaCarneHoras : null }} />{fato.status === "ANULADO" && <p className="text-sm text-ink-3">Prazos históricos desta aplicação anulada. Consulte as carências atuais do animal.</p>}</>}
    {tipo === "exame" && !!fato.formatoSnapshot && <>
      <section className="sanitario-resultado" aria-label="Resultado do exame"><h3>Resultado</h3>
        {registro(fato.formatoSnapshot).tipoResultado === "MULTIPLO" && Array.isArray(fato.resultados) && fato.resultados.length > 0 ? <dl className="sanitario-dados">{(fato as unknown as ExameResultado).resultados!.map((item, indice) => {
          const campo = (fato as unknown as ExameResultado).formatoSnapshot.campos?.find(c => c.codigo === item.campo) ?? { codigo: item.campo };
          const resultado = typeof item.valor === "boolean" ? item.valor ? "Sim" : "Não" : typeof item.valor === "object" && item.valor !== null ? JSON.stringify(item.valor) : textoDetalhe(item.valor);
          return <div key={`${item.campo}-${indice}`}><dt>{nomeCampoExame(campo)}</dt><dd>{resultado}</dd></div>;
        })}</dl> : <p className="sanitario-resultado-valor">{resultadoExameSanitario(fato as unknown as ExameResultado)}</p>}
      </section>
      <HistoricoExame key={String(fato.id)} exameId={String(fato.id)} propriedadeId={typeof fato.propriedadeId === "number" ? fato.propriedadeId : undefined} formato={(fato as unknown as ExameResultado).formatoSnapshot} />
    </>}
    {(tipo === "aplicacao" || fato.observacao != null || fato.motivoAnulacao != null) && <section className="sanitario-observacoes"><h3>Observações</h3>{tipo === "aplicacao" && fato.observacao == null && <p>Sem observações.</p>}{fato.observacao != null && <p>{textoDetalhe(fato.observacao)}</p>}{fato.motivoAnulacao != null && <p><strong>Motivo da anulação:</strong> {textoDetalhe(fato.motivoAnulacao)}</p>}</section>}
    {fato.criadoEm != null && <dl className="sanitario-dados sanitario-autoria"><div><dt>Registrado em</dt><dd>{dataHoraSanitaria(String(fato.criadoEm))}</dd></div>{!!registro(fato.criadoPor).nome && <div><dt>Registrado por</dt><dd>{String(registro(fato.criadoPor).nome)}</dd></div>}</dl>}
    {!!fato.loteNome && typeof fato.partidaCodigoSnapshot === "string" && fato.partidaCodigoSnapshot !== fato.loteNome && !/^LOTE-[0-9a-f-]{36}$/i.test(fato.partidaCodigoSnapshot) && <p className="text-ink-3">Referência histórica do lote: {fato.partidaCodigoSnapshot}</p>}
    {!!movimento.id && <p><strong>Saída do estoque:</strong> <LinkInterno area="estoque" href={`/estoque?movimentoId=${encodeURIComponent(String(movimento.id))}${fato.propriedadeId ? `&propriedadeId=${encodeURIComponent(String(fato.propriedadeId))}` : ""}`}>Ver movimento</LinkInterno></p>}
    {!!estorno.id && <p><strong>Estorno do estoque:</strong> <LinkInterno area="estoque" href={`/estoque?movimentoId=${encodeURIComponent(String(estorno.id))}&propriedadeId=${encodeURIComponent(String(fato.propriedadeId ?? ""))}`}>Ver movimento de estorno</LinkInterno></p>}
    {!!operacaoCompra.id && acessoFinanceiro && <p><strong>Compra direta:</strong> <LinkInterno area="financeiro" href={linkOperacaoFinanceira(String(operacaoCompra.id), window.location.pathname + window.location.search)}>Operação #{String(operacaoCompra.numero)}</LinkInterno> · {textoDetalhe(compra.quantidade)} {unidadeSanitaria(String(compra.unidade ?? ""))} comprados · {textoDetalhe(compra.quantidadeDestinada)} {unidadeSanitaria(String(compra.unidade ?? ""))} destinados · {textoDetalhe(compra.quantidadeDisponivel)} {unidadeSanitaria(String(compra.unidade ?? ""))} disponíveis</p>}
    {tipo !== "aplicacao" && !!fato.operacaoServicoId && acessoFinanceiro && <p><strong>Serviço:</strong> <LinkInterno area="financeiro" href={linkOperacaoFinanceira(String(fato.operacaoServicoId), window.location.pathname + window.location.search)}>Ver origem financeira</LinkInterno></p>}
    {links.length > 0 && <section><h3 className="font-semibold">Fatos relacionados</h3><div className="mt-2 flex flex-wrap gap-2">{links.map(([rotulo, destino, id, propriedadeId]) => <Button key={`${destino}-${id}`} type="button" variant="outline" onClick={() => abrir(destino, id, propriedadeId)}>{rotulo}</Button>)}</div></section>}
    {Array.isArray(fato.tarefas) && <section><h3 className="font-semibold">Tarefas</h3><div className="mt-2 space-y-2">{fato.tarefas.map((item) => { const t = registro(item); return <p key={String(t.id)} className="rounded-lg border border-border p-2">{dataSanitaria(String(t.previstaPara ?? ""))} · {rotuloSituacaoTarefa(String(t.situacao ?? (t.regularizacaoPendente ? "REGULARIZACAO_PENDENTE" : t.dispensadaEm ? "DISPENSADA" : "PENDENTE")))}</p>; })}</div></section>}
    </div></section>
    {tipo === "aplicacao" && <section className="sanitario-bloco-estatico"><header><FileText size={20} aria-hidden /><h3>Custo da aplicação</h3></header><div className="sanitario-bloco-conteudo"><ResumoCustoAplicacao resumo={resumoCustoAtual} anulado={fato.status === "ANULADO" && !fato.consumoMantido} />{acessoFinanceiro && (!!getUsuario()?.dono || !!getUsuario()?.flags.includes("lancar")) && typeof fato.propriedadeId === "number" && typeof fato.id === "string" && (fato.status !== "ANULADO" || !!fato.consumoMantido) && <Button type="button" onClick={() => setClassificandoCusto(true)}>Classificar custo</Button>}</div></section>}
    {classificandoCusto && typeof fato.propriedadeId === "number" && typeof fato.id === "string" && <ClassificarCustoAplicacao id={fato.id} propriedadeId={fato.propriedadeId} aoFechar={salvou => { setClassificandoCusto(false); if (salvou) { onAtualizado?.(); void reqSanidade<{ resumoCusto: ResumoCustos | null }>(`/aplicacoes/${encodeURIComponent(String(fato.id))}?propriedadeId=${fato.propriedadeId}`, undefined, fato.propriedadeId as number).then(d => { setResumoCustoAtual(d.resumoCusto); setErroCusto(null); }).catch(e => setErroCusto(e instanceof Error ? e.message : String(e))); } }} />}
    {erroCusto && <p role="alert">Não foi possível atualizar o custo: {erroCusto}</p>}
    {tipo !== "aplicacao" && typeof fato.propriedadeId === "number" && typeof fato.id === "string" && ["exame","execucao"].includes(tipo) && <CustosDiretos fatoEmConsulta={{ tipoFonte: tipo === "exame" ? "EXAME" : "PARTICIPACAO", fonteId: fato.id }} linksJaExibidos={linksJaExibidos} {...(tipo === "exame" ? {exameId:fato.id} : {participacaoId:fato.id})} propriedadeId={fato.propriedadeId} podeLancar={!!getUsuario()?.dono || !!getUsuario()?.flags.includes("lancar")} />}
  </div>;
}
