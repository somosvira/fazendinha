import { useRef, useState } from "react";
import { Ban, Pencil, FlaskConical } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { reqSanidade, SanidadeApiError } from "./api";
export type ExameResultado = { id: string; formatoSnapshot: { tipoResultado: string; unidade?: string | null; opcoes?: string[] }; resultadoTexto: string | null; resultadoNumero: string | null; resultadoOpcao: string | null };
export function ResultadoExame({ exame, propriedadeId, onSalvo }: { exame: ExameResultado; propriedadeId: number; onSalvo: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState(exame.resultadoTexto ?? exame.resultadoNumero ?? exame.resultadoOpcao ?? "");
  const [anular, setAnular] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [campoErro, setCampoErro] = useState("");
  const trava = useRef(false);
  const atual = exame.formatoSnapshot.tipoResultado === "NUMERO" ? exame.resultadoNumero : exame.formatoSnapshot.tipoResultado === "OPCAO" ? exame.resultadoOpcao : exame.resultadoTexto;
  const informado = atual != null && atual !== "";
  const rotulo = informado ? "Corrigir resultado" : "Informar resultado";
  async function salvar() { if (trava.current) return; if (motivo.trim().length < 5) { setErro("Informe um motivo com pelo menos 5 caracteres."); setCampoErro("motivo"); return; } trava.current = true; setOcupado(true); setErro(null); setCampoErro(""); try { await reqSanidade(`/exames/${exame.id}/correcao`, { method: "POST", body: JSON.stringify({ propriedadeId, motivo: motivo.trim(), anular, ...(anular ? {} : exame.formatoSnapshot.tipoResultado === "NUMERO" ? { resultadoNumero: Number(resultado) } : exame.formatoSnapshot.tipoResultado === "OPCAO" ? { resultadoOpcao: resultado } : { resultadoTexto: resultado }) }) }); setAberto(false); onSalvo(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); setCampoErro(e instanceof SanidadeApiError ? e.campo ?? "" : ""); } finally { trava.current = false; setOcupado(false); } }
  function abrir(anulacao: boolean) { setAnular(anulacao); setResultado(atual ?? ""); setMotivo(""); setErro(null); setAberto(true); }
  const botao = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-ink hover:bg-surface-2";
  return <><button type="button" className={botao} title={rotulo} aria-label={rotulo} onClick={() => abrir(false)}>{informado ? <Pencil size={16} /> : <FlaskConical size={16} />}</button><button type="button" className={botao} title="Anular exame" aria-label="Anular exame" onClick={() => abrir(true)}><Ban size={16} /></button>{aberto && <PainelCadastro aberto titulo={anular ? "Anular exame" : rotulo} onFechar={() => { if (!ocupado) setAberto(false); }} rodape={<><ErrorBox erro={erro} /><Button type="submit" form={`resultado-${exame.id}`} disabled={ocupado}>Confirmar com motivo</Button></>}><form id={`resultado-${exame.id}`} className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} />{anular ? <p>O exame será anulado e permanecerá no histórico.</p> : <label>Resultado {exame.formatoSnapshot.unidade ?? ""}{exame.formatoSnapshot.tipoResultado === "OPCAO" ? <select required value={resultado} onChange={(e) => setResultado(e.target.value)} className={classeInput}><option value="">Selecione</option>{exame.formatoSnapshot.opcoes?.map((o) => <option key={o}>{o}</option>)}</select> : <input required type={exame.formatoSnapshot.tipoResultado === "NUMERO" ? "number" : "text"} step="any" value={resultado} onChange={(e) => setResultado(e.target.value)} className={classeInput} />}{campoErro.startsWith("resultado") && <ErrorBox erro={erro} />}</label>}<label>Motivo<textarea required minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={classeInput} />{campoErro === "motivo" && <ErrorBox erro={erro} />}</label><p className="text-sm text-ink-3">O formato é aquele preservado na coleta. Os resultados anteriores ficam no histórico.</p></form></PainelCadastro>}</>;
}
