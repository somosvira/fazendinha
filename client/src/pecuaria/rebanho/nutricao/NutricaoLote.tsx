import { useCallback, useEffect, useState } from "react";
import { Button, ErrorBox, hoje, Panel } from "../../../financeiro/financeiro-ui";
import { DatePicker } from "../../../components/DatePicker";
import {
  atribuirDieta, confirmarConsumo, criarDieta, listarCentrosNutricionais, listarDietas, listarFechamentos,
  listarPartidasNutricionais, listarProdutosNutricionais, listarVigencias, previaConsumo, publicarDieta,
  type CentroNutricional, type Dieta, type Fechamento, type PartidaNutricional, type Previa, type ProdutoNutricional, type Vigencia,
} from "./api";

type EscolhaConsumo = { quantidade: string; motivo: string; modo: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativa: string; partidas: Record<string, string> };

export function NutricaoLote({ loteId, propriedadeId, podeLancar }: { loteId: string; propriedadeId: number; podeLancar: boolean }) {
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [vigencias, setVigencias] = useState<Vigencia[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [produtos, setProdutos] = useState<ProdutoNutricional[]>([]);
  const [centros, setCentros] = useState<CentroNutricional[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState("");
  const [ingredientes, setIngredientes] = useState([{ produtoId: "", quantidadeCabecaDia: "" }]);
  const [dietaId, setDietaId] = useState("");
  const [desde, setDesde] = useState(hoje());
  const [inicio, setInicio] = useState(hoje().slice(0, 7) + "-01");
  const [fim, setFim] = useState(hoje());
  const [centroCustoId, setCentroCustoId] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaConsumo>>({});
  const [partidas, setPartidas] = useState<Record<string, PartidaNutricional[]>>({});

  const carregar = useCallback(async () => {
    const [ds, vs, fs, ps, cs] = await Promise.all([listarDietas(), listarVigencias(loteId), listarFechamentos(loteId),
      listarProdutosNutricionais(), listarCentrosNutricionais()]);
    setDietas(ds); setVigencias(vs); setFechamentos(fs); setProdutos(ps); setCentros(cs.filter((c) => c.ativo));
  }, [loteId]);
  useEffect(() => { void carregar().catch((e) => setErro(e instanceof Error ? e.message : String(e))); }, [carregar]);

  async function executar(fn: () => Promise<unknown>, depois?: () => void) {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try { await fn(); depois?.(); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }

  const dietaAtual = vigencias.find((v) => !v.ate);
  const publicadas = dietas.filter((d) => d.publicadaEm);
  const rascunhos = dietas.filter((d) => !d.publicadaEm);

  async function criarReceita() {
    if (!nome.trim() || ingredientes.some((i) => !i.produtoId || !(Number(i.quantidadeCabecaDia) > 0))) {
      setErro("Informe o nome, os ingredientes e a quantidade por cabeça/dia."); return;
    }
    await executar(() => criarDieta({ nome: nome.trim(), itens: ingredientes.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: Number(i.quantidadeCabecaDia) })) }),
      () => { setNome(""); setIngredientes([{ produtoId: "", quantidadeCabecaDia: "" }]); });
  }

  async function conferir() {
    setOcupado(true); setErro(null);
    try {
      const p = await previaConsumo({ loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null });
      const porProduto = await Promise.all(p.itens.map(async (i) => [i.produtoId, i.rastrearPartidas ? await listarPartidasNutricionais(i.produtoId) : []] as const));
      setPartidas(Object.fromEntries(porProduto));
      setEscolhas(Object.fromEntries(p.itens.map((i) => [i.produtoId, { quantidade: i.quantidadePrevista, motivo: "", modo: "BAIXA_ESTOQUE", justificativa: "", partidas: {} }])));
      setPrevia(p);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }

  async function confirmar() {
    if (!previa) return;
    const itens = previa.itens.map((i) => {
      const e = escolhas[i.produtoId];
      return { produtoId: i.produtoId, quantidadeConfirmada: Number(e.quantidade), motivoAjuste: e.motivo.trim() || undefined,
        modoEstoque: e.modo, justificativaSemBaixa: e.justificativa.trim() || undefined,
        ...(i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" ? { partidas: Object.entries(e.partidas).filter(([, q]) => Number(q) > 0)
          .map(([partidaId, quantidade]) => ({ partidaId, quantidade: Number(quantidade) })) } : {}) };
    });
    await executar(() => confirmarConsumo({ loteId, propriedadeId, inicio, fim, centroCustoId: centroCustoId || null, itens }),
      () => setPrevia(null));
  }

  const mudarEscolha = (produtoId: string, patch: Partial<EscolhaConsumo>) => setEscolhas((atual) => ({ ...atual, [produtoId]: { ...atual[produtoId], ...patch } }));
  const classe = "min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm";

  return <Panel className="mt-6 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-xl">Nutrição do lote</h2>
      <p className="mt-1 text-sm text-ink-3">Dieta vigente: {dietaAtual ? `${dietaAtual.dieta.nome} · versão ${dietaAtual.dieta.versao}` : "nenhuma"}. Consumo é estimado por animal-dia e confirmado após conferência.</p></div></div>
    <ErrorBox erro={erro} />
    {podeLancar && <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-border p-4"><h3 className="font-semibold">Nova versão de dieta</h3>
        <label className="mt-3 block text-sm">Nome da dieta<input className={classe} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Dieta de lactação" /></label>
        <p className="mt-3 text-sm font-medium">Ingredientes por cabeça/dia</p>
        {ingredientes.map((item, indice) => <div key={indice} className="mt-2 grid gap-2 sm:grid-cols-[1fr_130px_auto]">
          <select aria-label={`Ingrediente ${indice + 1}`} className={classe} value={item.produtoId} onChange={(e) => setIngredientes((xs) => xs.map((x, j) => j === indice ? { ...x, produtoId: e.target.value } : x))}>
            <option value="">Selecione o Produto</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select>
          <input aria-label={`Quantidade por cabeça/dia ${indice + 1}`} className={classe} type="number" min="0.001" step="0.001" value={item.quantidadeCabecaDia}
            onChange={(e) => setIngredientes((xs) => xs.map((x, j) => j === indice ? { ...x, quantidadeCabecaDia: e.target.value } : x))} />
          <Button secondary onClick={() => setIngredientes((xs) => xs.filter((_, j) => j !== indice))} disabled={ingredientes.length === 1}>Remover</Button>
        </div>)}
        <div className="mt-3 flex flex-wrap gap-2"><Button secondary onClick={() => setIngredientes((xs) => [...xs, { produtoId: "", quantidadeCabecaDia: "" }])}>Adicionar ingrediente</Button>
          <Button onClick={() => { void criarReceita(); }} disabled={ocupado}>Criar rascunho</Button></div>
        {rascunhos.length > 0 && <div className="mt-4 space-y-2 text-sm"><p className="font-medium">Rascunhos</p>{rascunhos.map((d) => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2"><span>{d.nome} · v{d.versao}</span><Button secondary onClick={() => { void executar(() => publicarDieta(d.id)); }} disabled={ocupado}>Publicar</Button></div>)}</div>}
      </section>
      <section className="rounded-xl border border-border p-4"><h3 className="font-semibold">Atribuir dieta ao lote</h3>
        <label className="mt-3 block text-sm">Versão publicada<select className={classe} value={dietaId} onChange={(e) => setDietaId(e.target.value)}><option value="">Selecione</option>{publicadas.map((d) => <option key={d.id} value={d.id}>{d.nome} · v{d.versao}</option>)}</select></label>
        <label className="mt-3 block text-sm">Início da vigência<DatePicker value={desde} onChange={setDesde} className="mt-1.5" /></label>
        <Button className="mt-3" onClick={() => { if (!dietaId) { setErro("Selecione a dieta publicada."); return; } void executar(() => atribuirDieta({ loteId, propriedadeId, dietaId, desde })); }} disabled={ocupado}>Aplicar ao lote</Button>
        <div className="mt-4 space-y-1 text-sm text-ink-3">{vigencias.map((v) => <p key={v.id}>{v.dieta.nome} v{v.dieta.versao}: {v.desde.slice(0, 10)} – {v.ate?.slice(0, 10) ?? "atual"}</p>)}</div>
      </section>
    </div>}
    <section className="mt-5 rounded-xl border border-border p-4"><h3 className="font-semibold">Fechamento do consumo</h3>
      {podeLancar && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">De<DatePicker value={inicio} onChange={setInicio} className="mt-1.5" /></label>
        <label className="text-sm">Até<DatePicker value={fim} onChange={setFim} className="mt-1.5" /></label>
        <label className="text-sm">Centro de custo<select className={classe} value={centroCustoId} onChange={(e) => setCentroCustoId(e.target.value)}><option value="">Usar o centro do lote</option>{centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <div className="flex items-end"><Button onClick={() => { void conferir(); }} disabled={ocupado}>Conferir período</Button></div>
      </div>}
      {previa && <div className="mt-4 space-y-4"><p className="text-sm"><strong>{previa.animalDias} animal-dias</strong> · {previa.participantes.length} animais · {previa.dieta.nome} v{previa.dieta.versao}</p>
        {previa.itens.map((i) => { const e = escolhas[i.produtoId]; return <div key={i.produtoId} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold">{i.nome} · previsto {i.quantidadePrevista} {i.unidade}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Quantidade real<input className={classe} type="number" min="0" step="0.001" value={e.quantidade} onChange={(ev) => mudarEscolha(i.produtoId, { quantidade: ev.target.value })} /></label>
            <label>Origem<select className={classe} value={e.modo} onChange={(ev) => mudarEscolha(i.produtoId, { modo: ev.target.value as EscolhaConsumo["modo"] })}><option value="BAIXA_ESTOQUE">Baixar do estoque</option><option value="SEM_BAIXA_JUSTIFICADA">Sem baixa, com justificativa</option></select></label></div>
          {Number(e.quantidade) !== Number(i.quantidadePrevista) && <label className="mt-2 block">Por que diferiu da previsão?<input className={classe} value={e.motivo} onChange={(ev) => mudarEscolha(i.produtoId, { motivo: ev.target.value })} /></label>}
          {e.modo === "SEM_BAIXA_JUSTIFICADA" && <label className="mt-2 block">Por que não houve baixa?<input className={classe} value={e.justificativa} onChange={(ev) => mudarEscolha(i.produtoId, { justificativa: ev.target.value })} /></label>}
          {i.rastrearPartidas && e.modo === "BAIXA_ESTOQUE" && <div className="mt-2"><p className="font-medium">Distribuição por partida</p>
            {(partidas[i.produtoId] ?? []).map((p) => <label key={p.id} className="mt-1 grid grid-cols-[1fr_120px] items-center gap-2"><span>{p.codigo} · saldo {p.saldo}{p.validade ? ` · vence ${p.validade.slice(0, 10)}` : " · validade desconhecida"}</span>
              <input className={classe} type="number" min="0" step="0.001" value={e.partidas[p.id] ?? ""} onChange={(ev) => mudarEscolha(i.produtoId, { partidas: { ...e.partidas, [p.id]: ev.target.value } })} /></label>)}</div>}
        </div>; })}
        <Button onClick={() => { void confirmar(); }} disabled={ocupado}>Confirmar consumo conferido</Button>
      </div>}
      <div className="mt-5 space-y-2"><p className="text-sm font-medium">Histórico</p>{fechamentos.length ? fechamentos.map((f) => <div key={f.id} className="rounded-lg border border-border p-3 text-sm">
        <strong>{f.inicio.slice(0, 10)} – {f.fim.slice(0, 10)}</strong> · {f.animalDias} animal-dias · {f.status === "CONFIRMADO" ? "Confirmado" : "Estornado"}
        <p className="text-ink-3">{f.itens.map((i) => `${i.produto.nome}: ${i.quantidadeConfirmada} (previsto ${i.quantidadePrevista})`).join(" · ")}</p>
      </div>) : <p className="text-sm text-ink-3">Nenhum fechamento registrado.</p>}</div>
    </section>
  </Panel>;
}
