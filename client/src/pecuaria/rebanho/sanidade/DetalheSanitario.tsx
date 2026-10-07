import { linkOperacaoFinanceira } from "../../../financeiro/navegacao";
import { podeAcessarArea } from "../../../estoque/navegacao";
import { dataHoraSanitaria, dataSanitaria, origemSanitaria, estadoSanitario, unidadeSanitaria } from "./rotulos";
import { fmtMoneyExact } from "../../../components/charts";
import { HistoricoExame } from "./HistoricoExame";
import { resultadoExameSanitario } from "./rotulos";
import type { ExameResultado } from "./ResultadoExame";
import { valorComparacaoExecucao } from "./PreviaExecucao";

type RegistroDetalhe = Record<string, unknown>;
const registro = (valor: unknown): RegistroDetalhe => valor && typeof valor === "object" ? valor as RegistroDetalhe : {};
const textoDetalhe = (valor: unknown) => valor == null || valor === "" ? "Não informado" : String(valor);
function formatarCampo(chave: string, fato: RegistroDetalhe): string {
  const valor = chave === "partidaCodigoSnapshot" ? fato.loteNome || fato[chave] : chave === "aplicadaEm" ? fato.aplicadaEm || fato.data : fato[chave];
  if (["data", "inicio", "fim", "partidaValidadeSnapshot"].includes(chave) || chave === "aplicadaEm" && !fato.aplicadaEm) return dataSanitaria(valor == null ? null : String(valor));
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
  return <section className="grid gap-2 rounded-lg border border-border p-3"><h3 className="font-semibold">Planejado e realizado</h3>{snapshot.referencia === "LEGADO_SEM_SNAPSHOT" && <p>Planejamento antigo sem todos os parâmetros congelados.</p>}{diferencas.length ? <><ul className="list-inside list-disc">{diferencas.map((d, i) => <li key={i}>{rotulos[String(d.campo)] ?? String(d.campo)}: {valorComparacaoExecucao(String(d.campo), d.planejado, planejado[String(d.campo)])} → {valorComparacaoExecucao(String(d.campo), d.realizado, realizado[String(d.campo)])}</li>)}</ul><p><strong>Motivo do desvio:</strong> {textoDetalhe(snapshot.motivo)}</p></> : <p>Conforme o planejado.</p>}</section>;
}
export function DetalheSanitario({ tipo, valor, abrir }: { tipo: string; valor: unknown; abrir: (tipo: string, id: string) => void }) {
  const fato = registro(valor);
  const produto = registro(fato.produto);
  const animal = registro(fato.animal);
  const protocolo = registro(fato.protocolo);
  const propriedade = registro(fato.propriedade);
  const doenca = registro(fato.doenca);
  const tipoExame = registro(fato.tipoExame);
  const ocorrencia = registro(fato.ocorrencia);
  const tarefa = registro(fato.tarefa);
  const movimento = registro(fato.movimentoEstoque);
  const compra = registro(fato.compraDireta);
  const operacaoCompra = registro(compra.operacao);
  const estorno = registro(fato.estorno);
  const links: Array<[string, string, string]> = [];
  if (ocorrencia.id) links.push(["Ocorrência relacionada", "ocorrencia", String(ocorrencia.id)]);
  if (tarefa.execucaoId) links.push(["Execução do protocolo", "execucao", String(tarefa.execucaoId)]);
  for (const [chave, nome, destino] of [["aplicacoes", "Aplicação", "aplicacao"], ["exames", "Exame", "exame"], ["execucoes", "Execução", "execucao"]] as const) {
    for (const item of Array.isArray(fato[chave]) ? fato[chave] : []) {
      const vinculo = registro(item);
      if (vinculo.id) links.push([`${nome} · ${vinculo.aplicadaEm ? dataHoraSanitaria(String(vinculo.aplicadaEm)) : dataSanitaria(String(vinculo.data ?? vinculo.inicio ?? ""))}`, destino, String(vinculo.id)]);
    }
  }
  return <div className="space-y-4 text-sm">
    {!!propriedade.nome && <p><strong>Sítio do fato:</strong> {String(propriedade.nome)}</p>}
    <p><strong>Animal:</strong> {animal.id ? <a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(String(animal.id))}`}>{textoDetalhe(animal.brinco)}{animal.nome ? ` · ${String(animal.nome)}` : ""}</a> : "Não informado"}</p>
    {!!doenca.nome && <p><strong>Doença:</strong> {String(doenca.nome)}</p>}
    {!!tipoExame.nome && <p><strong>Tipo de exame:</strong> {String(tipoExame.nome)}</p>}
    {!!protocolo.nome && <p><strong>Protocolo:</strong> {String(protocolo.nome)} · versão {textoDetalhe(protocolo.versao)}</p>}
    {!!fato.justificativaSemOrigem && <p><strong>Justificativa original da origem:</strong> {String(fato.justificativaSemOrigem)}</p>}
    {(tipo === "aplicacao" || tipo === "exame") && (!!fato.tarefaId || !!tarefa.id || fato.desvioProtocoloSnapshot != null) && <DesvioProtocolo valor={fato.desvioProtocoloSnapshot} />}
    {tipo === "aplicacao" && <><p><strong>Produto vinculado:</strong> {produto.id ? <a className="underline" href={`/estoque/produtos/${encodeURIComponent(String(produto.id))}`}>{textoDetalhe(produto.nome)}</a> : "Não vinculado"}</p><p><strong>Nome histórico do medicamento:</strong> {textoDetalhe(fato.nomeProdutoAplicado)}</p></>}
    <dl className="grid gap-2 sm:grid-cols-2">{(dadosDetalhe[tipo] ?? []).map(([rotulo, chave]) => <div key={chave} className="rounded-lg bg-surface p-2"><dt className="text-ink-3">{rotulo}</dt><dd>{formatarCampo(chave, fato)}</dd></div>)}</dl>
    {tipo === "exame" && !!fato.formatoSnapshot && <><p><strong>Resultado:</strong> {resultadoExameSanitario(fato as unknown as ExameResultado)}</p>{fato.status === "ANULADO" && <span className="rounded bg-surface px-2 py-1">Anulado</span>}<HistoricoExame key={String(fato.id)} exameId={String(fato.id)} propriedadeId={typeof fato.propriedadeId === "number" ? fato.propriedadeId : undefined} formato={(fato as unknown as ExameResultado).formatoSnapshot} /></>}
    {!!fato.loteNome && typeof fato.partidaCodigoSnapshot === "string" && fato.partidaCodigoSnapshot !== fato.loteNome && !/^LOTE-[0-9a-f-]{36}$/i.test(fato.partidaCodigoSnapshot) && <p className="text-ink-3">Referência histórica do lote: {fato.partidaCodigoSnapshot}</p>}
    {!!movimento.id && <p><strong>Saída do estoque:</strong> <a className="underline" href={`/estoque?movimentoId=${encodeURIComponent(String(movimento.id))}${fato.propriedadeId ? `&propriedadeId=${encodeURIComponent(String(fato.propriedadeId))}` : ""}`}>Ver movimento</a></p>}
    {!!estorno.id && <p><strong>Estorno do estoque:</strong> <a className="underline" href={`/estoque?movimentoId=${encodeURIComponent(String(estorno.id))}&propriedadeId=${encodeURIComponent(String(fato.propriedadeId ?? ""))}`}>Ver movimento de estorno</a></p>}
    {!!operacaoCompra.id && podeAcessarArea("financeiro") && <p><strong>Compra direta:</strong> <a className="underline" href={linkOperacaoFinanceira(String(operacaoCompra.id), window.location.pathname + window.location.search)}>Operação #{String(operacaoCompra.numero)}</a> · {textoDetalhe(compra.quantidade)} {unidadeSanitaria(String(compra.unidade ?? ""))} comprados · {textoDetalhe(compra.quantidadeDestinada)} {unidadeSanitaria(String(compra.unidade ?? ""))} destinados · {textoDetalhe(compra.quantidadeDisponivel)} {unidadeSanitaria(String(compra.unidade ?? ""))} disponíveis</p>}
    {!!fato.operacaoServicoId && podeAcessarArea("financeiro") && <p><strong>Serviço:</strong> <a className="underline" href={linkOperacaoFinanceira(String(fato.operacaoServicoId), window.location.pathname + window.location.search)}>Ver origem financeira</a></p>}
    {fato.valorProdutoAtribuido != null && <p><strong>Custo atribuído do medicamento:</strong> {fmtMoneyExact(Number(fato.valorProdutoAtribuido))}</p>}
    {fato.valorServicoAtribuido != null && <p><strong>Rateio atribuído do Serviço:</strong> {fmtMoneyExact(Number(fato.valorServicoAtribuido))}</p>}
    {links.length > 0 && <section><h3 className="font-semibold">Fatos relacionados</h3><div className="mt-2 flex flex-wrap gap-2">{links.map(([rotulo, destino, id]) => <button key={`${destino}-${id}`} type="button" className="rounded-lg border border-border px-3 py-2 underline" onClick={() => abrir(destino, id)}>{rotulo}</button>)}</div></section>}
    {Array.isArray(fato.tarefas) && <section><h3 className="font-semibold">Tarefas</h3><div className="mt-2 space-y-2">{fato.tarefas.map((item) => { const t = registro(item); return <p key={String(t.id)} className="rounded-lg border border-border p-2">{dataSanitaria(String(t.previstaPara ?? ""))} · {t.dispensadaEm ? "Dispensada" : (Array.isArray(t.aplicacoes) && t.aplicacoes.length) || (Array.isArray(t.exames) && t.exames.length) ? "Realizada" : "Pendente"}</p>; })}</div></section>}
  </div>;
}
