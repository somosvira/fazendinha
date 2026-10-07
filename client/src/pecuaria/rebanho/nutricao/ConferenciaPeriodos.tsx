import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import { DatePicker } from "../../../components/DatePicker";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelecaoPartidas, conferirDistribuicaoPartidas, type DistribuicaoPartida } from "../../../estoque/SelecaoPartidas";
import { confirmarPeriodos, previaPeriodos, type CentroNutricional, type Previa } from "./api";
import { estimativaConferida, somarEstimativas } from "./conferencia.calc";
import { formatarDataBR } from "../lib/rotulos";
import { fmtMoneyExact } from "../../../components/charts";
import { ontemConsumo } from "./datasConsumo";

type Escolha = { quantidade: string; motivo: string; modo: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativa: string; partidas: DistribuicaoPartida[] };
class ErroConferencia extends Error {
  constructor(mensagem: string, public campo: string) { super(mensagem); }
}
type FalhaConferencia = { mensagem: string; campo?: string; acao: "conferir" | "confirmar" };
export function ConferenciaPeriodos({ loteId, propriedadeId, centros, onSalvo, diario = false, onOcupado }: { loteId: string; propriedadeId: number; centros: CentroNutricional[]; onSalvo: () => Promise<void>; diario?: boolean; onOcupado?: (ocupado: boolean) => void }) {
  const [inicio, setInicio] = useState(() => diario ? ontemConsumo() : ontemConsumo().slice(0, 7) + "-01");
  const [fim, setFim] = useState(ontemConsumo);
  const [centroCustoId, setCentro] = useState("");
  const [previa, setPrevia] = useState<{ revisao: string; periodos: Previa[]; lacunas: Array<{ inicio: string; fim: string }> } | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<FalhaConferencia | null>(null);
  const raiz = useRef<HTMLElement>(null);
  const prefixo = useId();
  const idCampo = (campo: string) => `${prefixo}-${campo}`;
  const [salvo, setSalvo] = useState(false);
  useEffect(() => { onOcupado?.(ocupado); return () => onOcupado?.(false); }, [ocupado, onOcupado]);
  useEffect(() => {
    if (!erro || ocupado) return;
    const alvo = erro.campo ? document.getElementById(`${prefixo}-${erro.campo}`) ?? raiz.current?.querySelector<HTMLElement>("input[aria-invalid='true'],select[aria-invalid='true'],textarea[aria-invalid='true'],button[aria-invalid='true']") ?? raiz.current?.querySelector<HTMLElement>("[aria-invalid='true']") : null;
    const foco = alvo ?? document.getElementById(`${prefixo}-resumo-${erro.acao}`);
    foco?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    foco?.focus({ preventScroll: true });
  }, [erro, ocupado, prefixo]);
  function falhar(e: unknown, acao: FalhaConferencia["acao"]) { setErro({ mensagem: e instanceof Error ? e.message : String(e), campo: e instanceof ErroConferencia ? e.campo : undefined, acao }); }
  function resumoErro(acao: FalhaConferencia["acao"]) {
    return erro?.acao === acao && <div id={`${prefixo}-resumo-${acao}`} role="alert" tabIndex={-1} className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 outline-none"><p className="font-semibold">{acao === "conferir" ? "Não foi possível conferir" : "Não foi possível confirmar"}</p><p>{erro.mensagem}</p><p>Os dados foram preservados. {erro.campo ? "Revise o campo indicado e tente novamente." : "Revise a conferência e tente novamente."}</p></div>;
  }
  function mensagemCampo(campo: string) { return erro?.campo === campo && <p id={`${idCampo(campo)}-erro`} className="text-sm text-red-700">{erro.mensagem}</p>; }
  function atributosErro(campo: string) { return { id: idCampo(campo), "aria-invalid": erro?.campo === campo || undefined, "aria-describedby": erro?.campo === campo ? `${idCampo(campo)}-erro` : undefined }; }
  const chaveItem = (p: Previa, produtoId: string) => p.inicio.slice(0, 10) + ":" + produtoId;
  function mudar(k: string, patch: Partial<Escolha>) { setEscolhas((e) => ({ ...e, [k]: { ...e[k], ...patch } })); setChave(crypto.randomUUID()); setErro(null); }
  async function conferir() {
    if (ocupado) return; setOcupado(true); setErro(null); setPrevia(null); setSalvo(false);
    try {
      if (!inicio) throw new ErroConferencia("Informe a data inicial do consumo.", "inicio");
      if (!fim || fim < inicio) throw new ErroConferencia("Informe uma data final igual ou posterior à inicial.", diario ? "inicio" : "fim");
      const p = await previaPeriodos({ loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null }); setPrevia(p); setChave(crypto.randomUUID()); setEscolhas(Object.fromEntries(p.periodos.flatMap((p) => p.itens.map((i) => [chaveItem(p, i.produtoId), { quantidade: i.quantidadePrevista, motivo: "", modo: "BAIXA_ESTOQUE", justificativa: "", partidas: [] }]))));
    } catch (e) { falhar(e, "conferir"); } finally { setOcupado(false); }
  }
  async function confirmar() {
    if (!previa || ocupado || previa.lacunas.length) return;
    setOcupado(true); setErro(null);
    try {
      const periodos = previa.periodos.map((p) => ({ inicio: p.inicio.slice(0, 10), fim: p.fim.slice(0, 10), itens: p.itens.map((i) => {
        const k = chaveItem(p, i.produtoId); const e = escolhas[k];
        if (!e.quantidade.trim() || !Number.isFinite(Number(e.quantidade)) || Number(e.quantidade) < 0) throw new ErroConferencia(`${i.nome}: informe a quantidade, inclusive zero se confirmado.`, `${k}.quantidade`);
        if (Number(e.quantidade) !== Number(i.quantidadePrevista) && !e.motivo.trim()) throw new ErroConferencia(`${i.nome}: justifique a diferença da previsão.`, `${k}.motivo`);
        if (e.modo === "SEM_BAIXA_JUSTIFICADA" && !e.justificativa.trim()) throw new ErroConferencia(`${i.nome}: justifique o consumo sem baixa.`, `${k}.justificativa`);
        if (i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0) {
          try { conferirDistribuicaoPartidas(e.partidas, Number(e.quantidade), true); }
          catch (falha) { const campo = falha instanceof Error && "campo" in falha && typeof falha.campo === "string" ? falha.campo : ""; throw new ErroConferencia(`${i.nome}: ${falha instanceof Error ? falha.message : String(falha)}`, `${k}.partidas${campo ? `.${campo}` : ""}`); }
        }
        return { produtoId: i.produtoId, quantidadeConfirmada: Number(e.quantidade), motivoAjuste: e.motivo || undefined, modoEstoque: e.modo, justificativaSemBaixa: e.justificativa || undefined, ...(i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 ? { partidas: e.partidas.map((s) => ({ partidaId: s.partidaId!, quantidade: Number(s.quantidade), cienciaValidadeDesconhecida: s.cienciaValidadeDesconhecida })) } : {}) };
      }) }));
      await confirmarPeriodos({ chave, revisao: previa.revisao, loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null, periodos }); setPrevia(null); setSalvo(true); await onSalvo();
    } catch (e) { falhar(e, "confirmar"); } finally { setOcupado(false); }
  }
  return <section ref={raiz} className="mt-4 grid gap-4">
    {salvo && <p role="status" className="text-sm font-medium">Consumo salvo. Consulte o histórico para ver os detalhes e participantes.</p>}
    <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {diario ? <label>Data do consumo<DatePicker {...atributosErro("inicio")} aria-label="Data do consumo" value={inicio} onChange={(v) => { setInicio(v); setFim(v); setPrevia(null); setErro(null); }} />{mensagemCampo("inicio")}</label> : <><label>De<DatePicker {...atributosErro("inicio")} aria-label="De" value={inicio} onChange={(v) => { setInicio(v); setPrevia(null); setErro(null); }} />{mensagemCampo("inicio")}</label>
      <label>Até<DatePicker {...atributosErro("fim")} aria-label="Até" value={fim} onChange={(v) => { setFim(v); setPrevia(null); setErro(null); }} />{mensagemCampo("fim")}</label></>}
      <label>Centro de custo<select className={classeInput} value={centroCustoId} onChange={(e) => { setCentro(e.target.value); setPrevia(null); }}><option value="">Usar o centro do lote</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <div className="flex items-end"><Button disabled={ocupado} onClick={() => void conferir()}>{diario ? "Conferir dia" : "Conferir período"}</Button></div>
    </fieldset>
    {resumoErro("conferir")}
    {previa && <>
      <p className="text-sm">A confirmação inclui {previa.periodos.length} fechamento(s), separados por mês e vigência. Consumo/custo por animal são atribuições por permanência.</p>
      {previa.lacunas.map((l) => <p key={l.inicio} className="rounded-lg bg-amber-50 p-3 text-sm">Sem dieta de {formatarDataBR(l.inicio)} a {formatarDataBR(l.fim)}. Corrija a vigência e confira novamente; o conjunto não pode ser confirmado.</p>)}
      {previa.periodos.map((p) => {
        const mostrarValores = p.verValores ?? p.itens.some((i) => i.custoPrevisto != null);
        const valores = p.itens.map((i) => {
          const e = escolhas[chaveItem(p, i.produtoId)];
          return {
            ms: estimativaConferida(i.materiaSecaKg, i.quantidadePrevista, e.quantidade, 3),
            custo: e.modo === "SEM_BAIXA_JUSTIFICADA" ? null : estimativaConferida(i.custoPrevisto, i.quantidadePrevista, e.quantidade, 2),
          };
        });
        const custoCompleto = valores.length > 0 && valores.every((v) => v.custo != null);
        const dias = (Date.parse(p.fim.slice(0, 10)) - Date.parse(p.inicio.slice(0, 10))) / 86400000 + 1;
        const custoConferido = Number(somarEstimativas(valores.map((v) => v.custo), 2));
        return <fieldset key={p.inicio} disabled={ocupado} className="grid gap-3 rounded-lg border border-border p-3">
          <legend className="px-1 font-semibold">{formatarDataBR(p.inicio)} – {formatarDataBR(p.fim)} · {p.dieta.nome} v{p.dieta.versao}</legend>
          <p>{p.animalDias} animal-dias · {p.participantes.length} animais · MS prevista conhecida {p.materiaSecaConhecidaKg} kg ({p.coberturaMateriaSecaCompleta ? "completa" : "cobertura incompleta"})</p>
          <p>MS conferida conhecida ≈ {somarEstimativas(valores.map((v) => v.ms), 3)} kg ({valores.every((v) => v.ms != null) ? "completa" : "cobertura incompleta"})</p>
          {mostrarValores && <p>Custo conferido estimado conhecido: {valores.some((v) => v.custo != null) ? `≈ ${fmtMoneyExact(Number(somarEstimativas(valores.map((v) => v.custo), 2)))}` : "não apurado"} ({valores.every((v) => v.custo != null) ? "completo" : "incompleto"}). Apurado na confirmação com a base de estoque.</p>}
          {mostrarValores && custoCompleto && dias > 0 && p.animalDias > 0 && <p>Custo estimado do lote/dia: ≈ {fmtMoneyExact(custoConferido / dias)} · por cabeça/dia: ≈ {fmtMoneyExact(custoConferido / p.animalDias)}. Estimativa por permanência, não ingestão individual.</p>}
          <details><summary>Conferir participantes</summary>{p.participantes.map((a) => <p key={a.animalId}>{a.brinco}: {a.dias} dias</p>)}</details>
          {p.itens.map((i, indice) => {
            const k = chaveItem(p, i.produtoId); const e = escolhas[k]; const v = valores[indice];
            return <div key={k} className="grid gap-2 border-t border-border pt-3">
              <strong>{i.nome}: previsto {i.quantidadePrevista} {i.unidade}</strong>
              <p className="text-sm">Saldo {i.saldo} {i.unidade}{!mostrarValores || e.modo === "SEM_BAIXA_JUSTIFICADA" ? "" : ` · custo previsto ${i.custoPrevisto == null ? "não apurado" : fmtMoneyExact(Number(i.custoPrevisto))}`}</p>
              <p className="text-sm">MS prevista: {i.materiaSecaKg == null ? "não informada / unidade sem conversão para massa" : `${i.materiaSecaKg} kg`} · MS conferida: {v.ms == null ? "não apurada" : `≈ ${v.ms} kg`}</p>
              {mostrarValores && <p className="text-sm">Custo conferido estimado: {v.custo == null ? (e.modo === "SEM_BAIXA_JUSTIFICADA" ? "não apurado — sem baixa de estoque" : "não apurado — sem base de custo") : `≈ ${fmtMoneyExact(Number(v.custo))}`}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Quantidade conferida ({i.unidade})<input {...atributosErro(`${k}.quantidade`)} aria-label={`Quantidade conferida (${i.unidade})`} type="number" min="0" step="0.001" className={classeInput} value={e.quantidade} onChange={(ev) => mudar(k, { quantidade: ev.target.value })} />{mensagemCampo(`${k}.quantidade`)}</label>
                <label>Origem<select className={classeInput} value={e.modo} onChange={(ev) => mudar(k, { modo: ev.target.value as Escolha["modo"] })}><option value="BAIXA_ESTOQUE">Baixar estoque</option><option value="SEM_BAIXA_JUSTIFICADA">Sem baixa — justificar</option></select></label>
              </div>
              {Number(e.quantidade) !== Number(i.quantidadePrevista) && <label>Motivo da diferença<input {...atributosErro(`${k}.motivo`)} aria-label="Motivo da diferença" maxLength={500} className={classeInput} value={e.motivo} onChange={(ev) => mudar(k, { motivo: ev.target.value })} />{mensagemCampo(`${k}.motivo`)}</label>}
              {e.modo === "SEM_BAIXA_JUSTIFICADA" && <label>Justificativa sem baixa<textarea {...atributosErro(`${k}.justificativa`)} aria-label="Justificativa sem baixa" maxLength={500} className={classeInput} value={e.justificativa} onChange={(ev) => mudar(k, { justificativa: ev.target.value })} />{mensagemCampo(`${k}.justificativa`)}</label>}
              {i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 && <SelecaoPartidas produtoId={i.produtoId} propriedadeId={propriedadeId} dataFato={p.fim.slice(0, 10)} quantidade={e.quantidade} unidade={i.unidade} saida valor={e.partidas} campo={`${k}.partidas`} erroValidacao={erro?.campo?.startsWith(`${k}.partidas`) ? { campo: erro.campo, mensagem: erro.mensagem } : undefined} onChange={(s) => mudar(k, { partidas: s })} />}
            </div>;
          })}
        </fieldset>;
      })}
      {resumoErro("confirmar")}
      <Button disabled={ocupado || !!previa.lacunas.length || !previa.periodos.length} onClick={() => void confirmar()}>Confirmar conjunto conferido</Button>
    </>}
  </section>;
}
