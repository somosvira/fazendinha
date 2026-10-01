import { useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { DatePicker } from "../../../components/DatePicker";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelecaoPartidas, type DistribuicaoPartida } from "../../../estoque/SelecaoPartidas";
import { confirmarPeriodos, previaPeriodos, type CentroNutricional, type Previa } from "./api";

type Escolha = { quantidade: string; motivo: string; modo: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativa: string; partidas: DistribuicaoPartida[] };
export function ConferenciaPeriodos({ loteId, propriedadeId, centros, onSalvo }: { loteId: string; propriedadeId: number; centros: CentroNutricional[]; onSalvo: () => Promise<void> }) {
  const [inicio, setInicio] = useState(hoje().slice(0, 7) + "-01");
  const [fim, setFim] = useState(hoje());
  const [centroCustoId, setCentro] = useState("");
  const [previa, setPrevia] = useState<{ periodos: Previa[]; lacunas: Array<{ inicio: string; fim: string }> } | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const chaveItem = (p: Previa, produtoId: string) => p.inicio.slice(0, 10) + ":" + produtoId;
  function mudar(k: string, patch: Partial<Escolha>) { setEscolhas((e) => ({ ...e, [k]: { ...e[k], ...patch } })); setChave(crypto.randomUUID()); }
  async function conferir() {
    if (ocupado) return; setOcupado(true); setErro(null); setPrevia(null);
    try { const p = await previaPeriodos({ loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null }); setPrevia(p); setChave(crypto.randomUUID()); setEscolhas(Object.fromEntries(p.periodos.flatMap((p) => p.itens.map((i) => [chaveItem(p, i.produtoId), { quantidade: i.quantidadePrevista, motivo: "", modo: "BAIXA_ESTOQUE", justificativa: "", partidas: [] }])))); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  async function confirmar() {
    if (!previa || ocupado || previa.lacunas.length) return;
    setOcupado(true); setErro(null);
    try {
      const periodos = previa.periodos.map((p) => ({ inicio: p.inicio.slice(0, 10), fim: p.fim.slice(0, 10), itens: p.itens.map((i) => {
        const e = escolhas[chaveItem(p, i.produtoId)];
        if (!e.quantidade.trim() || !Number.isFinite(Number(e.quantidade)) || Number(e.quantidade) < 0) throw new Error(`${i.nome}: informe a quantidade, inclusive zero se confirmado.`);
        if (Number(e.quantidade) !== Number(i.quantidadePrevista) && !e.motivo.trim()) throw new Error(`${i.nome}: justifique a diferença da previsão.`);
        if (e.modo === "SEM_BAIXA_JUSTIFICADA" && !e.justificativa.trim()) throw new Error(`${i.nome}: justifique o consumo sem baixa.`);
        return { produtoId: i.produtoId, quantidadeConfirmada: Number(e.quantidade), motivoAjuste: e.motivo || undefined, modoEstoque: e.modo, justificativaSemBaixa: e.justificativa || undefined, ...(i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 ? { partidas: e.partidas.map((s) => ({ partidaId: s.partidaId!, quantidade: Number(s.quantidade) })) } : {}) };
      }) }));
      await confirmarPeriodos({ chave, loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null, periodos }); setPrevia(null); await onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <section className="mt-4 grid gap-4"><ErrorBox erro={erro} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label>De<DatePicker value={inicio} onChange={(v) => { setInicio(v); setPrevia(null); }} /></label><label>Até<DatePicker value={fim} onChange={(v) => { setFim(v); setPrevia(null); }} /></label><label>Centro de custo<select className={classeInput} value={centroCustoId} onChange={(e) => { setCentro(e.target.value); setPrevia(null); }}><option value="">Usar o centro do lote</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><div className="flex items-end"><Button disabled={ocupado} onClick={() => void conferir()}>Conferir período</Button></div></div>{previa && <><p className="text-sm">A confirmação inclui {previa.periodos.length} fechamento(s), separados por mês e vigência. Consumo/custo por animal são atribuições por permanência.</p>{previa.lacunas.map((l) => <p key={l.inicio} className="rounded-lg bg-amber-50 p-3 text-sm">Sem dieta de {l.inicio} a {l.fim}. Corrija a vigência e confira novamente; o conjunto não pode ser confirmado.</p>)}{previa.periodos.map((p) => <fieldset key={p.inicio} disabled={ocupado} className="grid gap-3 rounded-lg border border-border p-3"><legend className="px-1 font-semibold">{p.inicio.slice(0, 10)} – {p.fim.slice(0, 10)} · {p.dieta.nome} v{p.dieta.versao}</legend><p>{p.animalDias} animal-dias · {p.participantes.length} animais · MS conhecida {p.materiaSecaConhecidaKg} kg ({p.coberturaMateriaSecaCompleta ? "completa" : "cobertura incompleta"})</p><details><summary>Conferir participantes</summary>{p.participantes.map((a) => <p key={a.animalId}>{a.brinco}: {a.dias} dias</p>)}</details>{p.itens.map((i) => { const k = chaveItem(p, i.produtoId); const e = escolhas[k]; return <div key={k} className="grid gap-2 border-t border-border pt-3"><strong>{i.nome}: previsto {i.quantidadePrevista} {i.unidade}</strong><p className="text-sm">Saldo {i.saldo} {i.unidade}{i.custoPrevisto == null ? "" : ` · custo previsto R$ ${i.custoPrevisto}`}</p><div className="grid gap-3 sm:grid-cols-2"><label>Quantidade conferida ({i.unidade})<input type="number" min="0" step="0.001" className={classeInput} value={e.quantidade} onChange={(ev) => mudar(k, { quantidade: ev.target.value })} /></label><label>Origem<select className={classeInput} value={e.modo} onChange={(ev) => mudar(k, { modo: ev.target.value as Escolha["modo"] })}><option value="BAIXA_ESTOQUE">Baixar estoque</option><option value="SEM_BAIXA_JUSTIFICADA">Sem baixa — justificar</option></select></label></div>{Number(e.quantidade) !== Number(i.quantidadePrevista) && <label>Motivo da diferença<input className={classeInput} value={e.motivo} onChange={(ev) => mudar(k, { motivo: ev.target.value })} /></label>}{e.modo === "SEM_BAIXA_JUSTIFICADA" && <label>Justificativa sem baixa<textarea className={classeInput} value={e.justificativa} onChange={(ev) => mudar(k, { justificativa: ev.target.value })} /></label>}{i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && Number(e.quantidade) > 0 && <SelecaoPartidas produtoId={i.produtoId} saida valor={e.partidas} onChange={(s) => mudar(k, { partidas: s })} />}</div>; })}</fieldset>)}<Button disabled={ocupado || !!previa.lacunas.length || !previa.periodos.length} onClick={() => void confirmar()}>Confirmar conjunto conferido</Button></>}</section>;
}
