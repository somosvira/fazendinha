import { SelectCampo } from "@/financeiro/SelectCampo";
import { useRef, useState } from "react";
import { Ban, Pencil, FlaskConical } from "lucide-react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro as PainelBase } from "../../../financeiro/PainelCadastro";

const PainelCadastro = (props: Parameters<typeof PainelBase>[0]) => <PainelBase {...props} compacto />;
import { reqSanidade, SanidadeApiError } from "./api";
export type ExameResultado = { id: string; formatoSnapshot: { tipoResultado: string; unidade?: string | null; opcoes?: string[] }; resultadoTexto: string | null; resultadoNumero: string | null; resultadoOpcao: string | null; animal?: { brinco: string; nome?: string | null }; tipoExame?: { nome: string } };
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
  const botao = "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-sm text-ink hover:bg-surface-2";
  return <><button type="button" className={botao} title={rotulo} aria-label={rotulo} onClick={() => abrir(false)}>{informado ? <Pencil size={16} aria-hidden /> : <FlaskConical size={16} aria-hidden />}<span>{informado ? "Corrigir" : "Resultado"}</span></button><button type="button" className={botao} title="Anular exame" aria-label="Anular exame" onClick={() => abrir(true)}><Ban size={16} aria-hidden /><span>Anular</span></button>{aberto && <PainelCadastro aberto titulo={anular ? "Anular exame" : rotulo} onFechar={() => { if (!ocupado) setAberto(false); }} rodape={<><ErrorBox erro={erro} /><Button type="submit" form={`resultado-${exame.id}`} disabled={ocupado}>Confirmar com motivo</Button></>}><form id={`resultado-${exame.id}`} className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} /><p className="text-sm text-ink-3">{exame.tipoExame?.nome ?? "Exame"}{exame.animal ? ` · Animal ${exame.animal.brinco}${exame.animal.nome ? ` · ${exame.animal.nome}` : ""}` : ""}</p>{anular ? <p>O exame será anulado e permanecerá no histórico.</p> : <label>Resultado {exame.formatoSnapshot.unidade ?? ""}{exame.formatoSnapshot.tipoResultado === "OPCAO" ? <SelectCampo required value={resultado} onValueChange={(valorSelecionado) => setResultado(valorSelecionado)} className={classeInput}><option value="">Selecione</option>{exame.formatoSnapshot.opcoes?.map((o) => <option key={o}>{o}</option>)}</SelectCampo> : <input required type={exame.formatoSnapshot.tipoResultado === "NUMERO" ? "number" : "text"} step="any" value={resultado} onChange={(e) => setResultado(e.target.value)} className={classeInput} />}{campoErro.startsWith("resultado") && <ErrorBox erro={erro} />}</label>}<label>Motivo<textarea required minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={classeInput} />{campoErro === "motivo" && <ErrorBox erro={erro} />}</label><p className="text-sm text-ink-3">O formato é aquele preservado na coleta. Os resultados anteriores ficam no histórico.</p></form></PainelCadastro>}</>;
}
