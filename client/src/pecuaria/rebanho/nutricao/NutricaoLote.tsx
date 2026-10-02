import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje, Panel } from "../../../financeiro/financeiro-ui";
import { ConferenciaPeriodos } from "./ConferenciaPeriodos";
import { DatePicker } from "../../../components/DatePicker";
import { formatarDataBR } from "../lib/rotulos";
import { DetalhesFechamento } from "./DetalhesFechamento";
import {
  atribuirDieta, corrigirVigencia, criarDieta, editarDieta, estornarConsumo, listarCentrosNutricionais, listarDietas, listarFechamentos,
  listarProdutosNutricionais, listarVigencias, publicarDieta,
  type CentroNutricional, type Dieta, type Fechamento, type ProdutoNutricional, type Vigencia,
} from "./api";


export function NutricaoLote({ loteId, propriedadeId, podeLancar, vista }: { loteId?: string; propriedadeId?: number; podeLancar: boolean; vista?: "lotes" | "receitas" | "fechamentos" }) {
  const [vigenciaCorrecao, setVigenciaCorrecao] = useState<Vigencia | null>(null);
  const [dataCorrecao, setDataCorrecao] = useState("");
  const [motivoCorrecao, setMotivoCorrecao] = useState("");
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [estornando, setEstornando] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [vigencias, setVigencias] = useState<Vigencia[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [paginaVigencias, setPaginaVigencias] = useState(1);
  const [paginaFechamentos, setPaginaFechamentos] = useState(1);
  const [totalVigencias, setTotalVigencias] = useState(0);
  const [totalFechamentos, setTotalFechamentos] = useState(0);
  const [dietaAtual, setDietaAtual] = useState<Vigencia | null>(null);
  const [dietaProgramada, setDietaProgramada] = useState<Vigencia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const carga = useRef(0);
  const [produtos, setProdutos] = useState<ProdutoNutricional[]>([]);
  const [centros, setCentros] = useState<CentroNutricional[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState("");
  const [ingredientes, setIngredientes] = useState([{ produtoId: "", quantidadeCabecaDia: "" }]);
  const [dietaId, setDietaId] = useState("");
  const [desde, setDesde] = useState(hoje());

  const carregar = useCallback(async () => {
    const sequencia = ++carga.current; setCarregando(true); setErro(null);
    try {
      const [ds, vs, fs, ps, cs] = await Promise.all([listarDietas(), loteId ? listarVigencias(loteId, paginaVigencias) : null, loteId ? listarFechamentos(loteId, paginaFechamentos) : null,
        podeLancar ? listarProdutosNutricionais() : Promise.resolve([]), podeLancar ? listarCentrosNutricionais() : Promise.resolve([])]);
      if (sequencia !== carga.current) return;
      setDietas(ds); setVigencias(vs?.itens ?? []); setFechamentos(fs?.itens ?? []); setProdutos(ps); setCentros(cs.filter((c) => c.ativo));
      setTotalVigencias(vs?.total ?? 0); setTotalFechamentos(fs?.total ?? 0); setDietaAtual(vs?.vigente ?? null); setDietaProgramada(vs?.programada ?? null);
    } catch (e) { if (sequencia === carga.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (sequencia === carga.current) setCarregando(false); }
  }, [loteId, paginaVigencias, paginaFechamentos, podeLancar]);
  useEffect(() => { void carregar(); return () => { carga.current++; }; }, [carregar]);

  async function executar(fn: () => Promise<unknown>, depois?: () => void) {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try { await fn(); depois?.(); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }

  const publicadas = dietas.filter((d) => d.publicadaEm);
  const rascunhos = dietas.filter((d) => !d.publicadaEm);

  async function criarReceita() {
    if (!nome.trim() || ingredientes.some((i) => !i.produtoId || !(Number(i.quantidadeCabecaDia) > 0))) {
      setErro("Informe o nome, os ingredientes e a quantidade por cabeça/dia."); return;
    }
    const body = { nome: nome.trim(), itens: ingredientes.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: Number(i.quantidadeCabecaDia) })) };
    await executar(() => rascunhoId ? editarDieta(rascunhoId, body) : criarDieta(body),
      () => { setRascunhoId(null); setNome(""); setIngredientes([{ produtoId: "", quantidadeCabecaDia: "" }]); });
  }

  const classe = "min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm";

  return <Panel className="mt-6 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-xl">{vista === "receitas" ? "Receitas" : "Nutrição do lote"}</h2>
      {loteId && !carregando && <p className="mt-1 text-sm text-ink-3">Dieta vigente: {dietaAtual ? `${dietaAtual.dieta.nome} · versão ${dietaAtual.dieta.versao}` : "nenhuma"}.
        {dietaProgramada && <> Programada: {dietaProgramada.dieta.nome} · versão {dietaProgramada.dieta.versao}, a partir de {formatarDataBR(dietaProgramada.desde)}.</>} Consumo é estimado por animal-dia e confirmado após conferência.</p>}</div></div>
    <ErrorBox erro={erro} />
    {erro && <Button secondary onClick={() => void carregar()}>Tentar novamente</Button>}
    {carregando && <p className="mt-4" role="status">Carregando nutrição…</p>}
    {(vista == null || vista === "receitas") && <details className="mt-4 rounded-lg border border-border p-3"><summary className="cursor-pointer font-semibold">Receitas e ingredientes ({dietas.length})</summary>{dietas.map((d) => <div key={d.id} className="mt-3 border-t border-border pt-3 text-sm"><strong>{d.nome} · v{d.versao} · {d.publicadaEm ? "Publicada — imutável" : "Rascunho"}</strong>{d.itens.map((i) => <p key={i.produtoId}>{i.produto?.nome} · {i.quantidadeCabecaDia} {i.unidade}/cabeça/dia · MS {i.materiaSecaPercentualSnapshot == null ? "não informada" : `${i.materiaSecaPercentualSnapshot}%`}</p>)}{podeLancar && <Button secondary className="mt-2" onClick={() => { setRascunhoId(d.publicadaEm ? null : d.id); setNome(d.nome); setIngredientes(d.itens.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: i.quantidadeCabecaDia }))); }}>{d.publicadaEm ? "Criar nova versão a partir desta" : "Editar rascunho"}</Button>}</div>)}</details>}
    {podeLancar && <div className="mt-5 grid gap-5 lg:grid-cols-2">
      {(vista == null || vista === "receitas") && <section className="rounded-xl border border-border p-4"><h3 className="font-semibold">Nova versão de dieta</h3>
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
          <Button onClick={() => { void criarReceita(); }} disabled={ocupado}>{rascunhoId ? "Salvar rascunho" : "Criar rascunho"}</Button></div>
        {rascunhos.length > 0 && <div className="mt-4 space-y-2 text-sm"><p className="font-medium">Rascunhos</p>{rascunhos.map((d) => <div key={d.id} className="flex flex-wrap items-center justify-between gap-2"><span>{d.nome} · v{d.versao}</span><Button secondary onClick={() => { void executar(() => publicarDieta(d.id)); }} disabled={ocupado}>Publicar</Button></div>)}</div>}
      </section>}
      {loteId && propriedadeId != null && (vista == null || vista === "lotes") && <section className="rounded-xl border border-border p-4"><h3 className="font-semibold">Atribuir dieta ao lote</h3>
        <label className="mt-3 block text-sm">Versão publicada<select className={classe} value={dietaId} onChange={(e) => setDietaId(e.target.value)}><option value="">Selecione</option>{publicadas.map((d) => <option key={d.id} value={d.id}>{d.nome} · v{d.versao}</option>)}</select></label>
        <label className="mt-3 block text-sm">Início da vigência<DatePicker value={desde} onChange={setDesde} className="mt-1.5" /></label>
        <Button className="mt-3" onClick={() => { if (!dietaId) { setErro("Selecione a dieta publicada."); return; } void executar(() => atribuirDieta({ loteId, propriedadeId, dietaId, desde })); }} disabled={ocupado}>Aplicar ao lote</Button>
      </section>}
    </div>}
    {loteId && !carregando && (vista == null || vista === "lotes") && <section className="mt-4 space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">Histórico de dietas</h3>
      {vigencias.length ? vigencias.map((v) => <p className="text-sm" key={v.id}>{v.dieta.nome} v{v.dieta.versao}: {formatarDataBR(v.desde)} – {v.ate ? `${formatarDataBR(v.ate)} (troca de dieta)` : "sem fim programado"}
        {podeLancar && <Button secondary className="ml-2" onClick={() => { setVigenciaCorrecao(v); setDataCorrecao(v.desde.slice(0, 10)); setMotivoCorrecao(""); }}>Corrigir vigência</Button>}</p>) : <p>Nenhuma dieta atribuída. Selecione uma receita publicada para aplicar ao lote.</p>}
      {totalVigencias > 25 && <div className="flex flex-wrap items-center gap-3"><Button secondary disabled={paginaVigencias === 1} onClick={() => setPaginaVigencias((p) => p - 1)}>Dietas anteriores</Button><span>Página {paginaVigencias} · {totalVigencias} vigências</span><Button secondary disabled={paginaVigencias * 25 >= totalVigencias} onClick={() => setPaginaVigencias((p) => p + 1)}>Mais dietas</Button></div>}
    </section>}
    {loteId && propriedadeId != null && (vista == null || vista === "fechamentos") && <section className="mt-5 rounded-xl border border-border p-4"><h3 className="font-semibold">Fechamento do consumo</h3>
      {podeLancar && <ConferenciaPeriodos loteId={loteId} propriedadeId={propriedadeId} centros={centros} onSalvo={carregar} />}
      <div className="mt-5 space-y-2"><p className="text-sm font-medium">Histórico</p>{fechamentos.length ? fechamentos.map((f) => <div key={f.id} className="rounded-lg border border-border p-3 text-sm">
        <strong>{formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)}</strong> · {f.animalDias} animal-dias · {f.status === "CONFIRMADO" ? "Confirmado" : "Estornado"}
        <p className="text-ink-3">{f.itens.map((i) => `${i.produto.nome}: ${i.quantidadeConfirmada} (previsto ${i.quantidadePrevista})`).join(" · ")}</p>
        <details className="mt-2"><summary>Detalhes do fechamento</summary><DetalhesFechamento fechamento={f} /></details>
        {podeLancar && f.status === "CONFIRMADO" && <Button secondary className="mt-2" onClick={() => { setEstornando(f.id); setMotivoEstorno(""); }}>Conferir estorno</Button>}
      </div>) : !carregando && <p className="text-sm text-ink-3">Nenhum fechamento registrado. Confira um período para lançar o consumo.</p>}</div>
      {totalFechamentos > 25 && <div className="mt-3 flex flex-wrap items-center gap-3"><Button secondary disabled={carregando || paginaFechamentos === 1} onClick={() => setPaginaFechamentos((p) => p - 1)}>Fechamentos anteriores</Button><span>Página {paginaFechamentos} · {totalFechamentos} fechamentos</span><Button secondary disabled={carregando || paginaFechamentos * 25 >= totalFechamentos} onClick={() => setPaginaFechamentos((p) => p + 1)}>Mais fechamentos</Button></div>}
    </section>}
    {vigenciaCorrecao && propriedadeId != null && <section className="mt-4 grid gap-3 rounded-lg border border-amber-300 p-4"><h3>Corrigir início da vigência · {vigenciaCorrecao.dieta.nome}</h3><p className="text-sm">Ajusta também o fim da vigência anterior contígua. Fechamentos afetados devem ser estornados antes.</p><DatePicker value={dataCorrecao} onChange={setDataCorrecao} /><label>Motivo<textarea className={classe} minLength={5} maxLength={500} value={motivoCorrecao} onChange={(e) => setMotivoCorrecao(e.target.value)} /></label><div className="flex gap-2"><Button secondary onClick={() => setVigenciaCorrecao(null)} disabled={ocupado}>Cancelar</Button><Button disabled={ocupado || motivoCorrecao.trim().length < 5 || !dataCorrecao} onClick={() => void executar(() => corrigirVigencia(vigenciaCorrecao.id, { propriedadeId, desde: dataCorrecao, motivo: motivoCorrecao }), () => setVigenciaCorrecao(null))}>Confirmar correção</Button></div></section>}
    {estornando && propriedadeId != null && <section className="mt-4 rounded-lg border border-amber-300 p-4"><h3 className="font-semibold">Prévia do estorno</h3><p className="text-sm">Serão devolvidas ao estoque as quantidades que tiveram baixa, nas partidas originais. Consumos sem baixa não geram entrada. O histórico permanece registrado.</p>{fechamentos.find((f) => f.id === estornando)?.itens.map((i) => <p key={i.produtoId} className="mt-2 text-sm">{i.produto.nome}: {i.movimentoEstoque ? `${i.movimentoEstoque.quantidade} ${i.unidade} a devolver${i.movimentoEstoque.alocacaoPartidaEstoques.map((a) => ` · ${a.partida.codigo}: ${a.quantidade}`).join("")}` : "sem devolução — não houve baixa"}</p>)}<label className="mt-3 block text-sm">Motivo<textarea className={classe} maxLength={500} value={motivoEstorno} onChange={(e) => setMotivoEstorno(e.target.value)} /></label><div className="mt-3 flex gap-2"><Button secondary disabled={ocupado} onClick={() => setEstornando(null)}>Cancelar</Button><Button disabled={ocupado || motivoEstorno.trim().length < 5} onClick={() => { void executar(() => estornarConsumo(estornando, { propriedadeId, motivo: motivoEstorno }), () => { setEstornando(null); }); }}>Confirmar estorno com motivo</Button></div></section>}
  </Panel>;
}
