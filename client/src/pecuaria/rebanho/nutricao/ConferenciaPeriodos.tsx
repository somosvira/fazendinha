import { formatarLitros } from "../leite/modelo";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { DatePicker } from "../../../components/DatePicker";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelecaoPartidas, conferirDistribuicaoPartidas, type DistribuicaoPartida } from "../../../estoque/SelecaoPartidas";
import { confirmarPeriodos, previaPeriodos, type CentroNutricional, type Previa } from "./api";
import { estimativaConferida, somarEstimativas } from "./conferencia.calc";
import { formatarDataBR } from "../lib/rotulos";
import { fmtMoneyExact } from "../../../components/charts";
import { navegarPara } from "../../../router";

type Escolha = { origensLeite: string[]; quantidade: string; motivo: string; modo: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativa: string; partidas: DistribuicaoPartida[] };
export function ConferenciaPeriodos({ loteId, propriedadeId, centros, onSalvo, onOcupado }: { loteId: string; propriedadeId: number; centros: CentroNutricional[]; onSalvo: () => Promise<void>; onOcupado?: (v: boolean) => void }) {
  const [inicio, setInicio] = useState(hoje().slice(0, 7) + "-01");
  const [fim, setFim] = useState(hoje());
  const [centroCustoId, setCentro] = useState("");
  const [previa, setPrevia] = useState<{ revisao: string; periodos: Previa[]; lacunas: Array<{ inicio: string; fim: string }> } | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  useEffect(() => { onOcupado?.(ocupado); }, [ocupado, onOcupado]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const chaveItem = (p: Previa, produtoId: string) => p.inicio.slice(0, 10) + ":" + produtoId;
  function mudar(k: string, patch: Partial<Escolha>) { setEscolhas((e) => ({ ...e, [k]: { ...e[k], ...patch } })); setChave(crypto.randomUUID()); }
  async function conferir() {
    if (enviando.current) return; enviando.current = true; setOcupado(true); setErro(null); setPrevia(null); setSalvo(false);
    try { const p = await previaPeriodos({ loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null }); setPrevia(p); setChave(crypto.randomUUID()); setEscolhas(Object.fromEntries(p.periodos.flatMap((p) => p.itens.map((i) => [chaveItem(p, i.produtoId), { origensLeite: i.leite?.origens.map(o => o.entradaId) ?? [], quantidade: i.quantidadePrevista, motivo: "", modo: "BAIXA_ESTOQUE", justificativa: "", partidas: [] }])))); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviando.current = false; setOcupado(false); }
  }
  const leiteSemConciliacao = previa?.periodos.some(p => !!p.ofertasBezerreiro?.length && p.itens.some(i => {
    const escolha = escolhas[chaveItem(p, i.produtoId)];
    return !!i.leite && (Number(escolha?.quantidade) !== 0 || !escolha?.motivo.trim());
  })) ?? false;
  async function confirmar() {
    if (!previa || enviando.current || previa.lacunas.length || !previa.periodos.length) return;
    enviando.current = true; setOcupado(true); setErro(null);
    try {
      const periodos = previa.periodos.map((p) => ({ inicio: p.inicio.slice(0, 10), fim: p.fim.slice(0, 10), itens: p.itens.map((i) => {
        const e = escolhas[chaveItem(p, i.produtoId)];
        if (i.leite && p.ofertasBezerreiro?.length && (Number(e.quantidade) !== 0 || !e.motivo.trim())) throw new Error(`${i.nome}: concilie as ofertas já registradas com quantidade zero e motivo antes de confirmar.`);
        if (!e.quantidade.trim() || !Number.isFinite(Number(e.quantidade)) || Number(e.quantidade) < 0) throw new Error(`${i.nome}: informe a quantidade, inclusive zero se confirmado.`);
        if (Number(e.quantidade) !== Number(i.quantidadePrevista) && !e.motivo.trim()) throw new Error(`${i.nome}: justifique a diferença da previsão.`);
        if (e.modo === "SEM_BAIXA_JUSTIFICADA" && !e.justificativa.trim()) throw new Error(`${i.nome}: justifique o consumo sem baixa.`);
        if (i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0) conferirDistribuicaoPartidas(e.partidas, Number(e.quantidade), true);
        return { ...(i.leite && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 ? { origensLeite: e.origensLeite } : {}), produtoId: i.produtoId, quantidadeConfirmada: Number(e.quantidade), motivoAjuste: e.motivo || undefined, modoEstoque: e.modo, justificativaSemBaixa: e.justificativa || undefined, ...(i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 ? { partidas: e.partidas.map((s) => ({ partidaId: s.partidaId!, quantidade: Number(s.quantidade), cienciaValidadeDesconhecida: s.cienciaValidadeDesconhecida })) } : {}) };
      }) }));
      await confirmarPeriodos({ chave, revisao: previa.revisao, loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null, periodos }); setPrevia(null); setSalvo(true); await onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviando.current = false; setOcupado(false); }
  }
  return <section className="nutricao-conferencia mt-4 grid gap-4">
    <ErrorBox erro={erro} />
    {salvo && <p role="status" className="text-sm font-medium">Fechamento salvo. Consulte os fechamentos para ver os detalhes e participantes.</p>}
    <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label>De<DatePicker value={inicio} onChange={(v) => { setInicio(v); setPrevia(null); }} /></label>
      <label>Até<DatePicker value={fim} onChange={(v) => { setFim(v); setPrevia(null); }} /></label>
      <label>Centro de custo<SelectCampo className={classeInput} value={centroCustoId} onValueChange={(valorSelecionado) => { setCentro(valorSelecionado); setPrevia(null); }}><option value="">Usar o centro do lote</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label>
      <div className="flex items-end"><Button disabled={ocupado} onClick={() => void conferir()}>Conferir período</Button></div>
    </fieldset>
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
        return <fieldset key={p.inicio} disabled={ocupado} className="grid gap-3 rounded-lg border border-border p-3">
          <legend className="px-1 font-semibold">{formatarDataBR(p.inicio)} – {formatarDataBR(p.fim)} · {p.dieta.nome} v{p.dieta.versao}</legend>
          <p>{p.animalDias} animal-dias · {p.participantes.length} animais · MS prevista conhecida {p.materiaSecaConhecidaKg} kg ({p.coberturaMateriaSecaCompleta ? "completa" : "cobertura incompleta"})</p>
          <p>MS conferida conhecida ≈ {somarEstimativas(valores.map((v) => v.ms), 3)} kg ({valores.every((v) => v.ms != null) ? "completa" : "cobertura incompleta"})</p>
          {mostrarValores && <p>Custo conferido estimado conhecido: {valores.some((v) => v.custo != null) ? `≈ ${fmtMoneyExact(Number(somarEstimativas(valores.map((v) => v.custo), 2)))}` : "não apurado"} ({valores.every((v) => v.custo != null) ? "completo" : "incompleto"}). Apurado na confirmação com a base de estoque.</p>}
          <div className="nutricao-participantes"><h3 className="text-sm font-semibold">Participantes</h3><ul>{p.participantes.map((a) => <li key={a.animalId}>{a.brinco}: {a.dias} dias</li>)}</ul></div>
          {!!p.ofertasBezerreiro?.length && <section aria-label="Leite já registrado no Bezerreiro" className="grid gap-2">
            <h3 className="text-sm font-semibold">Leite já registrado no Bezerreiro</h3>
            <ul className="grid gap-2">{p.ofertasBezerreiro.map(oferta => <li key={oferta.fornecimentoId} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{formatarDataBR(oferta.data)} · {formatarLitros(Number(oferta.quantidadeLitros))} já fornecidos</span>
              <Button secondary onClick={() => navegarPara(`/pecuaria/bezerreiro?${new URLSearchParams({aba:'alimentacao',propriedadeId:String(propriedadeId),data:oferta.data,...(oferta.animalIds[0]?{animalId:oferta.animalIds[0]}:{})})}`)}>Abrir no Bezerreiro</Button>
            </li>)}</ul>
          </section>}
          {p.itens.map((i, indice) => {
            const k = chaveItem(p, i.produtoId); const e = escolhas[k]; const v = valores[indice];
            return <div key={k} className="grid gap-2 border-t border-border pt-3">
              <strong>{i.nome}: previsto {i.quantidadePrevista} {i.unidade}</strong>
              <p className="text-sm">Saldo {i.saldo} {i.unidade}{!mostrarValores ? "" : ` · custo previsto ${i.custoPrevisto == null ? "não apurado" : fmtMoneyExact(Number(i.custoPrevisto))}`}</p>
              <p className="text-sm">MS prevista: {i.materiaSecaKg == null ? "não informada / unidade sem conversão para massa" : `${i.materiaSecaKg} kg`} · MS conferida: {v.ms == null ? "não apurada" : `≈ ${v.ms} kg`}</p>
              {mostrarValores && <p className="text-sm">Custo conferido estimado: {v.custo == null ? (e.modo === "SEM_BAIXA_JUSTIFICADA" ? "não apurado — sem baixa de estoque" : "não apurado — sem base de custo") : `≈ ${fmtMoneyExact(Number(v.custo))}`}</p>}
              {i.leite && !!p.ofertasBezerreiro?.length && <div className="grid gap-2">
                <p className="text-sm" title={p.orientacaoLeiteBezerreiro ?? undefined}>Concilie o leite já fornecido. Os demais ingredientes permanecem neste fechamento.</p>
                <div><Button secondary onClick={() => mudar(k, { quantidade: '0', motivo: 'Leite já registrado nas ofertas do Bezerreiro; sem novo fornecimento neste fechamento.' })}>Usar ofertas já registradas · zerar leite</Button></div>
              </div>}
              {i.leite && <fieldset className="grid gap-2"><legend className="font-semibold">Leite produzido para esta dieta</legend>
                <p className="text-sm">Previsto {formatarLitros(Number(i.leite.quantidadePrevistaLitros))} · disponível {formatarLitros(Number(i.leite.quantidadeDisponivelLitros))} · atendível {formatarLitros(Number(i.leite.quantidadeAtendivelLitros))}. Selecione as origens autorizadas; o fornecimento usa primeiro o não comercial e completa com o comercial.</p>
                {i.leite.origens.length === 0 && <p role="status">Sem origem disponível. Registre apenas os litros efetivamente fornecidos e justifique a diferença.</p>}
                {i.leite.origens.map(o => <label key={o.entradaId} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={e.origensLeite.includes(o.entradaId)} onChange={ev => mudar(k, { origensLeite: ev.target.checked ? [...e.origensLeite,o.entradaId] : e.origensLeite.filter(id => id !== o.entradaId) })} /><span>{o.produtoNome} · {o.natureza === "NAO_COMERCIAL" ? "Não comercial" : "Comercial"} · {formatarDataBR(o.data)} · {formatarLitros(Number(o.quantidadeDisponivelLitros))}</span></label>)}
                <p className="text-sm">A quantidade por animal será atribuída pelos dias no lote. Custo de produção e preço de referência podem ficar pendentes; os litros comprovados continuam registráveis.</p>
              </fieldset>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label>Quantidade conferida ({i.unidade})<input type="number" min="0" step="0.001" className={classeInput} value={e.quantidade} onChange={(ev) => mudar(k, { quantidade: ev.target.value })} /></label>
                <label>Origem<SelectCampo className={classeInput} value={e.modo} onValueChange={(valorSelecionado) => mudar(k, { modo: valorSelecionado as Escolha["modo"] })}><option value="BAIXA_ESTOQUE">Baixar estoque</option><option value="SEM_BAIXA_JUSTIFICADA">Sem baixa — justificar</option></SelectCampo></label>
              </div>
              {(Number(e.quantidade) !== Number(i.quantidadePrevista) || (i.leite && !!p.ofertasBezerreiro?.length)) && <label>Motivo da diferença<input className={classeInput} value={e.motivo} onChange={(ev) => mudar(k, { motivo: ev.target.value })} /></label>}
              {e.modo === "SEM_BAIXA_JUSTIFICADA" && <label>Justificativa sem baixa<textarea className={classeInput} value={e.justificativa} onChange={(ev) => mudar(k, { justificativa: ev.target.value })} /></label>}
              {i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 && <SelecaoPartidas compacto produtoId={i.produtoId} propriedadeId={propriedadeId} dataFato={p.fim.slice(0, 10)} quantidade={e.quantidade} unidade={i.unidade} saida valor={e.partidas} onChange={(s) => mudar(k, { partidas: s })} />}
            </div>;
          })}
        </fieldset>;
      })}
      <Button disabled={ocupado || !!previa.lacunas.length || !previa.periodos.length || leiteSemConciliacao} onClick={() => void confirmar()}>Confirmar conjunto conferido</Button>
    </>}
  </section>;
}
