import { useEffect, useState } from "react";
import { Button, ErrorBox, PageHeader, PaginaFinanceira, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { navegarPara } from "../../../router";
import { buscarFichaAnimal, listarAnimais } from "../api";
import type { AnimalFicha, AnimalResumo } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { ROTULO_TIPO_PESAGEM } from "../components/GraficoPeso";
import { Paginacao } from "../ui";
import { ColetasCampo } from "./ColetasCampo";

function lerEstado() {
  const p = new URLSearchParams(window.location.search);
  return { fichas: p.get("aba") === "fichas" || p.has("coletaId"), animalId: p.get("animalId") ?? "" };
}
export function Pesagens({ podeLancar }: { podeLancar: boolean }) {
  const [estado, setEstado] = useState(lerEstado);
  useEffect(() => { const voltar = () => setEstado(lerEstado()); window.addEventListener("popstate", voltar); return () => window.removeEventListener("popstate", voltar); }, []);
  function navegar(fichas: boolean, animalId = estado.animalId) {
    const p = new URLSearchParams(); p.set("aba", fichas ? "fichas" : "historico"); if (animalId) p.set("animalId", animalId);
    navegarPara(`/pecuaria/rebanho/pesagens?${p}`);
  }
  return <>
    <div role="tablist" aria-label="Consultas de pesagens" className="mb-5 flex flex-wrap gap-2">
      <button type="button" role="tab" aria-selected={!estado.fichas} className="rounded-lg border border-border px-4 py-2 text-sm aria-selected:bg-surface-2 aria-selected:font-semibold" onClick={() => navegar(false)}>Histórico por animal</button>
      <button type="button" role="tab" aria-selected={estado.fichas} className="rounded-lg border border-border px-4 py-2 text-sm aria-selected:bg-surface-2 aria-selected:font-semibold" onClick={() => navegar(true)}>Fichas de pesagem</button>
    </div>
    {estado.fichas ? <ColetasCampo podeLancar={podeLancar} somentePesagens /> : <HistoricoPesagens animalId={estado.animalId} onAnimal={(id) => navegar(false, id)} />}
  </>;
}

function HistoricoPesagens({ animalId, onAnimal }: { animalId: string; onAnimal: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [animal, setAnimal] = useState<AnimalFicha | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroFicha, setErroFicha] = useState<string | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [revisaoLista, setRevisaoLista] = useState(0);
  const [revisaoFicha, setRevisaoFicha] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => { setBuscaAplicada(busca.trim()); setPagina(1); }, 300); return () => window.clearTimeout(timer); }, [busca]);
  useEffect(() => {
    let vivo = true; setCarregandoLista(true); setErroLista(null);
    listarAnimais({ situacao: "TODOS", busca: buscaAplicada, page: pagina, pageSize: 20 }).then((r) => { if (vivo) { setAnimais(r.itens); setTotal(r.total); } }).catch((e: unknown) => { if (vivo) setErroLista(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregandoLista(false); });
    return () => { vivo = false; };
  }, [buscaAplicada, pagina, revisaoLista]);
  useEffect(() => {
    let vivo = true; setAnimal(null); setErroFicha(null); setCarregandoFicha(!!animalId);
    if (animalId) buscarFichaAnimal(animalId).then((a) => { if (vivo) setAnimal(a); }).catch((e: unknown) => { if (vivo) setErroFicha(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregandoFicha(false); });
    return () => { vivo = false; };
  }, [animalId, revisaoFicha]);
  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Pesagens" descricao="Consulte o histórico completo de cada animal, incluindo pesos de nascimento, entrada, manejo e coletas de campo. Animais baixados também estão disponíveis." />
    <Panel className="mt-5 p-5">
      <h2 className="h2">Escolher animal</h2><label className="mt-3 block text-sm">Buscar por brinco ou nome<input className={classeInput} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Brinco ou nome" /></label>
      <ErrorBox erro={erroLista} />{erroLista && <Button secondary onClick={() => setRevisaoLista((v) => v + 1)}>Tentar buscar novamente</Button>}
      {carregandoLista ? <p className="mt-4" role="status">Carregando animais…</p> : !erroLista && <><TabelaFinanceira rotulo="Animais para consulta de pesagens" itens={animais} chaveDe={(a) => a.id} colunas={[
        { chave: "animal", titulo: "Animal", principal: true, celula: (a) => <button type="button" className="text-left underline" aria-pressed={animalId === a.id} onClick={() => onAnimal(a.id)}>{a.brinco}{a.nome ? ` · ${a.nome}` : ""}</button> },
        { chave: "situacao", titulo: "Situação", celula: (a) => a.situacao === "BAIXADO" ? "Baixado" : "Ativo" },
        { chave: "local", titulo: "Local atual", celula: (a) => a.lote?.nome ?? a.propriedade?.nome ?? "Sem localização atual" },
      ]} />{!animais.length && <p className="mt-3">Nenhum animal encontrado.</p>}<Paginacao paginaAtual={pagina} totalPaginas={Math.max(1, Math.ceil(total / 20))} totalItens={total} itensPorPagina={20} onPaginaChange={setPagina} rotulo="animais" idSelect="pesagens-pagina" /></>}
    </Panel>
    {animalId && <Panel className="mt-5 p-5"><ErrorBox erro={erroFicha} />{erroFicha && <Button secondary onClick={() => setRevisaoFicha((v) => v + 1)}>Recarregar histórico</Button>}{carregandoFicha ? <p role="status">Carregando histórico de pesagens…</p> : animal && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="h2">Histórico de {animal.brinco}{animal.nome ? ` · ${animal.nome}` : ""}</h2><a className="text-sm underline" href={`/pecuaria/rebanho/animais/${animal.id}`}>Abrir ficha e ações do animal</a></div>
      <p className="my-3 text-sm text-ink-3">Todos os pesos registrados deste animal, independentemente da origem. Para registrar, corrigir ou excluir uma pesagem, abra sua ficha.</p>
      <TabelaFinanceira rotulo={`Pesagens de ${animal.brinco}`} itens={animal.historicoPesagens} chaveDe={(p) => p.id} colunas={[
        { chave: "data", titulo: "Data", principal: true, celula: (p) => formatarDataBR(p.data) },
        { chave: "peso", titulo: "Peso", celula: (p) => `${p.pesoKg.toLocaleString("pt-BR")} kg` },
        { chave: "tipo", titulo: "Tipo", celula: (p) => ROTULO_TIPO_PESAGEM[p.tipo] ?? p.tipo },
        { chave: "origem", titulo: "Origem", celula: (p) => p.origem === "BALANCA" ? "Balança" : "Manual" },
        { chave: "observacao", titulo: "Observação", celula: (p) => p.observacao ?? "—" },
      ]} />{!animal.historicoPesagens.length && <p className="mt-3">Nenhuma pesagem registrada para este animal.</p>}
    </>}</Panel>}
    {!animalId && <p className="mt-5 text-sm text-ink-3">Escolha um animal para ver todas as suas pesagens.</p>}
  </PaginaFinanceira>;
}
