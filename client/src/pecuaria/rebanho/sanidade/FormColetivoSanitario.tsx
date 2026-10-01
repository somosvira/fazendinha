import { useEffect, useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import type { AnimalResumo } from "../types";
import { listarServicos, reqSanidade, type ServicoSanitario } from "./api";
type Cadastro = { id: string; nome: string; versao?: number; publicadoEm?: string | null; ativo?: boolean };
export function FormColetivoSanitario({ tipo, animais, onFechar, onSalvo }: { tipo: "exame" | "protocolo"; animais: AnimalResumo[]; onFechar: () => void; onSalvo: () => void }) {
  const propriedadeId = animais[0]?.propriedade?.id;
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [cadastroId, setCadastroId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [data, setData] = useState(hoje());
  const [datas, setDatas] = useState<Record<string, string>>({});
  const [responsavel, setResponsavel] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { let vivo = true; if (!propriedadeId || animais.some((a) => a.propriedade?.id !== propriedadeId)) { setErro("Selecione animais do mesmo sítio."); setCarregando(false); return; } Promise.all([reqSanidade<Cadastro[]>(tipo === "exame" ? "/tipos-exame" : "/protocolos"), listarServicos(propriedadeId)]).then(([c, s]) => { if (vivo) { setCadastros(c.filter((v) => v.ativo !== false && (tipo === "exame" || v.publicadoEm))); setServicos(s); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [tipo, propriedadeId]);
  async function confirmar() {
    if (!propriedadeId || ocupado || !cadastroId || animais.some((a) => a.propriedade?.id !== propriedadeId)) return;
    if (!conferindo) { setDatas(Object.fromEntries(animais.map((a) => [a.id, data]))); setConferindo(true); setChave(crypto.randomUUID()); return; }
    setOcupado(true); setErro(null);
    try {
      const itens = animais.map((a) => ({ animalId: a.id, propriedadeId, operacaoServicoId: servicoId || undefined, ...(tipo === "exame" ? { tipoExameId: cadastroId, data: datas[a.id], responsavel: responsavel || undefined } : { protocoloId: cadastroId, inicio: datas[a.id] }) }));
      await reqSanidade(tipo === "exame" ? "/exames/coletivos" : "/execucoes/coletivas", { method: "POST", body: JSON.stringify({ chave, propriedadeId, itens }) }); onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <PainelCadastro aberto titulo={tipo === "exame" ? "Coleta coletiva de exames" : "Iniciar protocolos coletivamente"} onFechar={() => { if (!ocupado) onFechar(); }} rodape={<Button type="submit" form="coletivo-sanidade" disabled={ocupado || carregando || !cadastroId}>{conferindo ? "Confirmar conjunto" : "Conferir por animal"}</Button>}><form id="coletivo-sanidade" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void confirmar(); }}><ErrorBox erro={erro} />{carregando && <p>Carregando cadastros…</p>}<fieldset disabled={conferindo} className="grid gap-3"><label>{tipo === "exame" ? "Tipo de exame" : "Versão publicada"}<select required className={classeInput} value={cadastroId} onChange={(e) => setCadastroId(e.target.value)}><option value="">Selecione</option>{cadastros.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.versao ? ` · v${c.versao}` : ""}</option>)}</select></label><label>Data comum<DatePicker required value={data} onChange={setData} /></label><label>Serviço associado (opcional)<select className={classeInput} value={servicoId} onChange={(e) => setServicoId(e.target.value)}><option value="">Sem Serviço</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao ?? "Serviço"}</option>)}</select></label>{tipo === "exame" && <label>Responsável (opcional)<input className={classeInput} maxLength={160} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} /></label>}</fieldset>{conferindo && <><p className="text-sm">Revise a data de cada animal. Erro em uma linha impede todo o conjunto. {tipo === "exame" ? "Coletas aguardam resultado, que pode ser preenchido depois em Sanidade › Exames." : "O protocolo apenas agenda tarefas e não consome medicamentos."}</p>{animais.map((a) => <label key={a.id}>{a.brinco}<DatePicker required value={datas[a.id]} onChange={(v) => { setDatas((d) => ({ ...d, [a.id]: v })); setChave(crypto.randomUUID()); }} /></label>)}<Button secondary onClick={() => setConferindo(false)}>Voltar aos dados comuns</Button></>}</form></PainelCadastro>;
}
