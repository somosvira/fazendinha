import { RevisarToqueAptidao } from "./RevisarToqueAptidao";
import { ToqueAptidaoFormulario } from "./ToqueAptidaoFormulario";
import { AjudaCampo } from "../../../components/Dica";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { DatePicker } from "../../../components/DatePicker";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { Pill } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import type { PainelReprodutivo } from "./api";
import {
  anularDecisao,
  consultarElegibilidade,
  decidirElegibilidade,
  descreverMotivo,
  vincularPolitica,
  type ElegibilidadeNaData,
} from "./elegibilidade-api";

export function ElegibilidadeAnimal({ animalId, propriedadeId, painel, podeLancar, onMudou }: {
  animalId: string;
  propriedadeId: number;
  painel: PainelReprodutivo;
  podeLancar: boolean;
  onMudou?: () => void;
}) {
  const [data, setData] = useState(getHojeISO);
  // A consulta histórica nunca preenche a data de uma nova decisão.
  const [dataDecisao, setDataDecisao] = useState(getHojeISO);
  const [editando, setEditando] = useState(false);
  const [resultado, setResultado] = useState<ElegibilidadeNaData | null>(null);
  const [contextoDecisao, setContextoDecisao] = useState<ElegibilidadeNaData | null>(null);
  const [erroConsulta, setErroConsulta] = useState("");
  const [erroEdicao, setErroEdicao] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [carregandoDecisao, setCarregandoDecisao] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [confirmacao, setConfirmacao] = useState(false);
  const [origem, setOrigem] = useState("");
  const [tipo, setTipo] = useState<"LIBERAR" | "BLOQUEAR" | "RETOMAR_POLITICA">("LIBERAR");
  const [acaoLiberada, setAcaoLiberada] = useState<"PROTOCOLO" | "IA" | "TE">("PROTOCOLO");
  const [anteciparPev, setAnteciparPev] = useState(false);
  const [apta, setApta] = useState("");
  const [motivo, setMotivo] = useState("");
  const editorId = useId();
  const contexto = `${propriedadeId}:${animalId}`;
  const contextoAtual = useRef(contexto);
  contextoAtual.current = contexto;
  const chave = useRef<{ assinatura: string; chave: string } | null>(null);
  const idempotencia = (assinatura: string) => {
    if (chave.current?.assinatura !== assinatura) chave.current = { assinatura, chave: crypto.randomUUID() };
    return chave.current.chave;
  };
  useEffect(() => {
    setEditando(false); setData(getHojeISO()); setDataDecisao(getHojeISO());
    setOcupado(false); setConfirmacao(false); setAnteciparPev(false); setOrigem(""); setMotivo(""); setApta(""); setErroEdicao("");
  }, [animalId, propriedadeId]);
  useEffect(() => {
    let ativo = true;
    setResultado(null); setErroConsulta(""); setCarregando(!!data);
    if (data) void consultarElegibilidade(animalId, propriedadeId, data)
      .then(v => { if (ativo) setResultado(v); })
      .catch(e => { if (ativo) setErroConsulta(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [animalId, propriedadeId, data, atualizacao, painel]);
  useEffect(() => {
    let ativo = true;
    setContextoDecisao(null); setErroEdicao("");
    setCarregandoDecisao(editando && !!dataDecisao);
    if (editando && dataDecisao) void consultarElegibilidade(animalId, propriedadeId, dataDecisao)
      .then(v => { if (ativo) setContextoDecisao(v); })
      .catch(e => { if (ativo) setErroEdicao(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (ativo) setCarregandoDecisao(false); });
    return () => { ativo = false; };
  }, [animalId, propriedadeId, dataDecisao, editando, atualizacao, painel]);
  useEffect(() => { setConfirmacao(false); setOrigem(""); }, [animalId, propriedadeId, dataDecisao, painel]);
  const corresponde = (v: ElegibilidadeNaData | null, referencia: string) =>
    v?.animalId === animalId && v.propriedadeId === propriedadeId && v.dataReferencia === referencia ? v : null;
  const r = corresponde(resultado, data);
  const decisao = corresponde(contextoDecisao, dataDecisao);
  const iniciais = (painel.situacoesIniciais ?? []).filter(i => i.animalId === animalId && i.status === "VALIDO" && i.data.slice(0, 10) <= dataDecisao);
  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true); setErroEdicao("");
    try {
      await acao();
      if (contextoAtual.current === contexto) {
        setConfirmacao(false); setMotivo(""); setAtualizacao(v => v + 1); onMudou?.();
      }
    } catch (e) {
      if (contextoAtual.current === contexto) setErroEdicao(e instanceof Error ? e.message : "Não foi possível registrar a alteração.");
    } finally {
      if (contextoAtual.current === contexto) setOcupado(false);
    }
  }
  function vincular() {
    if (!decisao?.ciclo || !confirmacao) return;
    const fonte = decisao.ciclo.partoId ? { partoId: decisao.ciclo.partoId } : { situacaoInicialId: origem };
    if (!decisao.ciclo.partoId && !origem) { setErroEdicao("Selecione a situação inicial que comprova o início do acompanhamento."); return; }
    const input = { propriedadeId, animalId, ...fonte };
    void executar(() => vincularPolitica({ ...input, chave: idempotencia(JSON.stringify(input)) }));
  }
  function decidir() {
    if (!decisao?.vinculoCicloId) return;
    if (motivo.trim().length < 5) { setErroEdicao("Descreva o motivo com pelo menos 5 caracteres."); return; }
    if (tipo === "LIBERAR" && (!apta || apta < dataDecisao)) { setErroEdicao("Informe apta desde a data da decisão ou depois."); return; }
    if (tipo === "LIBERAR" && (decisao.aptidaoClinica?.estado !== "APTA" || !decisao.aptidaoClinica.exameId)) { setErroEdicao("Registre e confira um toque apto antes de liberar."); return; }
    if (tipo === "LIBERAR" && decisao.pevOriginalAte && apta < decisao.pevOriginalAte && !anteciparPev) { setErroEdicao("Confirme explicitamente a antecipação do PEV com base no exame apto."); return; }
    const input = { propriedadeId, vinculoCicloId: decisao.vinculoCicloId, data: dataDecisao, tipo,
      ...(tipo === "LIBERAR" ? { exameAptidaoId: decisao.aptidaoClinica!.exameId!, acaoLiberada, anteciparPev } : {}), aptaDesde: tipo === "LIBERAR" ? apta : null, motivo };
    void executar(() => decidirElegibilidade({ ...input, chave: idempotencia(JSON.stringify(input)) }));
  }
  return <div className="repro-aptidao space-y-3">
    <div className="repro-aptidao-resumo">
      <CalendarDays size={21} aria-hidden="true"/>
      <strong>{data === getHojeISO() ? "Hoje · " : "Em "}{data ? formatBRDateISO(data) : "data não informada"}</strong>
      {r && <span className="text-sm text-muted-foreground">Disponibilidade operacional</span>}
      {r && <Pill tone={r.estado === "ELEGIVEL" ? "green" : "amber"}>{r.estado === "ELEGIVEL" ? "Elegível" : r.estado === "NAO_ELEGIVEL" ? "Não elegível" : "Pendente de informação"}</Pill>}
      {podeLancar && <Button variant="outline" className="repro-aptidao-acao" aria-expanded={editando} aria-controls={editorId} onClick={() => setEditando(v => !v)}>Registrar decisão</Button>}
    </div>
    {carregando && <p role="status">Consultando aptidão…</p>}
    {erroConsulta && <p role="alert">{erroConsulta}</p>}
    {r && <div className="grid gap-4 border-y py-4 sm:grid-cols-3" aria-label="Avaliação e disponibilidade">
      <div><p className="text-sm text-muted-foreground">Aptidão clínica</p><strong>{r.aptidaoClinica?.estado === "APTA" ? "Apta" : r.aptidaoClinica?.estado === "NAO_APTA" ? "Não apta" : "Não determinada"}</strong><p className="text-sm">{r.aptidaoClinica?.data ? `Toque de ${formatBRDateISO(r.aptidaoClinica.data)}` : "Sem toque de aptidão comprovado."}</p></div>
      <div><p className="text-sm text-muted-foreground">Acompanhamento</p><strong>{r.acompanhamentoAptidao?.fila === "AGENDAMENTO" ? "Agendamento em visita" : r.acompanhamentoAptidao?.fila === "RETORNO" ? "Retorno de aptidão" : r.acompanhamentoAptidao?.fila === "APTIDAO" ? "Aptidão avaliada" : r.necessidadeAptidao?.estado === "AVALIACAO_DEVIDA" ? "Avaliação devida" : r.necessidadeAptidao?.estado === "PENDENCIA_DADOS" ? "Pendência de dados" : r.necessidadeAptidao?.estado === "CRITERIOS_NAO_ATINGIDOS" ? "Critérios ainda não atingidos" : "Agendamento manual"}</strong>{r.necessidadeAptidao?.politicaVersao && <p className="text-sm">Política de avaliação: versão {r.necessidadeAptidao.politicaVersao}</p>}{r.necessidadeAptidao?.devidaDesde && <p className="text-sm">Referência: {formatBRDateISO(r.necessidadeAptidao.devidaDesde)}</p>}</div>
      <div><p className="text-sm text-muted-foreground">PEV original</p><strong>{r.pevOriginalAte ? formatBRDateISO(r.pevOriginalAte) : "Não determinado"}</strong><p className="text-sm">A avaliação devida não libera protocolo nem IA/TE.</p></div>
    </div>}
    {r?.acompanhamentoAptidao?.visitasAbertas.map(v => <p key={v.id}><a className="underline" href={`/pecuaria/visitas/${v.id}`}>{v.nome}</a></p>)}
    {r?.necessidadeAptidao?.pendencias.map(p => <p key={p}>{descreverMotivo(p)}</p>)}
    {r?.aptidaoClinica?.retornoEm && <p>Retorno informado: {formatBRDateISO(r.aptidaoClinica.retornoEm)}</p>}
    {r && <div className="repro-aptidao-contexto">
      <p>Disponível desde: {r.aptaDesde ? formatBRDateISO(r.aptaDesde) : "Não informada"} · Política: {r.politicaVersao ? `versão ${r.politicaVersao}` : "Sem versão vinculada"}</p>
      {r.motivos.map(m => <p key={m}>{descreverMotivo(m)}</p>)}
      {r.alertas.map(m => <p key={m}>Atenção: {descreverMotivo(m)}</p>)}
    </div>}
    <label className="repro-aptidao-data">Consultar na data<DatePicker value={data} onChange={setData}/></label>
    {podeLancar && r?.aptidaoClinica?.exameId && <RevisarToqueAptidao key={`${contexto}:${r.aptidaoClinica.exameId}`} exameId={r.aptidaoClinica.exameId} propriedadeId={propriedadeId} onMudou={() => { setAtualizacao(v => v + 1); onMudou?.(); }}/>}
    {podeLancar && <ToqueAptidaoFormulario key={contexto} animalId={animalId} propriedadeId={propriedadeId} onMudou={() => { setAtualizacao(v => v + 1); onMudou?.(); }}/>}
    {podeLancar && <div id={editorId} hidden={!editando} className="repro-aptidao-editor space-y-3">
      <h3>Decisão individual <AjudaCampo rotulo="Ajuda sobre decisão individual" texto="Informe a data do registro. A consulta acima é independente; restrições, papel e situação gestacional continuam sendo considerados."/></h3>

      <label>Data da decisão<Input type="date" value={dataDecisao} disabled={ocupado} onChange={e => setDataDecisao(e.target.value)}/></label>
      {carregandoDecisao && <p role="status">Conferindo acompanhamento na data da decisão…</p>}
      {erroEdicao && <p role="alert">{erroEdicao}</p>}
      {decisao && !decisao.ciclo && <p>Não há parto ou situação inicial que comprove o início do acompanhamento nesta data.</p>}
      {decisao?.ciclo && !decisao.vinculoCicloId && <div className="space-y-3">
        <p>Associar a política vigente no início deste acompanhamento ({formatBRDateISO(decisao.ciclo.inicioCiclo)}). Esta ação preserva a versão aplicável; sem política naquela data, será necessária liberação individual.</p>
        {decisao.ciclo.partoId ? <p>Parto de origem comprovado: {decisao.ciclo.partoId}</p> : <label>Situação inicial que comprova o início do acompanhamento<SelectCampo value={origem} onValueChange={setOrigem} className="h-10 w-full rounded border bg-background px-3"><option value="">Selecione a evidência</option>{iniciais.map(i => <option key={i.id} value={i.id}>{formatBRDateISO(i.data)} · {i.situacao}</option>)}</SelectCampo></label>}
        <label className="flex gap-2"><Checkbox checked={confirmacao} onCheckedChange={valor => setConfirmacao(valor === true)}/>Revisei a origem e confirmo a associação deste acompanhamento.</label>
        <Button disabled={ocupado || !confirmacao || (!decisao.ciclo.partoId && !origem)} onClick={vincular}>Associar política ao acompanhamento</Button>
      </div>}
      {decisao?.vinculoCicloId && <>
        <label>Decisão<SelectCampo className="h-10 w-full rounded border bg-background px-3" value={tipo} onValueChange={valorSelecionado => setTipo(valorSelecionado as typeof tipo)}><option value="LIBERAR">Liberar desde uma data</option><option value="BLOQUEAR">Bloquear</option><option value="RETOMAR_POLITICA">Retomar regras da política</option></SelectCampo></label>
        {tipo === "LIBERAR" && <div className="space-y-3">
          {decisao.aptidaoClinica?.estado === "APTA" ? <p>Exame apto vinculado: {decisao.aptidaoClinica.exameId} · {decisao.aptidaoClinica.data && formatBRDateISO(decisao.aptidaoClinica.data)}</p> : <p role="status">É necessário toque de aptidão apto neste ciclo para registrar liberação.</p>}
          <label>Ação avaliada<SelectCampo value={acaoLiberada} onValueChange={v => setAcaoLiberada(v as typeof acaoLiberada)}><option value="PROTOCOLO">Iniciar protocolo reprodutivo</option><option value="IA">Registrar IA</option><option value="TE">Registrar TE</option></SelectCampo></label>
          <label>Apta desde<Input type="date" min={dataDecisao} value={apta} onChange={e => { setApta(e.target.value); setAnteciparPev(false); }}/></label>
          {decisao.pevOriginalAte && apta && apta < decisao.pevOriginalAte && <label className="flex gap-2"><Checkbox checked={anteciparPev} onCheckedChange={v => setAnteciparPev(v === true)}/>Solicitar antecipação do PEV com base neste exame apto. O prazo original permanece preservado.</label>}
        </div>}
        <label>Motivo<Input minLength={5} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)}/></label>
        <div className="flex flex-wrap gap-2"><Button disabled={ocupado || motivo.trim().length < 5 || !dataDecisao} onClick={decidir}>Confirmar decisão</Button>
          {decisao.decisaoId && <Button variant="outline" disabled={ocupado || motivo.trim().length < 5} onClick={() => {
            const id = decisao.decisaoId!; const input = { propriedadeId, motivo };
            void executar(() => anularDecisao(id, { ...input, chave: idempotencia(JSON.stringify({ id, ...input })) }));
          }}>Anular decisão vigente com motivo</Button>}
        </div>
      </>}
    </div>}
  </div>;
}
