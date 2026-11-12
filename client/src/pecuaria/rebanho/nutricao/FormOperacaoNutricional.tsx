import { type ConfiguracaoMensal } from "./mensal-api";
import { configuracaoNaData, consultarModelosFechamento, consultarSituacaoFechamentos, MODELOS, situacaoDoLote, somarDias } from "./situacaoFechamento";
import { quantidadeNutricional, un } from "./quantidades";
import { consultarResumoNutricional, ultimoFechamentoConfirmado, type Dieta, type ResumoNutricional } from "./api";
import { ClipboardCheck, Leaf } from "lucide-react";
import { AjudaCampo } from "@/components/Dica";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { buscarLote, listarLotes } from "../api";
import type { Lote } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { atribuirDieta, corrigirVigencia, listarCentrosNutricionais, listarDietas, obterVigencia } from "./api";
import { useConsulta } from "./consulta";
import { EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";
import { rotaOperacaoNutricional } from "./navegacao";
import { ConferenciaPeriodos } from "./ConferenciaPeriodos";

type Acao = "atribuir" | "corrigir" | "consumo";
export function FormOperacaoNutricional({ acao, loteId, vigenciaId, dietaInicialId, onVoltar, onSalvo }: { acao: Acao; loteId?: string; vigenciaId?: string; dietaInicialId?: string; onVoltar: () => void; onSalvo: (loteId: string) => void }) {
  const contexto = useConsulta(useCallback(async () => loteId ? [await buscarLote(loteId)] : listarLotes(), [loteId]));
  const [alterado, setAlterado] = useState(false);
  const marcarAlterado = useCallback(() => setAlterado(true), []);
  const [selecao, setSelecao] = useState(loteId ?? "");
  const [ocupado, setOcupado] = useState(false);
  const lote = contexto.dados?.find((l) => l.id === selecao);
  const [rodapeAcoes, setRodapeAcoes] = useState<HTMLSpanElement | null>(null);
  const consumoDoLote = acao === "consumo" && !!loteId;
  const situacoes = useConsulta(useCallback(async () => acao === "consumo" && !loteId ? consultarSituacaoFechamentos() : null, [acao, loteId]));
  const rotuloSituacao = (id: string) => { const s = situacoes.dados?.find(x => x.resumo.lote.id === id); return !s ? "" : s.dias ? ` · ${s.dias} ${s.dias === 1 ? "dia" : "dias"} a fechar` : s.mensal ? ` · ${MODELOS[s.mensal.modelo].rotulo.toLocaleLowerCase("pt-BR")}` : " · em dia"; };
  const opcoesLote = acao === "consumo" && situacoes.dados ? contexto.dados?.filter(l => situacoes.dados!.some(s => s.resumo.lote.id === l.id)).sort((a, b) => situacoes.dados!.findIndex(s => s.resumo.lote.id === a.id) - situacoes.dados!.findIndex(s => s.resumo.lote.id === b.id)) : contexto.dados;
  return <PainelCadastro aberto titulo={acao === "consumo" ? (consumoDoLote && lote ? `Novo fechamento · ${lote.nome}` : "Novo fechamento") : acao === "corrigir" ? "Corrigir vigência" : "Atribuir dieta ao lote"} icon={acao === "consumo" ? ClipboardCheck : Leaf} onFechar={onVoltar} bloqueado={ocupado} alteracoesExternas={alterado} largura="sm:max-w-6xl" rodape={fechar => <><Button secondary disabled={ocupado} onClick={fechar}>Cancelar</Button><span ref={setRodapeAcoes} className="contents" /></>}><div className="nutricao-formulario" onChangeCapture={marcarAlterado}><div className="nutricao-card-cabecalho"><p className="nutricao-nota">{acao === "consumo" ? (consumoDoLote ? "Confira os ingredientes do período e confirme a baixa de estoque." : "Escolha o lote. Os que têm mais dias a fechar aparecem primeiro.") : acao === "corrigir" ? "Fechamentos afetados devem ser estornados antes da correção." : "Confira a dieta e a data de início antes de aplicar ao lote."} <AjudaCampo rotulo="Sobre a operação nutricional" texto={acao === "consumo" ? "A conferência separa o período por mês e vigência e atribui o consumo pelos dias de permanência dos animais." : acao === "corrigir" ? "A correção ajusta também o fim da vigência anterior contígua. Fechamentos afetados devem ser estornados antes." : "Somente versões publicadas podem ser atribuídas. A troca encerra a dieta anterior na data informada."} /></p></div><div className="nutricao-card-corpo"><EstadoConsulta erro={contexto.erro} carregando={contexto.carregando} recarregar={contexto.carregar} />
    {contexto.dados && <>{consumoDoLote ? null : loteId ? <p className="nutricao-contexto"><strong>{lote?.nome}</strong> · {lote?.propriedade.nome} · {lote?.animaisAtivos} animais ativos hoje</p> : <label>Lote<SelectCampo className={classeInput} disabled={ocupado} value={selecao} onValueChange={(valorSelecionado) => { marcarAlterado(); setSelecao(valorSelecionado); }}><option value="">Selecione o lote</option>{(opcoesLote ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}{acao === "consumo" ? rotuloSituacao(l.id) : ""}</option>)}</SelectCampo></label>}{!consumoDoLote && !loteId && acao === "consumo" && situacoes.dados && <p className="nutricao-nota">Lotes sem dieta vigente não aparecem: não há consumo para fechar.</p>}
      {lote && (lote.ativo ? acao === "consumo" ? <FormConsumo key={lote.id} lote={lote} acoes={rodapeAcoes} onOcupado={setOcupado} onSalvo={() => onSalvo(lote.id)} /> : <FormVigencia key={`${lote.id}:${vigenciaId}`} acao={acao} lote={lote} vigenciaId={vigenciaId} dietaInicialId={dietaInicialId} onAlterar={marcarAlterado} onOcupado={setOcupado} onSalvo={() => onSalvo(lote.id)} /> : <p role="alert" className="nutricao-aviso">Este lote está inativo. Seu histórico permanece disponível para consulta.</p>)}
    </>}
  </div></div></PainelCadastro>;
}
/** Fecha o consumo do lote pelo modelo que vale para ele: por período até a adoção mensal, mensal depois dela. */
function FormConsumo({ lote, onSalvo, onOcupado, acoes }: { lote: Lote; onSalvo: () => void; onOcupado: (v: boolean) => void; acoes: HTMLElement | null }) {
  const centros = useConsulta(useCallback(listarCentrosNutricionais, []));
  const situacao = useConsulta(useCallback(async () => {
    const [resumo, ultimo, modelos, dietas] = await Promise.all([consultarResumoNutricional(lote.id), ultimoFechamentoConfirmado(lote.id), consultarModelosFechamento(), listarDietas().catch(() => [])]);
    if (!resumo.vigente) return null;
    const dieta = dietas.find(d => d.id === resumo.vigente!.dieta.id);
    return { ...situacaoDoLote(resumo, ultimo?.fim.slice(0, 10) ?? null, modelos.configuracoes, undefined, null, !!dieta?.usaLeiteProprio), dieta };
  }, [lote.id]));
  const s = situacao.dados;
  const conferencia = (inicial?: { inicio: string; fim: string }) => centros.dados && <ConferenciaPeriodos acoes={acoes} inicial={inicial} loteId={lote.id} propriedadeId={lote.propriedadeId} centros={centros.dados.filter((c) => c.ativo)} onOcupado={onOcupado} onSalvo={async () => onSalvo()} />;
  return <><EstadoConsulta erro={situacao.erro} carregando={situacao.carregando} recarregar={situacao.carregar} /><EstadoConsulta erro={centros.erro} carregando={centros.carregando} recarregar={centros.carregar} />
    {situacao.dados === null && !situacao.carregando && !situacao.erro && <p className="nutricao-aviso">Este lote não tem dieta vigente. <LinkNutricional href={rotaOperacaoNutricional("atribuir", lote.id)}>Atribuir dieta</LinkNutricional></p>}
    {s && <>
      <ContextoFechamento lote={s.resumo.lote} vigencia={s.resumo.vigente!} dieta={s.dieta} />
      {s.dias > 0 && <h3 className="nutricao-subtitulo">{s.dias} {s.dias === 1 ? "dia a fechar" : "dias a fechar"} por período · {formatarDataBR(s.inicio)} a {formatarDataBR(s.fim)}</h3>}
      {/* Sem diário ou mensal configurado, o fechamento por período já está claro no título acima. */}
      {(s.mensal || s.adocao) && <p className="nutricao-modelo-lote">{s.mensal && s.dias > 0
        ? <>Até {formatarDataBR(s.fim)} o consumo fecha por período. Desde {formatarDataBR(s.adocao!)}, o lote usa o fechamento <strong>{MODELOS[s.mensal.modelo].rotulo.toLocaleLowerCase("pt-BR")}</strong>, com conferência no dia {s.mensal.diaConferencia} do mês seguinte ({s.mensal.loteId ? "exceção do lote" : "padrão do sítio"}).</>
        : s.mensal
        ? <><strong>Fechamento {MODELOS[s.mensal.modelo].rotulo.toLocaleLowerCase("pt-BR")} desde {formatarDataBR(s.adocao!)}</strong> · conferência no dia {s.mensal.diaConferencia} do mês seguinte ({s.mensal.loteId ? "exceção do lote" : "padrão do sítio"}).</>
        : s.adocao ? <><strong>Fechamento por período até {formatarDataBR(somarDias(s.adocao, -1))}</strong> · a partir de {formatarDataBR(s.adocao)}, o lote passa ao fechamento {s.configuracaoAdocao ? MODELOS[s.configuracaoAdocao.modelo].rotulo.toLocaleLowerCase("pt-BR") : "configurado"}.</>
        : null}
        {" "}<LinkNutricional href="/configuracoes/pecuaria/nutricao/fechamento">Configurar</LinkNutricional></p>}
      {s.dias > 0 ? <>
        {conferencia({ inicio: s.inicio, fim: s.fim })}
      </> : s.mensal ? <div className="nutricao-acoes"><LinkNutricional className="nutricao-botao" href={rotaNutricao({ aba: "fechamentos", loteId: lote.id })}>Ver fechamentos do lote</LinkNutricional></div>
        : <p className="nutricao-nota">Consumo fechado até {s.ultimoFim ? formatarDataBR(s.ultimoFim) : "ontem"}. O dia de hoje pode ser fechado amanhã.</p>}
    </>}</>;
}
/** O que está sendo fechado: o lote de animais e a receita vigente, com o consumo previsto por dia. */
function ContextoFechamento({ lote, vigencia, dieta }: { lote: ResumoNutricional["lote"]; vigencia: NonNullable<ResumoNutricional["vigente"]>; dieta?: Dieta }) {
  return <dl className="nutricao-contexto-fechamento">
    <div><dt>Lote de animais</dt><dd>{lote.nome}</dd><small>{lote.propriedade.nome} · {lote.animaisAtivos} {lote.animaisAtivos === 1 ? "animal ativo" : "animais ativos"} hoje</small></div>
    <div><dt>Receita</dt><dd>{vigencia.dieta.nome} · v{vigencia.dieta.versao}</dd><small>Vigente desde {formatarDataBR(vigencia.desde)}</small></div>
    {dieta && dieta.itens.length > 0 && <div className="nutricao-contexto-ingredientes"><dt>Ingredientes por cabeça/dia</dt>
      <dd><ul>{dieta.itens.map(i => <li key={i.produtoId}><span>{i.produto?.nome ?? "Produto"}</span><strong>{quantidadeNutricional(i.quantidadeCabecaDia)} {un(i.unidade)}</strong><small>{quantidadeNutricional(String(Math.round(Number(i.quantidadeCabecaDia) * lote.animaisAtivos * 1000) / 1000))} {un(i.unidade)}/dia no lote</small></li>)}</ul></dd></div>}
  </dl>;
}
function FormVigencia({ acao, lote, vigenciaId, dietaInicialId, onSalvo, onOcupado, onAlterar }: { acao: "atribuir" | "corrigir"; lote: Lote; vigenciaId?: string; dietaInicialId?: string; onAlterar: () => void; onSalvo: () => void; onOcupado: (v: boolean) => void }) {
  const consulta = useConsulta(useCallback(async () => {
    if (acao === "atribuir") return { dietas: await listarDietas(), vigencia: null };
    if (!vigenciaId) throw new Error("Selecione a vigência que deseja corrigir.");
    const vigencia = await obterVigencia(vigenciaId, lote.id);
    if (vigencia.loteId !== lote.id) throw new Error("A vigência não pertence a este lote.");
    return { dietas: [], vigencia };
  }, [acao, lote.id, vigenciaId]));
  const [dietaId, setDieta] = useState(dietaInicialId ?? "");
  const resumo = useConsulta(useCallback(() => consultarResumoNutricional(lote.id), [lote.id]));
  const modelo = useConsulta(useCallback(async () => {
    if (acao !== "atribuir") return { habilitada: false, automacao: false, configuracoes: [] as ConfiguracaoMensal[] };
    return consultarModelosFechamento();
  }, [acao, lote.id]));
  const [desde, setDesde] = useState(hoje());
  const configuracao = configuracaoNaData(modelo.dados?.configuracoes ?? [], lote, desde);
  const previaPronta = Boolean(resumo.dados && !resumo.carregando && !resumo.erro && modelo.dados && !modelo.carregando && !modelo.erro);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  useEffect(() => { onOcupado(ocupado); }, [ocupado, onOcupado]);
  useEffect(() => { if (consulta.dados?.vigencia) setDesde(consulta.dados.vigencia.desde.slice(0, 10)); }, [consulta.dados?.vigencia]);
  const publicadas = consulta.dados?.dietas.filter((d) => d.publicadaEm) ?? [];
  const selecionada = publicadas.find(d => d.id === dietaId);
  async function salvar() {
    if (enviando.current || !consulta.dados || !desde || (acao === "corrigir" && motivo.trim().length < 5)) return;
    if (acao === "atribuir" && !previaPronta) return;
    if (acao === "atribuir" && !selecionada) { setErro("Selecione uma receita publicada."); return; }
    enviando.current = true; setOcupado(true); setErro(null);
    try {
      if (acao === "corrigir" && consulta.dados.vigencia) await corrigirVigencia(consulta.dados.vigencia.id, { propriedadeId: lote.propriedadeId, desde, motivo: motivo.trim() });
      else await atribuirDieta({ loteId: lote.id, propriedadeId: lote.propriedadeId, dietaId, desde });
      onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviando.current = false; setOcupado(false); }
  }
  return <><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} />{consulta.dados && <form onSubmit={(e) => { e.preventDefault(); void salvar(); }}><fieldset disabled={ocupado} className="nutricao-vigencia-campos grid gap-4 mt-5"><ErrorBox erro={erro} />
    {acao === "atribuir" ? <label>Dieta publicada<SelectCampo className={classeInput} required value={dietaId} onValueChange={(valorSelecionado) => { onAlterar(); setDieta(valorSelecionado); }}><option value="">Selecione uma receita</option>{publicadas.map((d) => <option key={d.id} value={d.id}>{d.nome} · v{d.versao}</option>)}</SelectCampo>{!publicadas.length && <span className="nutricao-nota">Publique uma receita antes de atribuí-la.</span>}</label> : <p className="nutricao-aviso">{consulta.dados.vigencia?.dieta.nome} · v{consulta.dados.vigencia?.dieta.versao}<br />Início atual: {consulta.dados.vigencia && formatarDataBR(consulta.dados.vigencia.desde)}. Fechamentos afetados devem ser estornados antes.</p>}
    <label>Início da vigência<DatePicker value={desde} onChange={(valor) => { onAlterar(); setDesde(valor); }} /></label>

    {acao === "atribuir" && <>
      <EstadoConsulta erro={resumo.erro} carregando={resumo.carregando} recarregar={resumo.carregar} />
      {resumo.dados && <p className="nutricao-nota">Dieta atual: {resumo.dados.vigente ? `${resumo.dados.vigente.dieta.nome} · v${resumo.dados.vigente.dieta.versao}` : "Nenhuma cadastrada"}.</p>}
      {selecionada && <section><h3>Composição de {selecionada.nome} · v{selecionada.versao}</h3><div className="nutricao-tabela-scroll"><table className="nutricao-tabela consulta-tabela"><thead><tr><th>Ingrediente</th><th>Por animal/dia</th><th>Para {lote.animaisAtivos} animais/dia</th></tr></thead><tbody>{selecionada.itens.map(item => <tr key={item.produtoId}><td>{item.produto?.nome ?? "Produto indisponível"}</td><td>{quantidadeNutricional(item.quantidadeCabecaDia)} {un(item.unidade)}</td><td>{quantidadeNutricional(String(Number(item.quantidadeCabecaDia) * lote.animaisAtivos))} {un(item.unidade)}</td></tr>)}</tbody></table></div><p className="nutricao-nota">Estimativa com o efetivo de hoje. O consumo acompanha a permanência dos animais em cada dia; unidades distintas não são somadas.</p></section>}
      {desde && resumo.dados && <p className="nutricao-nota">{desde > hoje() ? `Dieta programada para ${formatarDataBR(desde)}.` : `Início em ${formatarDataBR(desde)}.`} {resumo.dados?.vigente ? "A troca encerra a dieta anterior na data informada." : desde > hoje() ? "Até essa data, o lote continuará sem dieta vigente cadastrada." : "Esta será a dieta do lote a partir da data informada."} A atribuição não confirma consumo nem efetua baixa de estoque.</p>}
      <EstadoConsulta erro={modelo.erro} carregando={modelo.carregando} recarregar={modelo.carregar} />
      {modelo.dados && <p className="nutricao-nota">{!modelo.dados.habilitada ? "Nutrição mensal não habilitada. O consumo segue a conferência de períodos existente." : !configuracao ? "Sem configuração mensal vigente na data informada. O consumo segue a conferência de períodos existente." : <>
        <strong>{MODELOS[configuracao.modelo].rotulo} · Conferência dia {configuracao.diaConferencia} do mês seguinte.</strong>{" "}
        {configuracao.loteId ? "Exceção do lote" : "Padrão do sítio"} na data de início. {MODELOS[configuracao.modelo].texto}
      </>}</p>}
      {resumo.dados?.programada && <p className="nutricao-aviso">Já existe uma dieta programada: {resumo.dados.programada.dieta.nome}, em {formatarDataBR(resumo.dados.programada.desde)}. A nova vigência precisa respeitar essa programação; o servidor validará os conflitos antes de salvar.</p>}
    </>}
    {acao === "corrigir" && <label>Motivo da correção<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>}
    <div className="nutricao-acoes"><Button type="submit" disabled={ocupado || !desde || (acao === "atribuir" ? !selecionada || !previaPronta : motivo.trim().length < 5)}>{ocupado ? "Salvando…" : acao === "corrigir" ? "Confirmar correção" : desde > hoje() ? "Confirmar programação" : "Aplicar ao lote"}</Button></div>
  </fieldset></form>}</>;
}
