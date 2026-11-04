import { configuracoesMensais, statusMensal, type ConfiguracaoMensal } from "./mensal-api";
import { quantidadeNutricional } from "./quantidades";
import { consultarResumoNutricional } from "./api";
import { ClipboardCheck, Leaf } from "lucide-react";
import { AjudaCampo } from "@/components/Dica";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje, Pill } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { buscarLote, listarLotes } from "../api";
import type { Lote } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { atribuirDieta, corrigirVigencia, listarCentrosNutricionais, listarDietas, obterVigencia } from "./api";
import { useConsulta } from "./consulta";
import { EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";
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
  return <PainelCadastro aberto titulo={acao === "consumo" ? (consumoDoLote && lote ? `Novo fechamento · ${lote.nome}` : "Novo fechamento") : acao === "corrigir" ? "Corrigir vigência" : "Atribuir dieta ao lote"} icon={acao === "consumo" ? ClipboardCheck : Leaf} onFechar={onVoltar} bloqueado={ocupado} alteracoesExternas={alterado} largura="sm:max-w-6xl" rodape={fechar => <><Button secondary disabled={ocupado} onClick={fechar}>Cancelar</Button><span ref={setRodapeAcoes} className="contents" /></>}><div className="nutricao-formulario" onChangeCapture={marcarAlterado}><div className="nutricao-card-cabecalho"><p className="nutricao-nota">{acao === "consumo" ? (consumoDoLote ? (lote ? `${lote.propriedade.nome} · ${lote.animaisAtivos} animais ativos hoje.` : "") : "Escolha o lote para ver como ele é fechado.") : acao === "corrigir" ? "Fechamentos afetados devem ser estornados antes da correção." : "Confira a dieta e a data de início antes de aplicar ao lote."} <AjudaCampo rotulo="Sobre a operação nutricional" texto={acao === "consumo" ? "A prévia separa o período por mês e vigência, considerando os dias de permanência dos animais. Produtos com a mesma validade compartilham o lote de estoque, independentemente do fornecedor." : acao === "corrigir" ? "A correção ajusta também o fim da vigência anterior contígua. Fechamentos afetados devem ser estornados antes." : "Somente versões publicadas podem ser atribuídas. A troca encerra a dieta anterior na data informada."} /></p></div><div className="nutricao-card-corpo"><EstadoConsulta erro={contexto.erro} carregando={contexto.carregando} recarregar={contexto.carregar} />
    {contexto.dados && <>{consumoDoLote ? null : loteId ? <p className="nutricao-contexto"><strong>{lote?.nome}</strong> · {lote?.propriedade.nome} · {lote?.animaisAtivos} animais ativos hoje</p> : <label>Lote<SelectCampo className={classeInput} disabled={ocupado} value={selecao} onValueChange={(valorSelecionado) => { marcarAlterado(); setSelecao(valorSelecionado); }}><option value="">Selecione o lote</option>{contexto.dados.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</SelectCampo></label>}
      {lote && (lote.ativo ? acao === "consumo" ? <FormConsumo key={lote.id} lote={lote} acoes={rodapeAcoes} onOcupado={setOcupado} onSalvo={() => onSalvo(lote.id)} /> : <FormVigencia key={`${lote.id}:${vigenciaId}`} acao={acao} lote={lote} vigenciaId={vigenciaId} dietaInicialId={dietaInicialId} onAlterar={marcarAlterado} onOcupado={setOcupado} onSalvo={() => onSalvo(lote.id)} /> : <p role="alert" className="nutricao-aviso">Este lote está inativo. Seu histórico permanece disponível para consulta.</p>)}
    </>}
  </div></div></PainelCadastro>;
}
const MODELOS: Record<ConfiguracaoMensal["modelo"], { rotulo: string; texto: string }> = {
  AUTOMATICO: { rotulo: "Baixa automática diária", texto: "O processamento diário efetua as baixas; a conferência mensal permite ajustes." },
  MANUAL: { rotulo: "Confirmar antes de baixar", texto: "O estoque é baixado depois da confirmação dos dias." },
  PROVISORIO: { rotulo: "Estimar e baixar no fechamento", texto: "O consumo diário é virtual; o estoque é baixado na confirmação mensal." },
};
/** Configuração mensal do lote na data: exceção do lote antes do padrão do sítio. */
function configuracaoNaData(configuracoes: ConfiguracaoMensal[], lote: Lote, data: string) {
  const vigentes = configuracoes.filter(c => c.propriedadeId === lote.propriedadeId && c.desde.slice(0, 10) <= data).sort((a, b) => b.desde.localeCompare(a.desde));
  return vigentes.find(c => c.loteId === lote.id) ?? vigentes.find(c => c.loteId === null);
}
function FormConsumo({ lote, onSalvo, onOcupado, acoes }: { lote: Lote; onSalvo: () => void; onOcupado: (v: boolean) => void; acoes: HTMLElement | null }) {
  const centros = useConsulta(useCallback(listarCentrosNutricionais, []));
  const modelo = useConsulta(useCallback(async () => {
    const status = await statusMensal();
    return { ...status, configuracoes: status.habilitada ? await configuracoesMensais() : [] as ConfiguracaoMensal[] };
  }, []));
  const dia = hoje();
  const configuracoes = modelo.dados?.configuracoes ?? [];
  const mensal = configuracaoNaData(configuracoes, lote, dia);
  // O servidor recusa fechamento por período que alcance a adoção mensal; antes dela os períodos seguem fechando aqui.
  const adocao = configuracoes.filter(c => c.propriedadeId === lote.propriedadeId && (c.loteId === null || c.loteId === lote.id)).map(c => c.desde.slice(0, 10)).sort()[0];
  const futura = !mensal ? configuracoes.filter(c => c.propriedadeId === lote.propriedadeId && (c.loteId === null || c.loteId === lote.id) && c.desde.slice(0, 10) > dia).sort((a, b) => a.desde.localeCompare(b.desde))[0] : undefined;
  // Exceção própria do lote que entra depois do padrão do sítio já aplicado ou agendado.
  const base = mensal ?? futura;
  const excecaoPosterior = base && base.loteId === null ? configuracoes.filter(c => c.loteId === lote.id && c.desde.slice(0, 10) > base.desde.slice(0, 10) && c.desde.slice(0, 10) > dia).sort((a, b) => a.desde.localeCompare(b.desde))[0] : undefined;
  const conferencia = (rodape: HTMLElement | null) => centros.dados && <ConferenciaPeriodos acoes={rodape} loteId={lote.id} propriedadeId={lote.propriedadeId} centros={centros.dados.filter((c) => c.ativo)} onOcupado={onOcupado} onSalvo={async () => onSalvo()} />;
  return <><EstadoConsulta erro={modelo.erro} carregando={modelo.carregando} recarregar={modelo.carregar} /><EstadoConsulta erro={centros.erro} carregando={centros.carregando} recarregar={centros.carregar} />
    {modelo.dados && <>
      {modelo.dados.habilitada && <section className="nutricao-formas-fechamento" aria-labelledby="formas-fechamento"><h3 id="formas-fechamento">Forma de fechamento</h3><ul>
        <li data-aplicavel={!mensal || undefined}><div><strong>Por período</strong>{!mensal && <Pill tone="green">Aplica-se a este lote</Pill>}</div><p>Você escolhe o intervalo, confere os ingredientes por vigência e confirma a baixa de estoque.{futura && ` Vale até ${formatarDataBR(futura.desde)}, quando o lote passa ao fechamento mensal.`}</p></li>
        <li data-aplicavel={mensal ? true : undefined}><div><strong>Mensal{(mensal ?? futura) && ` · ${MODELOS[(mensal ?? futura)!.modelo].rotulo}`}</strong>{mensal ? <Pill tone="green">Aplica-se a este lote</Pill> : futura ? <Pill tone="blue">A partir de {formatarDataBR(futura.desde)}</Pill> : <Pill tone="neutral">Não configurado</Pill>}</div><p>{mensal ? <>{MODELOS[mensal.modelo].texto} Conferência no dia {mensal.diaConferencia} do mês seguinte · {mensal.loteId ? "exceção do lote" : "padrão do sítio"}.{!modelo.dados.automacao && " O processamento automático diário está desativado neste ambiente."}</> : futura ? `${MODELOS[futura.modelo].texto} Conferência no dia ${futura.diaConferencia} do mês seguinte.` : "O consumo é acompanhado dia a dia e conferido uma vez por mês. Defina o modelo nas configurações da Nutrição."}{excecaoPosterior && ` A partir de ${formatarDataBR(excecaoPosterior.desde)}, exceção do lote: ${MODELOS[excecaoPosterior.modelo].rotulo.toLowerCase()}.`}</p></li>
      </ul></section>}
      {mensal ? <><div className="nutricao-acoes"><LinkNutricional className="nutricao-botao" href={rotaNutricao({ aba: "fechamentos", loteId: lote.id })}>Abrir fechamento mensal</LinkNutricional><LinkNutricional className="nutricao-botao-secundario" href="/configuracoes/pecuaria/nutricao">Configurações</LinkNutricional></div>
        {centros.dados && <details className="nutricao-composicao-recolhida mt-5"><summary>Fechar períodos anteriores a {formatarDataBR(adocao)}</summary>{conferencia(null)}</details>}</> : conferencia(acoes)}
    </>}</>;
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
    const status = await statusMensal();
    return { ...status, configuracoes: status.habilitada ? await configuracoesMensais() : [] };
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
      {selecionada && <section><h3>Composição de {selecionada.nome} · v{selecionada.versao}</h3><div className="nutricao-tabela-scroll"><table className="nutricao-tabela consulta-tabela"><thead><tr><th>Ingrediente</th><th>Por animal/dia</th><th>Para {lote.animaisAtivos} animais/dia</th></tr></thead><tbody>{selecionada.itens.map(item => <tr key={item.produtoId}><td>{item.produto?.nome ?? "Produto indisponível"}</td><td>{quantidadeNutricional(item.quantidadeCabecaDia)} {item.unidade}</td><td>{quantidadeNutricional(String(Number(item.quantidadeCabecaDia) * lote.animaisAtivos))} {item.unidade}</td></tr>)}</tbody></table></div><p className="nutricao-nota">Estimativa com o efetivo de hoje. O consumo acompanha a permanência dos animais em cada dia; unidades distintas não são somadas.</p></section>}
      {desde && resumo.dados && <p className="nutricao-nota">{desde > hoje() ? `Dieta programada para ${formatarDataBR(desde)}.` : `Início em ${formatarDataBR(desde)}.`} {resumo.dados?.vigente ? "A troca encerra a dieta anterior na data informada." : desde > hoje() ? "Até essa data, o lote continuará sem dieta vigente cadastrada." : "Esta será a dieta do lote a partir da data informada."} A atribuição não confirma consumo nem efetua baixa de estoque.</p>}
      <EstadoConsulta erro={modelo.erro} carregando={modelo.carregando} recarregar={modelo.carregar} />
      {modelo.dados && <p className="nutricao-nota">{!modelo.dados.habilitada ? "Nutrição mensal não habilitada. O consumo segue a conferência de períodos existente." : !configuracao ? "Sem configuração mensal vigente na data informada. O consumo segue a conferência de períodos existente." : <>
        <strong>{MODELOS[configuracao.modelo].rotulo} · Conferência dia {configuracao.diaConferencia} do mês seguinte.</strong>{" "}
        {configuracao.loteId ? "Exceção do lote" : "Padrão do sítio"} na data de início. {MODELOS[configuracao.modelo].texto}
        {!modelo.dados.automacao && " O processamento automático diário está desativado neste ambiente."}
      </>}</p>}
      {resumo.dados?.programada && <p className="nutricao-aviso">Já existe uma dieta programada: {resumo.dados.programada.dieta.nome}, em {formatarDataBR(resumo.dados.programada.desde)}. A nova vigência precisa respeitar essa programação; o servidor validará os conflitos antes de salvar.</p>}
    </>}
    {acao === "corrigir" && <label>Motivo da correção<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>}
    <div className="nutricao-acoes"><Button type="submit" disabled={ocupado || !desde || (acao === "atribuir" ? !selecionada || !previaPronta : motivo.trim().length < 5)}>{ocupado ? "Salvando…" : acao === "corrigir" ? "Confirmar correção" : desde > hoje() ? "Confirmar programação" : "Aplicar ao lote"}</Button></div>
  </fieldset></form>}</>;
}
