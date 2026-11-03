import { CalendarPlus } from "lucide-react";
import { AjudaCampo } from "../../../components/Dica";
import { SeletorVersaoProtocolo } from "./SeletorVersaoProtocolo";
import { Paginacao } from "../ui";
import { horarioIatf } from "../reproducao/CampoDataIatf";
import { useRef, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { reqProtocolo } from "./api";
import { CampoDataIatf, dataHoraISO } from "../reproducao/CampoDataIatf";
export function FormParticipacaoIndividual({ animalId, propriedadeId, onFechar, onSalvo }: { animalId: string; propriedadeId: number; onFechar: () => void; onSalvo: (id: string) => void }) {
  const [protocoloId, setProtocoloId] = useState("");
  const [inicio, setInicio] = useState("");
  const [ciencia, setCiencia] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sobreposicao, setSobreposicao] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [previa, setPrevia] = useState<{ itens: Array<{ id: string; nome: string; previstaPara: string | null; precisaoTemporal: "DIA" | "HORA" }>; total: number; pagina: number; porPagina: number; avisos: string[] } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const chave = useRef(crypto.randomUUID());
  const trava = useRef(false);

  function editar() { chave.current = crypto.randomUUID(); setPrevia(null); }
  async function salvar(pagina = 1) { if (trava.current) return; trava.current = true; setOcupado(true); setErro(null); try { const body = { tipo: "REPRODUTIVO", chave: chave.current, animalId, propriedadeId, protocoloId, inicioReferencia: dataHoraISO(inicio), cienciaSanitaria: ciencia, ...(sobreposicao ? { confirmarSobreposicao: true, justificativaSobreposicao: motivo.trim() } : {}) }; if (!previa || pagina !== previa.pagina) { setPrevia(await reqProtocolo("/participacoes/previa", propriedadeId, { ...body, pagina, porPagina: 10 })); return; } const p = await reqProtocolo<{ id: string }>("/participacoes", propriedadeId, body); onSalvo(p.id); } catch(e) { setErro(e instanceof Error ? e.message : String(e)); } finally { trava.current = false; setOcupado(false); } }
  return <PainelCadastro icon={CalendarPlus} aberto titulo="Iniciar protocolo individual" onFechar={onFechar} rodape={<><ErrorBox erro={erro} /><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button><Button form="participacao-individual" type="submit" disabled={ocupado}>{previa ? "Confirmar participação" : "Conferir calendário"}</Button></>}><form id="participacao-individual" className="grid gap-4" onSubmit={e => { e.preventDefault(); void salvar(previa?.pagina ?? 1); }}><SeletorVersaoProtocolo tipo="REPRODUTIVO" valor={protocoloId} propriedadeId={propriedadeId} onChange={id => { editar(); setProtocoloId(id); }} /><CampoDataIatf rotulo="Início previsto" valor={inicio} onChange={v => { editar(); setInicio(v); }} /><label className="flex gap-2"><input required type="checkbox" checked={ciencia} onChange={e => { editar(); setCiencia(e.target.checked); }} />Conferi o contexto sanitário e reprodutivo deste animal.</label><details><summary>Sobreposição ou reentrada</summary><label className="flex gap-2"><input type="checkbox" checked={sobreposicao} onChange={e => { editar(); setSobreposicao(e.target.checked); }} />Confirmo iniciar outra participação com protocolo pendente.</label>{sobreposicao && <label>Justificativa da sobreposição<textarea required minLength={5} maxLength={1000} className={classeInput} value={motivo} onChange={e => { editar(); setMotivo(e.target.value); }} /></label>}</details>{previa && <section className="grid gap-3" aria-label="Calendário da participação individual"><h3 className="font-semibold">Calendário previsto <AjudaCampo rotulo="Ajuda sobre participação individual" texto="O planejamento pertence a este animal. O início efetivo será registrado pela primeira execução."/></h3>{previa.avisos.map(a => <p key={a} className="text-sm">{a}</p>)}{previa.itens.map(e => <p key={e.id}><strong>{e.nome}</strong> · {e.previstaPara ? horarioIatf(e.previstaPara, e.precisaoTemporal) : "Previsão a definir: hora da referência não informada"}</p>)}{previa.total > 10 && <Paginacao paginaAtual={previa.pagina} totalPaginas={Math.ceil(previa.total / 10)} totalItens={previa.total} itensPorPagina={10} onPaginaChange={p => void salvar(p)} rotulo="etapas previstas" idSelect="previa-individual-etapas" />}</section>}</form></PainelCadastro>;
}
