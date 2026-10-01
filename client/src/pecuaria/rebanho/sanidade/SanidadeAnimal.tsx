import { useEffect, useState } from "react";
import { Syringe } from "lucide-react";
import { CardFicha } from "../ui";
import { formatarDataBR } from "../lib/rotulos";
import { consultarCarencia, listarAplicacoes, type AplicacaoSanitaria, type CarenciaAnimal } from "./api";
import { ReconciliarOrigem } from "./ReconciliarOrigem";
import { HistoricoSanitario } from "./HistoricoSanitario";
import { FormAplicacaoServico } from "./FormAplicacaoServico";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { reqSanidade, type EstadoPrazo } from "./api";

export function resumoCarencia(estado: CarenciaAnimal["leite"]): string {
  if (estado.estado === "NENHUMA") return "Sem aplicação ativa";
  if (estado.estado === "NAO_INFORMADO") return "Carência não informada";
  if (estado.estado === "NAO_APLICAVEL") return "Não se aplica (confirmado)";
  if (estado.estado !== "CONHECIDO") return "Carência não informada";
  return `Até ${new Date(estado.ate).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${estado.precisaoAproximada ? " (aproximado)" : ""}`;
}

export function SanidadeAnimal({ animalId, propriedadeId, podeLancar, recarregarToken, lista, onMudou }: {
  animalId: string; propriedadeId: number | null; podeLancar: boolean; recarregarToken: number;
  lista?: AplicacaoSanitaria[]; onMudou?: () => void;
}) {
  const [aplicacoes, setAplicacoes] = useState<AplicacaoSanitaria[]>([]);
  const [carencia, setCarencia] = useState<CarenciaAnimal | null>(null);
  const [reconciliando, setReconciliando] = useState<AplicacaoSanitaria | null>(null);
  const [aberto, setAberto] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [correcao, setCorrecao] = useState<{ id: string; anular: boolean } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [prazos, setPrazos] = useState<Record<"leite" | "carne", { estado: EstadoPrazo; horas: string }>>({ leite: { estado: "NAO_INFORMADO", horas: "" }, carne: { estado: "NAO_INFORMADO", horas: "" } });
  const [justificativaCarne, setJustificativaCarne] = useState("");
  const [ocupado, setOcupado] = useState(false);
  function atualizar() { setVersao((v) => v + 1); onMudou?.(); }
  async function corrigir() {
    if (!correcao || propriedadeId == null || ocupado) return;
    setOcupado(true); setErro(null);
    try { await reqSanidade(`/aplicacoes/${correcao.id}/${correcao.anular ? "anulacao" : "carencia"}`, { method: "POST", body: JSON.stringify(correcao.anular ? { propriedadeId, motivo } : { propriedadeId, motivo, estadoCarenciaLeite: prazos.leite.estado, estadoCarenciaCarne: prazos.carne.estado, carenciaLeiteHoras: prazos.leite.estado === "INFORMADO" && prazos.leite.horas !== "" ? Number(prazos.leite.horas) : null, carenciaCarneHoras: prazos.carne.estado === "INFORMADO" && prazos.carne.horas !== "" ? Number(prazos.carne.horas) : null, justificativaCarenciaCarne: justificativaCarne || null }) }); setCorrecao(null); atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  useEffect(() => {
    let vivo = true;
    Promise.all([lista ? Promise.resolve(lista) : listarAplicacoes(animalId), consultarCarencia(animalId)])
      .then(([lista, prazos]) => { if (vivo) { setAplicacoes(lista); setCarencia(prazos); setErro(null); } })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [animalId, recarregarToken, versao, lista]);

  return <CardFicha icon={Syringe} titulo="Sanidade" className="lg:col-span-2"
    acao={podeLancar && propriedadeId != null ? <button type="button" className="text-xs font-semibold text-green-800" onClick={() => setAberto(true)}>Registrar aplicação sanitária</button> : undefined}>
    {erro && <p className="text-sm text-red-700">{erro}</p>}
    <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Leite:</strong> {carencia ? resumoCarencia(carencia.leite) : "Carregando…"}</p><p><strong>Carne:</strong> {carencia ? resumoCarencia(carencia.carne) : "Carregando…"}</p></div>
    <div className="mt-4 space-y-2">{aplicacoes.length ? aplicacoes.map((a) => <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
      <div className="font-semibold text-ink">{a.nomeProdutoAplicado} · {a.dose} {a.unidadeDose ?? ""}</div>
      {a.responsavel && <p>Responsável pela aplicação: {a.responsavel}</p>}
      {a.partidaCodigoSnapshot && <p>Partida: {a.partidaCodigoSnapshot} · validade: {a.partidaValidadeSnapshot ? formatarDataBR(a.partidaValidadeSnapshot) : "não informada"}</p>}
      {a.justificativaSemOrigem && <p>Justificativa de origem preservada: {a.justificativaSemOrigem}</p>}
      <p className="text-ink-3">{formatarDataBR(a.data)} · {a.tipoAplicacaoNomeSnapshot ?? a.finalidade} · {a.origemInsumo === "INCLUSO_SERVICO" ? "Dose inclusa em Serviço" : a.origemInsumo === "BAIXA_ESTOQUE" ? "Estoque" : a.origemInsumo === "COMPRA_CONSUMO_DIRETO" ? "Compra direta" : "Origem pendente de reconciliação"}{a.status === "ANULADO" ? " · Anulada" : ""}</p>
      {podeLancar && propriedadeId != null && a.status === "VALIDO" && <div className="mt-2 flex flex-wrap gap-2">{a.origemInsumo === "SEM_ORIGEM_JUSTIFICADA" && <Button secondary onClick={() => setReconciliando(a)}>Reconciliar origem</Button>}<Button secondary onClick={() => { setCorrecao({ id: a.id, anular: false }); setMotivo(""); setPrazos({ leite: { estado: a.estadoCarenciaLeite, horas: a.carenciaLeiteHoras?.toString() ?? "" }, carne: { estado: a.estadoCarenciaCarne, horas: a.carenciaCarneHoras?.toString() ?? "" } }); setJustificativaCarne(a.justificativaCarenciaCarne ?? ""); }}>Corrigir carência</Button><Button secondary onClick={() => { setCorrecao({ id: a.id, anular: true }); setMotivo(""); }}>Anular com motivo</Button></div>}
    </div>) : <p className="text-sm text-ink-3">Nenhuma aplicação registrada.</p>}</div>
    <HistoricoSanitario key={versao + recarregarToken} animalId={animalId} />
    {aberto && propriedadeId != null && <FormAplicacaoServico animalId={animalId} propriedadeId={propriedadeId} onFechar={() => setAberto(false)} onSalvo={() => { setAberto(false); atualizar(); }} />}
    {reconciliando && propriedadeId != null && <ReconciliarOrigem aplicacao={reconciliando} propriedadeId={propriedadeId} onFechar={() => setReconciliando(null)} onSalvo={() => { setReconciliando(null); atualizar(); }} />}
    {correcao && <PainelCadastro aberto titulo={correcao.anular ? "Anular aplicação sanitária" : "Corrigir carência"} onFechar={() => { if (!ocupado) setCorrecao(null); }} rodape={<Button type="submit" form="correcao-sanitaria" disabled={ocupado}>Confirmar com motivo</Button>}><form id="correcao-sanitaria" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void corrigir(); }}><ErrorBox erro={erro} /><p className="text-sm">{correcao.anular ? "A saída de estoque será estornada nas partidas originais. A aplicação permanece no histórico. Para corrigir medicamento, quantidade ou data, faça um novo lançamento após anular." : "A correção preserva os prazos anteriores na auditoria e revisa a aplicabilidade na finalidade atual."}</p>{!correcao.anular && (["leite", "carne"] as const).map((d) => <fieldset key={d} className="grid gap-2"><legend>{d === "leite" ? "Leite" : "Abate/carne"}</legend><select aria-label={`Estado da carência ${d}`} className={classeInput} value={prazos[d].estado} onChange={(e) => setPrazos((p) => ({ ...p, [d]: { ...p[d], estado: e.target.value as EstadoPrazo } }))}><option value="NAO_INFORMADO">Não informado</option><option value="INFORMADO">Prazo informado</option><option value="NAO_APLICAVEL">Não se aplica — confirmado</option></select>{prazos[d].estado === "INFORMADO" && <input aria-label={`Carência ${d} em horas`} required type="number" min="0" step="1" className={classeInput} value={prazos[d].horas} onChange={(e) => setPrazos((p) => ({ ...p, [d]: { ...p[d], horas: e.target.value } }))} />}</fieldset>)}{!correcao.anular && prazos.carne.estado === "NAO_APLICAVEL" && <label>Justificativa da não aplicabilidade para carne<textarea required maxLength={500} className={classeInput} value={justificativaCarne} onChange={(e) => setJustificativaCarne(e.target.value)} /></label>}<label>Motivo da correção / anulação<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label></form></PainelCadastro>}
  </CardFicha>;
}
