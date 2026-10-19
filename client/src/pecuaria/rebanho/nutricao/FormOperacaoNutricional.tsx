import { SelectCampo } from "@/financeiro/SelectCampo";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje, Panel } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { buscarLote, listarLotes } from "../api";
import type { Lote } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { atribuirDieta, corrigirVigencia, listarCentrosNutricionais, listarDietas, obterVigencia } from "./api";
import { useConsulta } from "./consulta";
import { EstadoConsulta } from "./componentes";
import { ConferenciaPeriodos } from "./ConferenciaPeriodos";

type Acao = "atribuir" | "corrigir" | "consumo";
export function FormOperacaoNutricional({ acao, loteId, vigenciaId, onVoltar, onSalvo }: { acao: Acao; loteId?: string; vigenciaId?: string; onVoltar: () => void; onSalvo: (loteId: string) => void }) {
  const contexto = useConsulta(useCallback(async () => loteId ? [await buscarLote(loteId)] : listarLotes(), [loteId]));
  const [selecao, setSelecao] = useState(loteId ?? "");
  const [ocupado, setOcupado] = useState(false);
  const lote = contexto.dados?.find((l) => l.id === selecao);
  return <div className="nutricao-formulario"><Panel><div className="nutricao-card-cabecalho"><div><h1 className="h1">{acao === "consumo" ? "Conferir consumo" : acao === "corrigir" ? "Corrigir vigência" : "Atribuir dieta ao lote"}</h1></div></div><div className="nutricao-card-corpo"><EstadoConsulta erro={contexto.erro} carregando={contexto.carregando} recarregar={contexto.carregar} />
    {contexto.dados && <>{loteId ? <p className="nutricao-contexto"><strong>{lote?.nome}</strong> · {lote?.propriedade.nome} · {lote?.animaisAtivos} animais ativos hoje</p> : <label>Lote<SelectCampo className={classeInput} disabled={ocupado} value={selecao} onValueChange={(valorSelecionado) => setSelecao(valorSelecionado)}><option value="">Selecione o lote</option>{contexto.dados.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</SelectCampo></label>}
      {lote && (lote.ativo ? acao === "consumo" ? <FormConsumo key={lote.id} lote={lote} onOcupado={setOcupado} onSalvo={() => onSalvo(lote.id)} /> : <FormVigencia key={`${lote.id}:${vigenciaId}`} acao={acao} lote={lote} vigenciaId={vigenciaId} onVoltar={onVoltar} onOcupado={setOcupado} onSalvo={() => onSalvo(lote.id)} /> : <p role="alert" className="nutricao-aviso">Este lote está inativo. Seu histórico permanece disponível para consulta.</p>)}
    </>}
  </div>{(acao === "consumo" || !lote || !lote.ativo) && <div className="nutricao-form-rodape"><Button secondary disabled={ocupado} onClick={onVoltar}>Cancelar</Button></div>}</Panel><p className="nutricao-nota">{acao === "consumo" ? "A prévia separa o período por mês e vigência, considerando os dias de permanência dos animais. Produtos com a mesma validade compartilham o lote de estoque, independentemente do fornecedor." : acao === "corrigir" ? "A correção ajusta também o fim da vigência anterior contígua. Fechamentos afetados devem ser estornados antes." : "Somente versões publicadas podem ser atribuídas. A troca encerra a dieta anterior na data informada."}</p></div>;
}
function FormConsumo({ lote, onSalvo, onOcupado }: { lote: Lote; onSalvo: () => void; onOcupado: (v: boolean) => void }) {
  const centros = useConsulta(useCallback(listarCentrosNutricionais, []));
  return <><EstadoConsulta erro={centros.erro} carregando={centros.carregando} recarregar={centros.carregar} />{centros.dados && <ConferenciaPeriodos loteId={lote.id} propriedadeId={lote.propriedadeId} centros={centros.dados.filter((c) => c.ativo)} onOcupado={onOcupado} onSalvo={async () => onSalvo()} />}</>;
}
function FormVigencia({ acao, lote, vigenciaId, onSalvo, onOcupado, onVoltar }: { acao: "atribuir" | "corrigir"; lote: Lote; vigenciaId?: string; onVoltar: () => void; onSalvo: () => void; onOcupado: (v: boolean) => void }) {
  const consulta = useConsulta(useCallback(async () => {
    if (acao === "atribuir") return { dietas: await listarDietas(), vigencia: null };
    if (!vigenciaId) throw new Error("Selecione a vigência que deseja corrigir.");
    const vigencia = await obterVigencia(vigenciaId, lote.id);
    if (vigencia.loteId !== lote.id) throw new Error("A vigência não pertence a este lote.");
    return { dietas: [], vigencia };
  }, [acao, lote.id, vigenciaId]));
  const [dietaId, setDieta] = useState("");
  const [desde, setDesde] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  useEffect(() => { onOcupado(ocupado); }, [ocupado, onOcupado]);
  useEffect(() => { if (consulta.dados?.vigencia) setDesde(consulta.dados.vigencia.desde.slice(0, 10)); }, [consulta.dados?.vigencia]);
  const publicadas = consulta.dados?.dietas.filter((d) => d.publicadaEm) ?? [];
  async function salvar() {
    if (enviando.current || !consulta.dados || !desde || (acao === "corrigir" && motivo.trim().length < 5)) return;
    if (acao === "atribuir" && !dietaId) { setErro("Selecione uma receita publicada."); return; }
    enviando.current = true; setOcupado(true); setErro(null);
    try {
      if (acao === "corrigir" && consulta.dados.vigencia) await corrigirVigencia(consulta.dados.vigencia.id, { propriedadeId: lote.propriedadeId, desde, motivo: motivo.trim() });
      else await atribuirDieta({ loteId: lote.id, propriedadeId: lote.propriedadeId, dietaId, desde });
      onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviando.current = false; setOcupado(false); }
  }
  return <><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} />{!consulta.dados && <Button secondary onClick={onVoltar}>Cancelar</Button>}{consulta.dados && <form onSubmit={(e) => { e.preventDefault(); void salvar(); }}><fieldset disabled={ocupado} className="nutricao-vigencia-campos grid gap-4 mt-5"><ErrorBox erro={erro} />
    {acao === "atribuir" ? <label>Versão publicada<SelectCampo className={classeInput} required value={dietaId} onValueChange={(valorSelecionado) => setDieta(valorSelecionado)}><option value="">Selecione uma receita</option>{publicadas.map((d) => <option key={d.id} value={d.id}>{d.nome} · v{d.versao}</option>)}</SelectCampo>{!publicadas.length && <span className="nutricao-nota">Publique uma receita antes de atribuí-la.</span>}</label> : <p className="nutricao-aviso">{consulta.dados.vigencia?.dieta.nome} · v{consulta.dados.vigencia?.dieta.versao}<br />Início atual: {consulta.dados.vigencia && formatarDataBR(consulta.dados.vigencia.desde)}. Fechamentos afetados devem ser estornados antes.</p>}
    <label>Início da vigência<DatePicker value={desde} onChange={setDesde} /></label>

    {acao === "corrigir" && <label>Motivo da correção<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>}
    <div className="nutricao-acoes"><Button secondary disabled={ocupado} onClick={onVoltar}>Cancelar</Button><Button type="submit" disabled={ocupado || !desde || (acao === "atribuir" ? !dietaId : motivo.trim().length < 5)}>{ocupado ? "Salvando…" : acao === "corrigir" ? "Confirmar correção" : "Aplicar ao lote"}</Button></div>
  </fieldset></form>}</>;
}
