import { RevisaoPesoSecagem, revisaoPesoSecagemVazia, validarRevisaoPesoSecagem } from "./RevisaoPesoSecagem";
import { getHojeISO } from "../../../lib/hoje";
import { inputHorarioIatf } from "./CampoDataIatf";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { obterReproducao, reqV4, type PainelReprodutivo } from "./api";
import { CamposTriEstado, PostParto, camposPartoPayload, dadosPartoVazios, validarDadosParto } from "./PartoCampos";

export function CorrigirFato({ tipo, id, animalId, propriedadeId, gestacaoInicial, partoInicial, tipoPartoInicial, complementoInicial, onFechar, onSalvo }: {
  complementoInicial?: "escore" | "peso" | "retencao"; tipo: "parto" | "lactacao"; id: string; animalId: string; propriedadeId?: number | null; gestacaoInicial?: string | null; partoInicial?: string | null; tipoPartoInicial?: string; onFechar: () => void; onSalvo: () => void;
}) {
  const sitioDoFato = propriedadeId ?? getPropriedadeAtiva();
  const [revisaoSecagem, setRevisaoSecagem] = useState(revisaoPesoSecagemVazia);
  const [escoreRevisao, setEscoreRevisao] = useState("");
  const [desvincularPeso, setDesvincularPeso] = useState("");
  const [desvincularRp, setDesvincularRp] = useState("");
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [vinculo, setVinculo] = useState((tipo === "parto" ? gestacaoInicial : partoInicial) ?? "");
  const [dados, setDados] = useState(dadosPartoVazios);
  const inicial = useRef(dadosPartoVazios());
  const [inicio, setInicio] = useState(""); const [fim, setFim] = useState("");
  const [pesosCrias, setPesosCrias] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState(""); const [erro, setErro] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false);
  const emCurso = useRef(false);
  const envio = useRef<{ payload: string; chave: string } | null>(null);
  useEffect(() => {
    let ativo = true; setPainel(null); setRevisaoSecagem(revisaoPesoSecagemVazia());
    obterReproducao(animalId, sitioDoFato ?? undefined).then(p => {
      if (!ativo) return; setPainel(p);
      const fato = p.partos.find(f => f.id === id);
      if (tipo === "parto" && fato) {
        setVinculo(fato.gestacaoId ?? "");
        const horario = fato.ocorridoEm ? new Date(fato.ocorridoEm) : null;
        const tri = (v: boolean | null | undefined) => v == null ? "" : v ? "SIM" : "NAO";
        const d = { ...dadosPartoVazios(), desfecho: fato.desfecho ?? (fato.tipo === "ABORTO" ? "ABORTO" : "NASCIMENTO") as "ABORTO" | "NASCIMENTO", hora: horario ? inputHorarioIatf(horario.toISOString()).slice(11,16) : "", horarioEstimado: fato.horarioEstimado ?? false, induzido: tri(fato.induzido), dificuldade: tri(fato.dificuldade), retencaoPlacenta: tri(fato.retencaoPlacenta), assistenciaDescricao: fato.assistenciaDescricao ?? "", responsavel: fato.responsavel ?? "", observacao: fato.observacao ?? "" };
        inicial.current = d; setDados({ ...d, ...(complementoInicial === "escore" ? { escoreAtivo: true, escoreData: getHojeISO() } : {}), ...(complementoInicial === "peso" ? { pesoAcao: "REGISTRAR", pesoData: getHojeISO() } : {}) });
      }
      const l = p.lactacoes?.find(l => l.id === id); if (tipo === "lactacao" && l) { setVinculo(l.partoId ?? ""); setInicio(l.inicio.slice(0, 10)); setFim(l.encerradaEm?.slice(0, 10) ?? ""); }
    }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [animalId, id, tipo, sitioDoFato, complementoInicial]);
  const fato = painel?.partos.find(f => f.id === id);
  async function salvar() {
    if (emCurso.current) return;
    const prop = sitioDoFato; if (!prop) { setErro("Selecione o sítio do fato."); return; }
    if (motivo.trim().length < 5) { setErro("Informe um motivo com pelo menos 5 caracteres."); return; }
    if (escoreRevisao.startsWith("SUBSTITUIR:") && !dados.escoreAtivo) { setErro("Preencha o escore substituto ou conserve o exame existente."); return; }
    const erroParto = tipo === "parto" ? validarDadosParto(dados, inicial.current) : null; if (erroParto) { setErro(erroParto); return; }
    if (tipo === "parto" && !fato?.versao) { setErro("Reabra o parto para carregar sua versão antes de corrigir."); return; }
    if (tipo === "lactacao" && (!inicio || inicio > getHojeISO() || (fim && (fim < inicio || fim > getHojeISO())))) { setErro("Informe datas válidas para o período da lactação."); return; }
    const revisaoPeso = tipo === "lactacao" ? validarRevisaoPesoSecagem(painel?.lactacoes?.find(l => l.id === id), fim, revisaoSecagem, motivo.trim(), prop) : {};
    if (revisaoPeso.erro) { setErro(revisaoPeso.erro); return; }
    const atual = camposPartoPayload(dados, fato?.data.slice(0, 10) ?? "");
    const anterior = camposPartoPayload(inicial.current, fato?.data.slice(0, 10) ?? "");
    const camposAlterados = Object.fromEntries(Object.entries(atual).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(anterior[k as keyof typeof anterior])));
    if (Object.entries(pesosCrias).some(([criaId,peso]) => fato?.crias?.find(c => c.id === criaId)?.animalId && !(Number(peso) > 0))) {
      setErro("Informe um peso positivo para corrigir a pesagem da cria viva."); return;
    }
    const alteracoesPesos = Object.entries(pesosCrias).map(([criaId, peso]) => {
      const cria = fato?.crias?.find(c => c.id === criaId);
      if (!cria?.animalId) return { criaId, pesoKg: peso ? Number(peso) : null };
      const vinculoPeso = fato?.vinculosPesagem?.find(v => v.criaId === criaId && !v.revogadoEm);
      return { criaId, peso: vinculoPeso
        ? { acao: "CORRIGIR", vinculoId: vinculoPeso.id, data: fato!.data.slice(0, 10), pesoKg: Number(peso) }
        : { acao: "REGISTRAR", data: fato!.data.slice(0, 10), pesoKg: Number(peso) } };
    });
    const payload = { propriedadeId: prop, motivo, ...(tipo === "parto" ? { ...camposAlterados, ...(escoreRevisao.startsWith("ANULAR:") ? { escoreMatriz: { acao: "ANULAR", exameId: escoreRevisao.slice(7), motivo } } : escoreRevisao.startsWith("SUBSTITUIR:") && atual.escoreMatriz ? { escoreMatriz: { ...atual.escoreMatriz, acao: "SUBSTITUIR", exameId: escoreRevisao.slice(11), motivo } } : {}), ...(desvincularPeso ? { pesoMatriz: { acao: "DESVINCULAR", vinculoId: desvincularPeso, motivo } } : {}), ...(desvincularRp ? { ocorrenciaRetencao: { acao: "DESVINCULAR", ocorrenciaId: desvincularRp, motivo } } : {}), gestacaoId: vinculo || null, versaoEsperada: fato!.versao, pesosCrias: alteracoesPesos } : { ...(revisaoPeso.pesoSecagem ? { pesoSecagem: revisaoPeso.pesoSecagem } : {}), partoId: vinculo || null, versaoEsperada: painel?.lactacoes?.find(l => l.id === id)?.versao, ...(inicio ? { inicio } : {}), ...(painel?.lactacoes?.some(l => l.id === id) ? { encerradaEm: fim || null } : {}) }) };
    const serializado = JSON.stringify(payload); if (envio.current?.payload !== serializado) envio.current = { payload: serializado, chave: crypto.randomUUID() };
    emCurso.current = true; setOcupado(true); setErro(null);
    try { await reqV4(`/reproducao/${tipo === "parto" ? "partos" : "lactacoes"}/${id}/correcao`, { ...payload, chave: envio.current.chave }, "POST", prop); onSalvo(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { emCurso.current = false; setOcupado(false); }
  }
  return <PainelCadastro aberto titulo={tipo === "parto" ? "Corrigir / completar parto" : "Corrigir lactação"} onFechar={onFechar} bloqueado={ocupado} rodape={<><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button><Button type="submit" form="corrigir-fato-v4" disabled={ocupado || !painel}>{ocupado ? "Salvando…" : "Salvar correção"}</Button></>}>
    <form id="corrigir-fato-v4" noValidate={tipo === "lactacao"} className="grid gap-4" onSubmit={e => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} /><p className="text-sm">A correção conserva o histórico, os cadastros e a filiação das crias. Desvincular a lactação preserva seu período físico.</p>
      {tipo === "parto" && <><label className="grid gap-1 text-sm">Desfecho<select className={classeInput} value={dados.desfecho} onChange={e => setDados({ ...dados, desfecho: e.target.value as typeof dados.desfecho })}><option value="NASCIMENTO">Nascimento</option><option value="ABORTO">Aborto</option></select></label><p className="text-sm text-ink-3">Classificação histórica: {fato?.tipo ?? tipoPartoInicial ?? "Não informada"}</p><label className="grid gap-1 text-sm">Hora (opcional)<input type="time" className={classeInput} value={dados.hora} onChange={e => setDados({ ...dados, hora: e.target.value, horarioEstimado: !!e.target.value && dados.horarioEstimado })} /></label><label className="text-sm"><input type="checkbox" disabled={!dados.hora} checked={dados.horarioEstimado} onChange={e => setDados({ ...dados, horarioEstimado: e.target.checked })} /> Horário estimado</label><CamposTriEstado rotulo="Parto induzido" valor={dados.induzido} onChange={v => setDados({ ...dados, induzido: v })} /><CamposTriEstado rotulo="Dificuldade no parto" valor={dados.dificuldade} onChange={v => setDados({ ...dados, dificuldade: v })} /><label className="grid gap-1 text-sm">Assistência (opcional)<textarea className={classeInput} value={dados.assistenciaDescricao} maxLength={1000} onChange={e => setDados({ ...dados, assistenciaDescricao: e.target.value })} /></label><label className="grid gap-1 text-sm">Responsável pelo parto (opcional)<input className={classeInput} value={dados.responsavel} maxLength={160} onChange={e => setDados({ ...dados, responsavel: e.target.value })} /></label><label className="grid gap-1 text-sm">Observação<textarea className={classeInput} value={dados.observacao} maxLength={1000} onChange={e => setDados({ ...dados, observacao: e.target.value })} /></label>{fato?.examesPosParto?.some(e => e.status === "VALIDO") && <label className="grid gap-1 text-sm">Revisão do escore corporal<select className={classeInput} value={escoreRevisao} onChange={e => {
        const valor = e.target.value; setEscoreRevisao(valor);
        const exame = fato.examesPosParto?.find(x => x.id === valor.split(":")[1]);
        if (valor.startsWith("SUBSTITUIR:") && exame) { const resultado = (campo: string) => String(exame.resultados.find(r => r.campo === campo)?.valor ?? ""); setDados({ ...dados, escoreAtivo: true, escoreData: exame.data.slice(0, 10), escoreValor: resultado("ESCORE"), escalaMin: resultado("ESCALA_MIN"), escalaMax: resultado("ESCALA_MAX"), escalaDescricao: resultado("ESCALA_DESCRICAO") }); }
        else if (valor.startsWith("ANULAR:")) setDados({ ...dados, escoreAtivo: false });
      }}><option value="">Conservar escores existentes</option>{fato.examesPosParto.filter(x => x.status === "VALIDO").flatMap(x => [<option key={`s${x.id}`} value={`SUBSTITUIR:${x.id}`}>Substituir escore de {x.data.slice(0, 10)}</option>, <option key={`a${x.id}`} value={`ANULAR:${x.id}`}>Anular escore de {x.data.slice(0, 10)}</option>])}</select></label>}<PostParto valor={dados} onChange={setDados} animalId={animalId} propriedadeId={sitioDoFato ?? undefined} />{fato?.vinculosPesagem?.filter(v => v.sujeito === "MATRIZ" && !v.revogadoEm).map(v => <label key={v.id} className="text-sm"><input type="checkbox" checked={desvincularPeso === v.id} onChange={e => setDesvincularPeso(e.target.checked ? v.id : "")} /> Desvincular peso da matriz: {v.pesagem.pesoKg} kg em {v.pesagem.data.slice(0, 10)} (a pesagem é preservada)</label>)}{fato?.ocorrenciasRetencaoPlacenta?.map(o => <label key={o.id} className="text-sm"><input type="checkbox" checked={desvincularRp === o.id} onChange={e => setDesvincularRp(e.target.checked ? o.id : "")} /> Desvincular ocorrência: {o.doenca.nome} (a ocorrência é preservada)</label>)}{fato?.crias?.map((c, i) => c.id && <label key={c.id} className="grid gap-1 text-sm">Peso da cria {i + 1} (kg)<input className={classeInput} type="number" min="0.001" max="99999" step="any" value={pesosCrias[c.id] ?? fato.vinculosPesagem?.find(v => v.criaId === c.id && !v.revogadoEm)?.pesagem.pesoKg ?? c.pesoKg ?? c.filiacaoSnapshot?.pesoKg ?? ""} onChange={e => setPesosCrias({ ...pesosCrias, [c.id!]: e.target.value })} /></label>)}</>}
      {tipo === "lactacao" && <><label className="grid gap-1 text-sm">Início da lactação<input className={classeInput} type="date" required value={inicio} onChange={e => setInicio(e.target.value)} /></label><label className="grid gap-1 text-sm">Encerramento (opcional)<input className={classeInput} type="date" min={inicio} value={fim} onChange={e => { setFim(e.target.value); setRevisaoSecagem(v => ({ ...v, cienciaReabertura: false })); }} /></label><p className="text-sm text-ink-3">O início é D0. O encerramento comprova a secagem; campo vazio mantém a lactação aberta.</p></>}
      {tipo === "lactacao" && painel?.lactacoes?.find(l => l.id === id) && <RevisaoPesoSecagem lactacao={painel.lactacoes.find(l => l.id === id)!} fim={fim} valor={revisaoSecagem} onChange={setRevisaoSecagem} propriedadeId={sitioDoFato ?? undefined} />}
      <label className="grid gap-1 text-sm">{tipo === "parto" ? "Gestação vinculada" : "Parto vinculado"}<select className={classeInput} value={vinculo} onChange={e => setVinculo(e.target.value)}><option value="">Sem vínculo · desvincular</option>{tipo === "parto" ? (painel?.gestacoes ?? []).filter(g => g.status === "VALIDO").map(g => <option key={g.id} value={g.id}>Gestação confirmada em {g.confirmadaEm?.slice(0, 10) ?? g.id.slice(0, 8)}</option>) : (painel?.partos ?? []).filter(p => p.status !== "ANULADO").map(p => <option key={p.id} value={p.id}>{p.data.slice(0, 10)} · {p.tipo}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Motivo da correção<textarea className={classeInput} required minLength={5} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
    </form>
  </PainelCadastro>;
}
