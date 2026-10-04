import { useEffect, useMemo, useState } from "react";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { Button, dataBR, ErrorBox, Panel } from "../financeiro/financeiro-ui";
import { listarMovimentos, listarProdutos, type MovimentoDTO, type ProdutoDTO } from "./api";
import { listarPartidasNutricionais, type PartidaNutricional } from "../pecuaria/rebanho/nutricao/api";
import { destinoDoMovimento, podeAcessarArea } from "./navegacao";
import { navegarPara } from "../router";
import { ROTULO_ORIGEM } from "./rotulos";

type Filtro = "TODAS" | "VENCIDAS" | "NAO_IDENTIFICADAS" | "SANITARIAS" | "NUTRICIONAIS";

/** Consulta de estoque físico por sítio. Não ativa rastreio nem registra movimento. */
export function ConsultaPartidas() {
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [sitioId, setSitioId] = useState(() => getPropriedadeAtiva() ?? 0);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [produtoId, setProdutoId] = useState(() => new URLSearchParams(window.location.search).get("produtoId") ?? "");
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [partidaId, setPartidaId] = useState("");
  const [movimentos, setMovimentos] = useState<MovimentoDTO[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [carregando, setCarregando] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarPropriedades({ incluirInativos: true }), listarProdutos()])
      .then(([listaSitios, listaProdutos]) => { if (ativo) { setSitios(listaSitios); setProdutos(listaProdutos.filter((p) => p.rastrearPartidas)); } })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { ativo = false; };
  }, []);
  useEffect(() => {
    let ativo = true;
    setPartidaId(""); setPartidas([]);
    if (!sitioId || !produtoId) return;
    setCarregando(true); setErro(null);
    listarPartidasNutricionais(produtoId, sitioId)
      .then((lista) => { if (ativo) setPartidas(lista); })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [sitioId, produtoId]);
  useEffect(() => {
    let ativo = true;
    setMovimentos([]); setTotal(0);
    if (!partidaId) return;
    setCarregandoHistorico(true); setErro(null);
    listarMovimentos({ produtoId, partidaId, propriedadeId: sitioId, pagina, porPagina: 10 })
      .then((r) => { if (ativo) { setMovimentos(r.itens); setTotal(r.total); } })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (ativo) setCarregandoHistorico(false); });
    return () => { ativo = false; };
  }, [produtoId, partidaId, sitioId, pagina]);

  const produto = produtos.find((p) => p.id === produtoId);
  const produtosVisiveis = useMemo(() => produtos.filter((p) => {
    if (filtro === "SANITARIAS") return !!p.usoSanitario;
    if (filtro === "NUTRICIONAIS") return !!p.usoNutricional;
    return true;
  }), [produtos, filtro]);
  const partidasVisiveis = partidas.filter((p) => {
    if (filtro === "NAO_IDENTIFICADAS") return p.origemRastreio === "LEGADO_NAO_IDENTIFICADO";
    if (filtro === "VENCIDAS") return !!p.validade && p.validade.slice(0, 10) < new Date().toISOString().slice(0, 10) && Number(p.saldo) > 0;
    return true;
  });

  return <section id="lotes" className="mt-10" aria-label="Consulta de lotes de estoque">
    <h2 className="font-serif text-2xl">Lotes dos produtos</h2>
    <p className="mt-1 text-sm text-ink-3">Consulte saldos, validade e movimentos por sítio. Para ativar o rastreio ou identificar legado, abra o cadastro do Produto.</p>
    <ErrorBox erro={erro} />
    {produtoId && <a href={`/estoque/produtos/${produtoId}`} className="mt-2 inline-block text-sm underline">Abrir ficha do produto</a>}
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">Sítio
        <select aria-label="Sítio dos lotes" className="rounded-lg border border-border bg-white px-3 py-2" value={sitioId || ""} onChange={(e) => { setSitioId(Number(e.target.value) || 0); setPagina(1); }}>
          <option value="">Selecione um sítio</option>{sitios.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.ativo ? "" : " (inativo)"}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Filtro
        <select aria-label="Filtrar lotes" className="rounded-lg border border-border bg-white px-3 py-2" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
          <option value="TODAS">Todas</option><option value="SANITARIAS">Produtos sanitários</option><option value="NUTRICIONAIS">Produtos nutricionais</option><option value="VENCIDAS">Com saldo vencido</option><option value="NAO_IDENTIFICADAS">Legado não identificado</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">Produto rastreado
        <select aria-label="Produto dos lotes" className="rounded-lg border border-border bg-white px-3 py-2" value={produtoId} onChange={(e) => { setProdutoId(e.target.value); setPagina(1); }}>
          <option value="">Selecione um produto</option>{produtosVisiveis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
    </div>
    <Panel className="mt-3 p-4">
      {!sitioId ? <p className="text-sm text-ink-3">Escolha o sítio para consultar o estoque físico.</p>
        : !produtoId ? <p className="text-sm text-ink-3">Escolha um Produto rastreado. Se ainda não houver um, ative o controle no cadastro do Produto.</p>
        : carregando ? <p className="text-sm">Carregando lotes…</p>
        : !partidasVisiveis.length ? <p className="text-sm text-ink-3">Nenhum lote corresponde ao filtro neste sítio.</p>
        : <div className="grid gap-2">{partidasVisiveis.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
          <div><strong>{p.nome || (p.origemRastreio === "LEGADO_NAO_IDENTIFICADO" ? "Estoque sem validade informada" : p.codigo)}</strong><div className="text-ink-3">Saldo: {p.saldo} {produto?.unidade} · Validade: {p.validade ? dataBR(p.validade.slice(0, 10)) : "não informada"}</div></div>
          <Button secondary onClick={() => { setPartidaId(p.id); setPagina(1); }}>Ver movimentos</Button>
        </div>)}</div>}
      {partidaId && <div className="mt-4 border-t border-border pt-3"><h3 className="font-semibold">Movimentos do lote {partidas.find((p) => p.id === partidaId)?.nome || partidas.find((p) => p.id === partidaId)?.codigo}</h3>
        {carregandoHistorico ? <p className="text-sm">Carregando movimentos…</p> : !movimentos.length ? <p className="text-sm text-ink-3">Sem movimentos neste sítio.</p> : movimentos.map((m) => { const destino = destinoDoMovimento(m); return <p key={m.id} className="border-b border-border py-2 text-sm">{dataBR(m.data)} · {ROTULO_ORIGEM[m.origem]} · {m.partidas?.find((a) => a.partidaId === partidaId)?.quantidade ?? m.quantidade} {produto?.unidade}{destino && podeAcessarArea(destino.area) && <> · <a href={destino.href} onClick={(e) => { if (e.button === 0 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); navegarPara(destino.href); } }} className="text-green-800 underline">{destino.rotulo}</a></>}</p>; })}
        <div className="mt-2 flex gap-2"><Button secondary disabled={pagina <= 1} onClick={() => setPagina((v) => v - 1)}>Anterior</Button><Button secondary disabled={pagina * 10 >= total} onClick={() => setPagina((v) => v + 1)}>Próxima</Button><Button secondary onClick={() => setPartidaId("")}>Fechar</Button></div>
      </div>}
    </Panel>
  </section>;
}
