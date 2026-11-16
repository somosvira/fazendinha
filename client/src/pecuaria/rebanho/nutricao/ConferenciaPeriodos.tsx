import { formatarLitros } from "../leite/modelo";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { useEffect, useRef, useState } from "react";
import { Package } from "lucide-react";
import { createPortal } from "react-dom";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { DatePicker } from "../../../components/DatePicker";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelecaoPartidas, conferirDistribuicaoPartidas, type DistribuicaoPartida } from "../../../estoque/SelecaoPartidas";
import { confirmarPeriodos, previaPeriodos, type CentroNutricional, type Previa } from "./api";
import { estimativaConferida, somarEstimativas } from "./conferencia.calc";
import { formatarDataBR } from "../lib/rotulos";
import { fmtMoneyExact } from "../../../components/charts";
import { navegarPara } from "../../../router";
import { quantidadeNutricional, un } from "./quantidades";

const numero = (valor: string | number) => quantidadeNutricional(String(valor));
/** Acima desta diferença do previsto, o percentual aparece em destaque, como nos fechamentos para revisar. */
const LIMITE_DIFERENCA = 0.2;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const diasEntre = (inicio: string, fim: string) => Math.round((Date.parse(fim.slice(0, 10)) - Date.parse(inicio.slice(0, 10))) / 864e5) + 1;

/** A parte está pronta quando a quantidade, as justificativas e o lote de estoque estão informados. */
function itemPronto(i: Previa["itens"][number], e: Escolha | undefined) {
  if (!e || !e.quantidade.trim() || !Number.isFinite(Number(e.quantidade)) || Number(e.quantidade) < 0) return false;
  if (Number(e.quantidade) !== Number(i.quantidadePrevista) && !e.motivo.trim()) return false;
  if (e.modo === "SEM_BAIXA_JUSTIFICADA" && !e.justificativa.trim()) return false;
  return !(i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 && !e.partidas[0]?.partidaId);
}

/** Faixa do conjunto: período, dias, animais e as partes (uma por mês e vigência), cada uma com sua situação. */
function ResumoConjunto({ previa, pronto }: { previa: { periodos: Previa[] }; pronto: (p: Previa) => boolean }) {
  const { periodos } = previa;
  const inicio = periodos[0].inicio, fim = periodos[periodos.length - 1].fim;
  const dias = periodos.reduce((n, p) => n + diasEntre(p.inicio, p.fim), 0);
  const animais = Math.max(...periodos.map(p => p.participantes.length));
  return <div className="conferencia-resumo">
    <dl className="conferencia-faixa">
      <div><dt>Período</dt><dd>{formatarDataBR(inicio).slice(0, 5)} a {formatarDataBR(fim).slice(0, 5)}</dd></div>
      <div><dt>Dias</dt><dd>{dias}</dd></div>
      <div><dt>Animais</dt><dd>{animais}</dd></div>
      <div><dt>Fechamentos</dt><dd>{periodos.length}</dd></div>
    </dl>
    {periodos.length > 1 && <ul className="conferencia-partes" aria-label="Fechamentos deste conjunto">{periodos.map(p => {
      const ok = pronto(p);
      return <li key={p.inicio}><a href={`#conferencia-${p.inicio.slice(0, 10)}`} onClick={ev => { ev.preventDefault(); document.getElementById(`conferencia-${p.inicio.slice(0, 10)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
        <span><strong>{MESES[Number(p.inicio.slice(5, 7)) - 1][0].toUpperCase() + MESES[Number(p.inicio.slice(5, 7)) - 1].slice(1)}</strong><small>{p.inicio.slice(8, 10)} a {p.fim.slice(8, 10)} · {diasEntre(p.inicio, p.fim)} dias</small></span>
        <span className="conferencia-parte-situacao" data-pronta={ok || undefined}>{ok ? "Pronto" : "A conferir"}</span>
      </a></li>;
    })}</ul>}
  </div>;
}

type Escolha = { origensLeite: string[]; quantidade: string; motivo: string; modo: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativa: string; partidas: DistribuicaoPartida[] };
/** Com `acoes`, o passo atual (conferir ou confirmar) vai para o rodapé do painel que hospeda a conferência. */
export function ConferenciaPeriodos({ loteId, propriedadeId, centros, onSalvo, onOcupado, acoes, inicial }: { loteId: string; propriedadeId: number; centros: CentroNutricional[]; onSalvo: () => Promise<void>; onOcupado?: (v: boolean) => void; acoes?: HTMLElement | null; inicial?: { inicio: string; fim: string } }) {
  // Sem sugestão, o intervalo vai do início do mês até ontem; com ela, começa no dia seguinte ao último fechamento.
  const [inicio, setInicio] = useState(inicial?.inicio ?? hoje().slice(0, 7) + "-01");
  const [fim, setFim] = useState(inicial?.fim ?? hoje());
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
  const botaoConferir = <Button disabled={ocupado} onClick={() => void conferir()}>Conferir período</Button>;
  const botaoConfirmar = previa && <Button disabled={ocupado || !!previa.lacunas.length || !previa.periodos.length || leiteSemConciliacao} onClick={() => void confirmar()}>Confirmar conjunto conferido</Button>;
  return <section className="nutricao-conferencia mt-4 grid gap-4">
    <ErrorBox erro={erro} />
    {salvo && <p role="status" className="text-sm font-medium">Fechamento salvo. Consulte os fechamentos para ver os detalhes e participantes.</p>}
    <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label>De<DatePicker className="mt-1.5" value={inicio} onChange={(v) => { setInicio(v); setPrevia(null); }} /></label>
      <label>Até<DatePicker className="mt-1.5" value={fim} onChange={(v) => { setFim(v); setPrevia(null); }} /></label>
      <label>Centro de custo<SelectCampo className={classeInput} value={centroCustoId} onValueChange={(valorSelecionado) => { setCentro(valorSelecionado); setPrevia(null); }}><option value="">Usar o centro do lote</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label>
      {!acoes && <div className="flex items-end">{botaoConferir}</div>}
    </fieldset>
    {previa && <>
      {previa.periodos.length > 0 && <ResumoConjunto previa={previa} pronto={p => p.itens.every(i => itemPronto(i, escolhas[chaveItem(p, i.produtoId)]))} />}
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
        return <fieldset key={p.inicio} id={`conferencia-${p.inicio.slice(0, 10)}`} disabled={ocupado} className="conferencia-parte">
          <legend className="sr-only">{formatarDataBR(p.inicio)} a {formatarDataBR(p.fim)} · {p.dieta.nome} v{p.dieta.versao}</legend>
          <header className="conferencia-parte-cabecalho" aria-hidden><h3>{formatarDataBR(p.inicio).slice(0, 5)} a {formatarDataBR(p.fim)} · {p.dieta.nome} v{p.dieta.versao}</h3><span>{p.participantes.length} {p.participantes.length === 1 ? "animal" : "animais"} · {numero(p.animalDias)} animal-dias</span></header>
          {!!p.ofertasBezerreiro?.length && <section aria-label="Leite já registrado no Bezerreiro" className="conferencia-bezerreiro">
            <h3 className="text-sm font-semibold">Leite já registrado no Bezerreiro</h3>
            <ul className="grid gap-2">{p.ofertasBezerreiro.map(oferta => <li key={oferta.fornecimentoId} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{formatarDataBR(oferta.data)} · {formatarLitros(Number(oferta.quantidadeLitros))} já fornecidos</span>
              <Button secondary onClick={() => navegarPara(`/pecuaria/bezerreiro?${new URLSearchParams({aba:'alimentacao',propriedadeId:String(propriedadeId),data:oferta.data,...(oferta.animalIds[0]?{animalId:oferta.animalIds[0]}:{})})}`)}>Abrir no Bezerreiro</Button>
            </li>)}</ul>
          </section>}
          <div className="nutricao-conferencia-cabecalho" aria-hidden><span>Ingrediente</span><span>Previsto</span><span>Conferido</span><span>Diferença</span></div>
          {p.itens.map((i, indice) => {
            const k = chaveItem(p, i.produtoId); const e = escolhas[k]; const v = valores[indice];
            const insuficiente = e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > Number(i.saldo);
            const previsto = Number(i.quantidadePrevista), conferido = Number(e.quantidade);
            const diferenca = e.quantidade.trim() && Number.isFinite(conferido) ? (previsto ? (conferido - previsto) / previsto : conferido ? 1 : 0) : null;
            const escolhido = !!e.partidas[0]?.partidaId;
            return <div key={k} className="nutricao-conferencia-item">
              <div className="nutricao-conferencia-linha">
                <div className="nutricao-conferencia-nome"><strong>{i.nome}</strong>
                  <div className="conferencia-estoque"><Package size={14} aria-hidden /><SelectCampo aria-label={`Origem de ${i.nome}`} className="conferencia-estoque-modo" value={e.modo} onValueChange={(valorSelecionado) => mudar(k, { modo: valorSelecionado as Escolha["modo"] })}><option value="BAIXA_ESTOQUE">Baixa do estoque</option><option value="SEM_BAIXA_JUSTIFICADA">Sem baixa — justificar</option></SelectCampo>
                    <span className={insuficiente ? "nutricao-alerta-texto" : undefined}>saldo {numero(i.saldo)} {un(i.unidade)}{insuficiente && " · insuficiente"}{mostrarValores && v.custo != null && ` · ${fmtMoneyExact(Number(v.custo))}`}</span></div></div>
                <div className="nutricao-conferencia-previsto"><span className="nutricao-rotulo-movel">Previsto</span>{numero(i.quantidadePrevista)} {un(i.unidade)}</div>
                <label className="nutricao-conferencia-campo"><span className="nutricao-rotulo-movel">Conferido ({un(i.unidade)})</span><input aria-label={`Quantidade conferida de ${i.nome} (${un(i.unidade)})`} type="number" min="0" step="0.001" className={classeInput} value={e.quantidade} onChange={(ev) => mudar(k, { quantidade: ev.target.value })} /></label>
                <div className="conferencia-diferenca" data-atencao={diferenca != null && Math.abs(diferenca) > LIMITE_DIFERENCA || undefined}><span className="nutricao-rotulo-movel">Diferença</span>{diferenca == null ? "—" : `${diferenca > 0 ? "+" : diferenca < 0 ? "−" : ""}${Math.round(Math.abs(diferenca) * 100)}%`}</div>
              </div>
              {i.leite && !!p.ofertasBezerreiro?.length && <div className="grid gap-2">
                <p className="text-sm" title={p.orientacaoLeiteBezerreiro ?? undefined}>Concilie o leite já fornecido. Os demais ingredientes permanecem neste fechamento.</p>
                <div><Button secondary onClick={() => mudar(k, { quantidade: '0', motivo: 'Leite já registrado nas ofertas do Bezerreiro; sem novo fornecimento neste fechamento.' })}>Usar ofertas já registradas · zerar leite</Button></div>
              </div>}
              {i.leite && <fieldset className="grid gap-2"><legend className="font-semibold">Leite produzido para esta dieta </legend>
                <p className="text-sm">Previsto {formatarLitros(Number(i.leite.quantidadePrevistaLitros))} · disponível {formatarLitros(Number(i.leite.quantidadeDisponivelLitros))} · atendível {formatarLitros(Number(i.leite.quantidadeAtendivelLitros))}. Selecione as origens autorizadas; o fornecimento usa primeiro o não comercial e completa com o comercial.</p>
                {i.leite.origens.length === 0 && <p role="status">Sem origem disponível. Registre apenas os litros efetivamente fornecidos e justifique a diferença.</p>}
                {i.leite.origens.map(o => <label key={o.entradaId} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={e.origensLeite.includes(o.entradaId)} onChange={ev => mudar(k, { origensLeite: ev.target.checked ? [...e.origensLeite,o.entradaId] : e.origensLeite.filter(id => id !== o.entradaId) })} /><span>{o.produtoNome} · {o.natureza === "NAO_COMERCIAL" ? "Não comercial" : "Comercial"} · {formatarDataBR(o.data)} · {formatarLitros(Number(o.quantidadeDisponivelLitros))}</span></label>)}
              </fieldset>}
              {(Number(e.quantidade) !== Number(i.quantidadePrevista) || (i.leite && !!p.ofertasBezerreiro?.length)) && <label>Motivo da diferença<input className={classeInput} value={e.motivo} onChange={(ev) => mudar(k, { motivo: ev.target.value })} /></label>}
              {e.modo === "SEM_BAIXA_JUSTIFICADA" && <label>Justificativa sem baixa<textarea className={classeInput} value={e.justificativa} onChange={(ev) => mudar(k, { justificativa: ev.target.value })} /></label>}
              {/* Lote de estoque recolhido quando já escolhido; aberto enquanto falta escolher. */}
              {i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 && <details className="conferencia-partidas" open={!escolhido || undefined}>
                <summary>{escolhido ? <>Lote de estoque escolhido · <span className="conferencia-trocar">trocar</span></> : <span className="nutricao-alerta-texto">Escolha o lote de estoque</span>}</summary>
                <SelecaoPartidas compacto deEstoque produtoId={i.produtoId} propriedadeId={propriedadeId} dataFato={p.fim.slice(0, 10)} quantidade={e.quantidade} unidade={un(i.unidade)} saida valor={e.partidas} onChange={(sel) => mudar(k, { partidas: sel })} />
              </details>}
            </div>;
          })}
          <footer className="conferencia-parte-rodape">
            <span>Matéria seca <strong>{numero(p.materiaSecaConhecidaKg)} kg</strong> prevista{!p.coberturaMateriaSecaCompleta && " (parcial)"} · <strong>{valores.some((v) => v.ms != null) ? `${numero(somarEstimativas(valores.map((v) => v.ms), 3))} kg` : "não apurada"}</strong> conferida{valores.some((v) => v.ms == null) && valores.some((v) => v.ms != null) && " (parcial)"}</span>
            {mostrarValores && <span>Custo estimado <strong>{valores.some((v) => v.custo != null) ? fmtMoneyExact(Number(somarEstimativas(valores.map((v) => v.custo), 2))) : "Apurado ao confirmar"}</strong>{valores.some((v) => v.custo == null) && valores.some((v) => v.custo != null) && " (parcial)"}</span>}
            <details className="nutricao-participantes"><summary>Ver animais ({p.participantes.length})</summary><ul>{p.participantes.map((a) => <li key={a.animalId}>{a.brinco} · {a.dias} {a.dias === 1 ? "dia" : "dias"}</li>)}</ul></details>
          </footer>
        </fieldset>;
      })}
      {!acoes && botaoConfirmar}
    </>}
    {acoes && createPortal(previa ? botaoConfirmar : botaoConferir, acoes)}
  </section>;
}
