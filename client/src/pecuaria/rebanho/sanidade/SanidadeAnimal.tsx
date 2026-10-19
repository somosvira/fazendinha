import { SelectCampo } from "@/financeiro/SelectCampo";
import { DestinoConsumo, administracaoMantida, type SituacaoAdministracao, type DestinoConsumoSanitario } from "./DestinoConsumo";
import { type ReactNode, useEffect, useState } from "react";
import { Syringe, Eye, Link2, Pencil, Ban, FileText, FlaskConical } from "lucide-react";
import { CardFicha } from "../ui";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { MenuAcoesFicha } from "../components/MenuAcoesFicha";
import "./sanidade-animal.css";

import { consultarCarencia, listarAplicacoes, type AplicacaoSanitaria, type CarenciaAnimal } from "./api";
import { ReconciliarOrigem } from "./ReconciliarOrigem";
import { HistoricoSanitario } from "./HistoricoSanitario";
import { FormAplicacaoServico } from "./FormAplicacaoServico";
import { FormFatoSanitario, type TipoFatoSanitario } from "./FormFatoSanitario";
import { FormAplicacaoAnimal } from "./FormAplicacaoAnimal";
import { RodadasAnimal } from "./RodadasAnimal";
import { FormRodada } from "./FormRodada";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { reqSanidade, type EstadoPrazo } from "./api";

export { resumoCarencia } from "./CarenciasSanitarias";
import { CarenciasSanitarias } from "./CarenciasSanitarias";
import { EstadoSanitario } from "./IndicadoresSanitarios";
import { DetalheSanitario } from "./DetalheSanitario";
import { PainelDetalheSanitario } from "./PainelDetalheSanitario";
import { dataAplicacaoSanitaria, unidadeSanitaria, tipoSanitario, origemSanitaria, nomeAnimalSanitario } from "./rotulos";
import { TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { SkeletonSanitario } from "./SkeletonSanitario";

function ConteinerSanidade({ geral, children, acao }: { geral: boolean; children: ReactNode; acao?: ReactNode }) {
  return geral ? <CardFicha icon={Syringe} titulo="Aplicações" tabela className="sanidade-aplicacoes-geral" acao={acao}>{children}</CardFicha> : <div className="sanidade-animal lg:col-span-2"><header className="sanidade-animal-acoes"><h2 className="h2">Sanidade</h2>{acao}</header>{children}</div>;
}
function SecaoAplicacoes({ geral, children }: { geral: boolean; children: ReactNode }) {
  return geral ? <>{children}</> : <SecaoRecolhivel titulo={<span className="ficha-titulo-com-icone"><Syringe size={20} aria-hidden />Aplicações sanitárias</span>}>{children}</SecaoRecolhivel>;
}
export function SanidadeAnimal({ filtrosUI, resumoUI, animalId, propriedadeId, podeLancar, recarregarToken, lista, onMudou, geral = false, abrirDetalhe, onCarencia }: {
  onCarencia?: (carencia: CarenciaAnimal | null) => void;
  animalId: string; propriedadeId: number | null; podeLancar: boolean; recarregarToken: number;
  filtrosUI?: ReactNode; resumoUI?: ReactNode; lista?: AplicacaoSanitaria[]; onMudou?: (id?: string, propriedadeIdFato?: number) => void; geral?: boolean; abrirDetalhe?: (tipo: string, id: string, propriedadeId?: number | null) => void;
}) {
  const [aplicacoes, setAplicacoes] = useState<AplicacaoSanitaria[]>([]);
  const [carencia, setCarencia] = useState<CarenciaAnimal | null>(null);
  const [reconciliando, setReconciliando] = useState<AplicacaoSanitaria | null>(null);
  const [aberto, setAberto] = useState(false);
  const [novoFato, setNovoFato] = useState<TipoFatoSanitario | null>(null);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [correcao, setCorrecao] = useState<{ id: string; anular: boolean } | null>(null);
  const [administracao, setAdministracao] = useState<SituacaoAdministracao>("");
  const [destinoConsumo, setDestinoConsumo] = useState<DestinoConsumoSanitario | "">("");
  const [motivo, setMotivo] = useState("");
  const [prazos, setPrazos] = useState<Record<"leite" | "carne", { estado: EstadoPrazo; horas: string }>>({ leite: { estado: "NAO_INFORMADO", horas: "" }, carne: { estado: "NAO_INFORMADO", horas: "" } });
  const [justificativaCarne, setJustificativaCarne] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [detalhe, setDetalhe] = useState<{ tipo: string; id: string } | null>(null);
  const [conteudo, setConteudo] = useState<unknown>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [retryDetalhe, setRetryDetalhe] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  useEffect(() => {
    if (!detalhe) return;
    let vivo = true;
    setConteudo(null); setErroDetalhe(null);
    const recurso = { aplicacao: "aplicacoes", ocorrencia: "ocorrencias", exame: "exames", execucao: "execucoes" }[detalhe.tipo];
    const sitio = aplicacoes.find((a) => a.id === detalhe.id)?.propriedadeId ?? propriedadeId;
    reqSanidade<unknown>(`/${recurso}/${encodeURIComponent(detalhe.id)}${sitio != null ? `?propriedadeId=${sitio}` : ""}`).then((v) => { if (vivo) setConteudo(v); }).catch((e: unknown) => { if (vivo) setErroDetalhe(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [detalhe, retryDetalhe, propriedadeId, aplicacoes]);
  function verDetalhe(a: AplicacaoSanitaria) {
    if (abrirDetalhe) abrirDetalhe("aplicacao", a.id, a.propriedadeId);
    else setDetalhe({ tipo: "aplicacao", id: a.id });
  }
  function atualizar(id?: string, propriedadeIdFato?: number) { setVersao((v) => v + 1); onMudou?.(id, propriedadeIdFato); }
  async function corrigir() {
    if (!correcao || ocupado) return;
    if (correcao.anular && !destinoConsumo) { setErro("Selecione o destino físico do material."); return; }
    if (correcao.anular && destinoConsumo === "MANTER_CONSUMO" && !administracao) { setErro("Informe a situação da administração neste animal."); return; }
    setOcupado(true); setErro(null);
    try { const sitioRegistro = aplicacoes.find((a) => a.id === correcao.id)?.propriedadeId ?? propriedadeId; await reqSanidade(`/aplicacoes/${correcao.id}/${correcao.anular ? "anulacao" : "carencia"}`, { method: "POST", body: JSON.stringify(correcao.anular ? { propriedadeId: sitioRegistro, motivo, destinoConsumo, ...(destinoConsumo === "MANTER_CONSUMO" && administracao ? {administracaoMantida: administracaoMantida(administracao)} : {}) } : { propriedadeId: sitioRegistro, motivo, estadoCarenciaLeite: prazos.leite.estado, estadoCarenciaCarne: prazos.carne.estado, carenciaLeiteHoras: prazos.leite.estado === "INFORMADO" && prazos.leite.horas !== "" ? Number(prazos.leite.horas) : null, carenciaCarneHoras: prazos.carne.estado === "INFORMADO" && prazos.carne.horas !== "" ? Number(prazos.carne.horas) : null, justificativaCarenciaCarne: justificativaCarne || null }) }); setCorrecao(null); atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  useEffect(() => {
    let vivo = true;
    setCarregando(true); setErroConsulta(null);
    Promise.all([lista ? Promise.resolve(lista) : listarAplicacoes(animalId), animalId ? consultarCarencia(animalId) : Promise.resolve(null)])
      .then(([lista, prazos]) => { if (vivo) { setAplicacoes(lista); setCarencia(prazos); } })
      .catch((e) => { if (vivo) setErroConsulta(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [animalId, recarregarToken, versao, lista]);

  useEffect(() => { onCarencia?.(carregando || erroConsulta ? null : carencia); }, [onCarencia, carencia, carregando, erroConsulta]);

  return <ConteinerSanidade geral={geral}
    acao={geral ? <div className="flex flex-wrap items-center gap-3">{resumoUI}{podeLancar && <Button onClick={() => setAberto(true)}>Registrar aplicação sanitária</Button>}</div> : podeLancar && propriedadeId != null ? <MenuAcoesFicha rotulo="Ações sanitárias" itens={[
      { id: "aplicacao", rotulo: "Registrar aplicação sanitária", icon: Syringe, onSelect: () => setAberto(true) },
      { id: "ocorrencia", rotulo: "Nova ocorrência", icon: FileText, onSelect: () => setNovoFato("ocorrencia") },
      { id: "exame", rotulo: "Registrar exame", icon: FlaskConical, onSelect: () => setNovoFato("exame") },
      { id: "protocolo", rotulo: "Iniciar protocolo", icon: FileText, onSelect: () => setNovoFato("protocolo") },
    ]} /> : undefined}>
    {erro && <p className="text-sm text-red-700">{erro}</p>}
    {erroConsulta && <><ErrorBox erro={erroConsulta} /><Button secondary onClick={() => atualizar()}>Tentar novamente</Button></>}
    {!erroConsulta && carregando && <SkeletonSanitario label="Carregando aplicações sanitárias…" />}
    {!erroConsulta && <>
    {animalId && <CarenciasSanitarias carencia={carencia} />}
    {filtrosUI}
    {!geral && animalId && <RodadasAnimal animalId={animalId} revisao={versao + recarregarToken} />}
    {<SecaoAplicacoes geral={geral}><TabelaFinanceira rotulo="Aplicações sanitárias" itens={geral && lista ? lista : aplicacoes} chaveDe={(a) => a.id} onAbrir={verDetalhe} colunas={[
      ...(geral ? [{ chave: "animal", titulo: "Animal", principal: true, larguraMinima: 160, celula: (a: AplicacaoSanitaria) => a.animal ? nomeAnimalSanitario(a.animal) : "Animal não identificado" }] : []),
      { chave: "registro", titulo: "Registro", principal: !geral, larguraMinima: 175, celula: (a) => <><div>{dataAplicacaoSanitaria(a)}</div><div className="text-xs text-ink-3">{tipoSanitario(a)}</div></> },
      { chave: "aplicacao", titulo: "Aplicação", larguraMinima: 260, larguraFlexivel: true, celula: (a) => <><div>{a.nomeProdutoAplicado || a.produto?.nome || "Medicamento não informado"} · {a.dose} {unidadeSanitaria(a.unidadeDose)}</div><div className="text-xs text-ink-3">{origemSanitaria(a.origemInsumo)}{a.produto?.nome ? ` · Produto vinculado: ${a.produto.nome}` : " · Sem produto vinculado"}</div></> },
      { chave: "situacao", titulo: "Situação", celula: (a) => <EstadoSanitario tom={a.status === "ANULADO" ? "neutro" : a.origemInsumo === "SEM_ORIGEM_JUSTIFICADA" ? "atencao" : "verde"}>{a.status === "ANULADO" ? "Anulada" : a.origemInsumo === "SEM_ORIGEM_JUSTIFICADA" ? "Origem pendente" : "Válida"}</EstadoSanitario> },
      { chave: "acoes", titulo: "Ações", acoes: true, larguraMinima: 180, celula: (a) => <div className="flex flex-wrap items-center gap-2" onClick={(evento) => evento.stopPropagation()}><button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Ver detalhes de ${a.nomeProdutoAplicado}`} title="Ver detalhes" onClick={() => verDetalhe(a)}><Eye size={16} aria-hidden /><span className="sr-only">Abrir</span></button>{podeLancar && (a.propriedadeId ?? propriedadeId) != null && a.status === "VALIDO" && <div className="contents">{a.origemInsumo === "SEM_ORIGEM_JUSTIFICADA" && <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Reconciliar origem de ${a.nomeProdutoAplicado}`} title="Reconciliar origem" onClick={() => setReconciliando(a)}><Link2 size={16} aria-hidden /><span className="sr-only">Origem</span></button>}<button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Corrigir carência de ${a.nomeProdutoAplicado}`} title="Corrigir carência" onClick={() => { setErro(null); setCorrecao({ id: a.id, anular: false }); setMotivo(""); setPrazos({ leite: { estado: a.estadoCarenciaLeite, horas: a.carenciaLeiteHoras?.toString() ?? "" }, carne: { estado: a.estadoCarenciaCarne, horas: a.carenciaCarneHoras?.toString() ?? "" } }); setJustificativaCarne(a.justificativaCarenciaCarne ?? ""); }}><Pencil size={16} aria-hidden /><span className="sr-only">Carência</span></button><button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Anular aplicação de ${a.nomeProdutoAplicado}`} title="Anular com motivo" onClick={() => { setErro(null); setCorrecao({ id: a.id, anular: true }); setMotivo(""); }}><Ban size={16} aria-hidden /><span className="sr-only">Anular</span></button></div>}
</div> },
    ]} /></SecaoAplicacoes>}
    {!geral && <HistoricoSanitario key={versao + recarregarToken} animalId={animalId} abrir={(tipo, id) => setDetalhe({ tipo, id })} />}
    </>}
    {novoFato === "protocolo" ? <FormRodada animalInicial={animalId} onFechar={() => setNovoFato(null)} onSalvo={() => { setNovoFato(null); atualizar(); }} /> : novoFato && <FormFatoSanitario tipo={novoFato} animalInicial={animalId} fixo onFechar={() => setNovoFato(null)} onSalvo={() => { setNovoFato(null); atualizar(); }} />}
    {detalhe && <PainelDetalheSanitario tipo={detalhe.tipo} onFechar={() => setDetalhe(null)}>
      {erroDetalhe ? <><ErrorBox erro={erroDetalhe} /><Button secondary onClick={() => setRetryDetalhe((v) => v + 1)}>Tentar novamente</Button></> : conteudo == null ? <SkeletonSanitario estrutura="detalhe" label="Carregando detalhe sanitário…" /> : <DetalheSanitario tipo={detalhe.tipo} valor={conteudo} abrir={(tipo, id) => setDetalhe({ tipo, id })} />}
    </PainelDetalheSanitario>}
    {aberto && (geral ? <FormAplicacaoAnimal animalInicial={animalId} onFechar={() => setAberto(false)} onSalvo={(id, sitio) => { setAberto(false); atualizar(id, sitio); }} /> : propriedadeId != null && <FormAplicacaoServico animalId={animalId} propriedadeId={propriedadeId} onFechar={() => setAberto(false)} onSalvo={(id, sitio) => { setAberto(false); atualizar(id, sitio); }} />)}
    {reconciliando && (reconciliando.propriedadeId ?? propriedadeId) != null && <ReconciliarOrigem aplicacao={reconciliando} propriedadeId={(reconciliando.propriedadeId ?? propriedadeId)!} onFechar={() => setReconciliando(null)} onSalvo={() => { setReconciliando(null); atualizar(); }} />}
    {correcao && <PainelCadastro aberto titulo={correcao.anular ? "Anular aplicação sanitária" : "Corrigir carência"} onFechar={() => { if (!ocupado) setCorrecao(null); }} rodape={<Button type="submit" form="correcao-sanitaria" disabled={ocupado}>Confirmar com motivo</Button>}><form id="correcao-sanitaria" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void corrigir(); }}><ErrorBox erro={erro} /><p className="text-sm">{correcao.anular ? "A aplicação permanece no histórico. Informe se o material foi usado ou descartado antes de anular." : "A correção preserva os prazos anteriores na auditoria e revisa a aplicabilidade na finalidade atual."}</p>{correcao.anular && <DestinoConsumo valor={destinoConsumo} onChange={v => {setDestinoConsumo(v); setAdministracao("");}} administracao={administracao} onAdministracao={setAdministracao} />}{!correcao.anular && (["leite", "carne"] as const).map((d) => <fieldset key={d} className="grid gap-2"><legend>{d === "leite" ? "Leite" : "Abate/carne"}</legend><SelectCampo aria-label={`Estado da carência ${d}`} className={classeInput} value={prazos[d].estado} onValueChange={(valorSelecionado) => setPrazos((p) => ({ ...p, [d]: { ...p[d], estado: valorSelecionado as EstadoPrazo } }))}><option value="NAO_INFORMADO">Não informado</option><option value="INFORMADO">Prazo informado</option><option value="NAO_APLICAVEL">Não se aplica — confirmado</option></SelectCampo>{prazos[d].estado === "INFORMADO" && <input aria-label={`Carência ${d} em horas`} required type="number" min="0" step="1" className={classeInput} value={prazos[d].horas} onChange={(e) => setPrazos((p) => ({ ...p, [d]: { ...p[d], horas: e.target.value } }))} />}</fieldset>)}{!correcao.anular && prazos.carne.estado === "NAO_APLICAVEL" && <label>Justificativa da não aplicabilidade para carne<textarea required maxLength={500} className={classeInput} value={justificativaCarne} onChange={(e) => setJustificativaCarne(e.target.value)} /></label>}<label>Motivo da correção / anulação<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label></form></PainelCadastro>}
  </ConteinerSanidade>;
}
