import { useEffect, useRef, useState } from "react";
import { Scissors } from "lucide-react";
import { comPropriedade } from "../../../propriedadeScope";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { CardFicha } from "../ui";
import type { AnimalResumo, HistoricoLocalizacao } from "../types";

export async function reqManejo<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(`/api/pecuaria/rebanho/manejo${path}`, { method: body ? "POST" : "GET", headers: comPropriedade(body ? { "content-type": "application/json" } : {}), ...(body ? { body: JSON.stringify(body) } : {}) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Não foi possível processar o manejo"); return d as T;
}
type Manejo = { id: string; propriedadeId: number | null; data: string; tipo: "DESMAMA" | "CASTRACAO"; status: "VALIDO" | "ANULADO"; pesagem: { pesoKg: string } | null };
export function ManejoAnimal({ animalId, propriedadeId, localizacoes, baixaData, podeLancar, onSalvo }: { animalId: string; propriedadeId: number | null; localizacoes?: HistoricoLocalizacao[]; baixaData?: string | null; podeLancar: boolean; onSalvo: () => void }) {
  const [itens, setItens] = useState<Manejo[]>([]);
  const [revisao, setRevisao] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [anulando, setAnulando] = useState<Manejo | null>(null);
  const [tipo, setTipo] = useState<Manejo["tipo"]>("DESMAMA");
  const [data, setData] = useState(hoje());
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [peso, setPeso] = useState("");
  const [motivo, setMotivo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const trava = useRef(false);
  const localDoFato = localizacoes?.find((l) => l.propriedade && l.desde.slice(0, 10) <= data && (l.ate == null || l.ate.slice(0, 10) > data || (baixaData?.slice(0, 10) === data && l.ate.slice(0, 10) === data)));
  const sitioDoFato = localizacoes ? localDoFato?.propriedade?.id ?? null : propriedadeId;
  useEffect(() => { let vivo = true; setCarregando(true); reqManejo<Manejo[]>(`/eventos?animalId=${animalId}`).then((d) => { if (vivo) { setItens(d); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [animalId, revisao]);
  async function salvar() { if (trava.current) return; if (!anulando && (sitioDoFato == null || (baixaData && data > baixaData.slice(0, 10)))) { setErro("Escolha data e sítio válidos até a baixa do animal."); return; } const sitio = anulando ? anulando.propriedadeId ?? propriedadeId : sitioDoFato; if (sitio == null) { setErro("Sítio do manejo não identificado."); return; } trava.current = true; setOcupado(true); setErro(null); try { await reqManejo(anulando ? `/eventos/${anulando.id}/anulacao` : "/eventos", anulando ? { propriedadeId: sitio, motivo } : { chave, animalId, propriedadeId: sitio, tipo, data, pesoKg: peso === "" ? null : Number(peso), responsavel: responsavel || null }); setAberto(false); setAnulando(null); setRevisao((v) => v + 1); onSalvo(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { trava.current = false; setOcupado(false); } }
  return <CardFicha icon={Scissors} titulo="Manejo" acao={podeLancar && propriedadeId != null ? <Button secondary onClick={() => { setAberto(true); setPeso(""); setData(baixaData?.slice(0, 10) ?? hoje()); setChave(crypto.randomUUID()); }}>Registrar manejo</Button> : undefined}><ErrorBox erro={erro} />{carregando ? <p>Carregando manejo…</p> : <><p className="text-sm">Desmama: {itens.some((i) => i.tipo === "DESMAMA" && i.status === "VALIDO") ? "Registrada" : "Não informada"}</p>{itens.map((i) => <div key={i.id} className="mt-3 border-t border-border pt-3 text-sm"><strong>{i.tipo === "DESMAMA" ? "Desmama" : "Castração"}</strong> · {i.data.slice(0, 10)} · {i.status}{i.pesagem ? ` · ${i.pesagem.pesoKg} kg` : ""}{podeLancar && i.status === "VALIDO" && <Button secondary className="mt-2" onClick={() => { setAnulando(i); setMotivo(""); }}>Anular com motivo</Button>}</div>)}</>}{(aberto || anulando) && <PainelCadastro aberto titulo={anulando ? "Anular manejo" : "Registrar manejo"} onFechar={() => { if (!ocupado) { setAberto(false); setAnulando(null); } }} rodape={<Button type="submit" form="form-manejo" disabled={ocupado}>Confirmar</Button>}><form id="form-manejo" className="grid gap-4" onChange={() => { if (!anulando) setChave(crypto.randomUUID()); }} onSubmit={(e) => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} />{anulando ? <><p className="text-sm">A pesagem vinculada será preservada no histórico e no gráfico.</p><CampoFormulario id="manejo-motivo" rotulo="Motivo" obrigatorio>{(p) => <textarea {...p} required minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={classeInput} />}</CampoFormulario></> : <><CampoFormulario id="manejo-tipo" rotulo="Tipo">{(p) => <select {...p} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={classeInput}><option value="DESMAMA">Desmama</option><option value="CASTRACAO">Castração</option></select>}</CampoFormulario><CampoFormulario id="manejo-data" rotulo="Data" obrigatorio>{(p) => <DatePicker {...p} required max={baixaData?.slice(0, 10) ?? hoje()} value={data} onChange={setData} />}</CampoFormulario>{baixaData && <p className="text-xs text-ink-3">Histórico: o fato deve ser até a baixa em {baixaData.slice(0, 10)} e será associado ao sítio dessa data.</p>}<CampoFormulario id="manejo-peso" rotulo="Peso (kg, opcional)">{(p) => <input {...p} type="number" min="0.01" step="0.01" value={peso} onChange={(e) => setPeso(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="manejo-responsavel" rotulo="Responsável (opcional)">{(p) => <input {...p} maxLength={160} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={classeInput} />}</CampoFormulario></>}</form></PainelCadastro>}</CardFicha>;
}

export function PesagemColetiva({ animais, onFechar, onSalvo }: { animais: AnimalResumo[]; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState(hoje());
  const [pesos, setPesos] = useState<Record<string, string>>({});
  const [origem, setOrigem] = useState("MANUAL");
  const [tipo, setTipo] = useState("ROTINA");
  const [revisado, setRevisado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const trava = useRef(false);
  const sitios = new Set(animais.map((a) => a.propriedade?.id));
  async function salvar() {
    if (trava.current) return;
    if (sitios.size !== 1 || !animais[0]?.propriedade) { setErro("Selecione animais do mesmo sítio."); return; }
    const invalidos = animais.filter((a) => !pesos[a.id] || !(Number(pesos[a.id]) > 0) || !/^\d+(\.\d{1,2})?$/.test(pesos[a.id]));
    if (invalidos.length) { setErro(`Confira os pesos de: ${invalidos.map((a) => a.brinco).join(", ")}. Use até duas casas decimais.`); return; }
    if (!revisado) { setRevisado(true); return; }
    trava.current = true; setOcupado(true); setErro(null);
    try { await reqManejo("/pesagens-coletivas", { chave, propriedadeId: animais[0].propriedade.id, data, tipo, origem, itens: animais.map((a) => ({ animalId: a.id, pesoKg: Number(pesos[a.id]) })) }); onSalvo(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { trava.current = false; setOcupado(false); }
  }
  function mudou() { setRevisado(false); setChave(crypto.randomUUID()); }
  return <PainelCadastro aberto titulo="Pesagem coletiva" onFechar={() => { if (!ocupado) onFechar(); }} rodape={<><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button><Button disabled={ocupado} onClick={() => { void salvar(); }}>{revisado ? "Confirmar todas as pesagens" : "Conferir pesos"}</Button></>}><ErrorBox erro={erro} /><div className="grid gap-4"><CampoFormulario id="coletiva-data" rotulo="Data">{(p) => <DatePicker {...p} value={data} max={hoje()} onChange={(v) => { setData(v); mudou(); }} />}</CampoFormulario><CampoFormulario id="coletiva-tipo" rotulo="Tipo">{(p) => <select {...p} value={tipo} onChange={(e) => { setTipo(e.target.value); mudou(); }} className={classeInput}>{["ROTINA", "ENTRADA", "DESMAMA", "SAIDA"].map((t) => <option key={t} value={t}>{{ ROTINA: "Rotina", ENTRADA: "Entrada", DESMAMA: "Desmama", SAIDA: "Saída" }[t]}</option>)}</select>}</CampoFormulario><CampoFormulario id="coletiva-origem" rotulo="Origem informada">{(p) => <select {...p} value={origem} onChange={(e) => { setOrigem(e.target.value); mudou(); }} className={classeInput}><option value="MANUAL">Manual</option><option value="BALANCA">Balança (sem conexão com equipamento)</option></select>}</CampoFormulario>{animais.map((a) => <CampoFormulario key={a.id} id={`peso-${a.id}`} rotulo={`${a.brinco}${a.nome ? ` · ${a.nome}` : ""} · peso (kg)`} obrigatorio>{(p) => <input {...p} required type="number" min="0.01" max="99999.99" step="0.01" className={classeInput} value={pesos[a.id] ?? ""} onChange={(e) => { setPesos((v) => ({ ...v, [a.id]: e.target.value })); mudou(); }} />}</CampoFormulario>)}{revisado && <p className="rounded-lg bg-green-50 p-3 text-sm">{animais.length} pesos conferidos. O servidor revalidará todos os animais e gravará o conjunto integralmente ou não gravará nenhum.</p>}</div></PainelCadastro>;
}
