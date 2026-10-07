import { useEffect, useState } from "react";
import { Syringe, Eye, Link2, Pencil, Ban } from "lucide-react";
import { CardFicha } from "../ui";
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
import { DetalheSanitario } from "./DetalheSanitario";
import { PainelDetalheSanitario } from "./PainelDetalheSanitario";
import { dataAplicacaoSanitaria, unidadeSanitaria, tipoSanitario, origemSanitaria, nomeAnimalSanitario } from "./rotulos";
import { TabelaFinanceira } from "../../../financeiro/financeiro-ui";

export function SanidadeAnimal({ animalId, propriedadeId, podeLancar, recarregarToken, lista, onMudou, geral = false, abrirDetalhe }: {
  animalId: string; propriedadeId: number | null; podeLancar: boolean; recarregarToken: number;
  lista?: AplicacaoSanitaria[]; onMudou?: (id?: string, propriedadeIdFato?: number) => void; geral?: boolean; abrirDetalhe?: (tipo: string, id: string, propriedadeId?: number | null) => void;
}) {
  const [aplicacoes, setAplicacoes] = useState<AplicacaoSanitaria[]>([]);
  const [carencia, setCarencia] = useState<CarenciaAnimal | null>(null);
  const [reconciliando, setReconciliando] = useState<AplicacaoSanitaria | null>(null);
  const [aberto, setAberto] = useState(false);
  const [novoFato, setNovoFato] = useState<TipoFatoSanitario | null>(null);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [correcao, setCorrecao] = useState<{ id: string; anular: boolean } | null>(null);
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
    setOcupado(true); setErro(null);
    try { const sitioRegistro = aplicacoes.find((a) => a.id === correcao.id)?.propriedadeId ?? propriedadeId; await reqSanidade(`/aplicacoes/${correcao.id}/${correcao.anular ? "anulacao" : "carencia"}`, { method: "POST", body: JSON.stringify(correcao.anular ? { propriedadeId: sitioRegistro, motivo } : { propriedadeId: sitioRegistro, motivo, estadoCarenciaLeite: prazos.leite.estado, estadoCarenciaCarne: prazos.carne.estado, carenciaLeiteHoras: prazos.leite.estado === "INFORMADO" && prazos.leite.horas !== "" ? Number(prazos.leite.horas) : null, carenciaCarneHoras: prazos.carne.estado === "INFORMADO" && prazos.carne.horas !== "" ? Number(prazos.carne.horas) : null, justificativaCarenciaCarne: justificativaCarne || null }) }); setCorrecao(null); atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
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

  return <CardFicha icon={Syringe} titulo={geral ? "Aplicações" : "Sanidade"} className="lg:col-span-2"
    acao={podeLancar && (geral || propriedadeId != null) ? <div className="flex flex-wrap gap-2"><Button secondary onClick={() => setAberto(true)}>Registrar aplicação sanitária</Button>{!geral && <><Button secondary onClick={() => setNovoFato("ocorrencia")}>Nova ocorrência</Button><Button secondary onClick={() => setNovoFato("exame")}>Registrar exame</Button><Button secondary onClick={() => setNovoFato("protocolo")}>Iniciar protocolo</Button></>}</div> : undefined}>
    {erro && <p className="text-sm text-red-700">{erro}</p>}
    {erroConsulta && <><ErrorBox erro={erroConsulta} /><Button secondary onClick={() => atualizar()}>Tentar novamente</Button></>}
    {carregando && <p>Carregando aplicações…</p>}
    {animalId && <CarenciasSanitarias carencia={carencia} />}
    {!geral && animalId && <RodadasAnimal animalId={animalId} revisao={versao + recarregarToken} />}
    {<TabelaFinanceira rotulo="Aplicações sanitárias" itens={aplicacoes} chaveDe={(a) => a.id} onAbrir={verDetalhe} barraRolagemSuperior colunas={[
      { chave: "animal", titulo: "Animal", principal: true, celula: (a) => a.animal ? nomeAnimalSanitario(a.animal) : "Animal não identificado" },
      { chave: "data", titulo: "Data e hora", larguraMinima: 170, celula: (a) => dataAplicacaoSanitaria(a) },
      { chave: "tipo", titulo: "Tipo", celula: tipoSanitario },
      { chave: "medicamento", titulo: "Produto vinculado / nome histórico", larguraMinima: 180, celula: (a) => <><div>{a.produto?.nome ?? "Não vinculado"}</div><div className="text-xs text-ink-3">Nome histórico: {a.nomeProdutoAplicado}</div></> },
      { chave: "quantidade", titulo: "Quantidade", celula: (a) => `${a.dose} ${unidadeSanitaria(a.unidadeDose)}` },
      { chave: "origem", titulo: "Origem", celula: (a) => origemSanitaria(a.origemInsumo) },
      { chave: "situacao", titulo: "Situação", celula: (a) => a.status === "ANULADO" ? "Anulada" : "" },
      { chave: "acoes", titulo: "Ações", acoes: true, larguraMinima: 180, celula: (a) => <div className="flex flex-wrap items-center gap-2" onClick={(evento) => evento.stopPropagation()}><button type="button" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Ver detalhes de ${a.nomeProdutoAplicado}`} title="Ver detalhes" onClick={() => verDetalhe(a)}><Eye size={16} aria-hidden /></button>{podeLancar && (a.propriedadeId ?? propriedadeId) != null && a.status === "VALIDO" && <div className="flex flex-wrap gap-2">{a.origemInsumo === "SEM_ORIGEM_JUSTIFICADA" && <button type="button" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Reconciliar origem de ${a.nomeProdutoAplicado}`} title="Reconciliar origem" onClick={() => setReconciliando(a)}><Link2 size={16} aria-hidden /></button>}<button type="button" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Corrigir carência de ${a.nomeProdutoAplicado}`} title="Corrigir carência" onClick={() => { setErro(null); setCorrecao({ id: a.id, anular: false }); setMotivo(""); setPrazos({ leite: { estado: a.estadoCarenciaLeite, horas: a.carenciaLeiteHoras?.toString() ?? "" }, carne: { estado: a.estadoCarenciaCarne, horas: a.carenciaCarneHoras?.toString() ?? "" } }); setJustificativaCarne(a.justificativaCarenciaCarne ?? ""); }}><Pencil size={16} aria-hidden /></button><button type="button" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2" aria-label={`Anular aplicação de ${a.nomeProdutoAplicado}`} title="Anular com motivo" onClick={() => { setErro(null); setCorrecao({ id: a.id, anular: true }); setMotivo(""); }}><Ban size={16} aria-hidden /></button></div>}
</div> },
    ]} />}
    {!geral && <HistoricoSanitario key={versao + recarregarToken} animalId={animalId} abrir={(tipo, id) => setDetalhe({ tipo, id })} />}
    {novoFato === "protocolo" ? <FormRodada animalInicial={animalId} onFechar={() => setNovoFato(null)} onSalvo={() => { setNovoFato(null); atualizar(); }} /> : novoFato && <FormFatoSanitario tipo={novoFato} animalInicial={animalId} fixo onFechar={() => setNovoFato(null)} onSalvo={() => { setNovoFato(null); atualizar(); }} />}
    {detalhe && <PainelDetalheSanitario onFechar={() => setDetalhe(null)}>
      {erroDetalhe ? <><ErrorBox erro={erroDetalhe} /><Button secondary onClick={() => setRetryDetalhe((v) => v + 1)}>Tentar novamente</Button></> : conteudo == null ? <p>Carregando detalhe…</p> : <DetalheSanitario tipo={detalhe.tipo} valor={conteudo} abrir={(tipo, id) => setDetalhe({ tipo, id })} />}
    </PainelDetalheSanitario>}
    {aberto && (geral ? <FormAplicacaoAnimal animalInicial={animalId} onFechar={() => setAberto(false)} onSalvo={(id, sitio) => { setAberto(false); atualizar(id, sitio); }} /> : propriedadeId != null && <FormAplicacaoServico animalId={animalId} propriedadeId={propriedadeId} onFechar={() => setAberto(false)} onSalvo={(id, sitio) => { setAberto(false); atualizar(id, sitio); }} />)}
    {reconciliando && (reconciliando.propriedadeId ?? propriedadeId) != null && <ReconciliarOrigem aplicacao={reconciliando} propriedadeId={(reconciliando.propriedadeId ?? propriedadeId)!} onFechar={() => setReconciliando(null)} onSalvo={() => { setReconciliando(null); atualizar(); }} />}
    {correcao && <PainelCadastro aberto titulo={correcao.anular ? "Anular aplicação sanitária" : "Corrigir carência"} onFechar={() => { if (!ocupado) setCorrecao(null); }} rodape={<Button type="submit" form="correcao-sanitaria" disabled={ocupado}>Confirmar com motivo</Button>}><form id="correcao-sanitaria" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void corrigir(); }}><ErrorBox erro={erro} /><p className="text-sm">{correcao.anular ? "A saída de estoque será estornada nos lotes originais. A aplicação permanece no histórico. Para corrigir medicamento, quantidade ou data, faça um novo lançamento após anular." : "A correção preserva os prazos anteriores na auditoria e revisa a aplicabilidade na finalidade atual."}</p>{!correcao.anular && (["leite", "carne"] as const).map((d) => <fieldset key={d} className="grid gap-2"><legend>{d === "leite" ? "Leite" : "Abate/carne"}</legend><select aria-label={`Estado da carência ${d}`} className={classeInput} value={prazos[d].estado} onChange={(e) => setPrazos((p) => ({ ...p, [d]: { ...p[d], estado: e.target.value as EstadoPrazo } }))}><option value="NAO_INFORMADO">Não informado</option><option value="INFORMADO">Prazo informado</option><option value="NAO_APLICAVEL">Não se aplica — confirmado</option></select>{prazos[d].estado === "INFORMADO" && <input aria-label={`Carência ${d} em horas`} required type="number" min="0" step="1" className={classeInput} value={prazos[d].horas} onChange={(e) => setPrazos((p) => ({ ...p, [d]: { ...p[d], horas: e.target.value } }))} />}</fieldset>)}{!correcao.anular && prazos.carne.estado === "NAO_APLICAVEL" && <label>Justificativa da não aplicabilidade para carne<textarea required maxLength={500} className={classeInput} value={justificativaCarne} onChange={(e) => setJustificativaCarne(e.target.value)} /></label>}<label>Motivo da correção / anulação<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label></form></PainelCadastro>}
  </CardFicha>;
}
