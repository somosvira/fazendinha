import { Bookmark, ChevronDown, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { dataHoraISO } from "./CampoDataIatf";
import { MensagemAvisoAptidao } from "./MensagemAvisoAptidao";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { usePropriedades } from "../../../api/propriedades";
import { useEffect, useState } from "react";
import { getHojeISO } from "../../../lib/hoje";
import { Button, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { criteriosVazios, validarCriterios, enumerados } from "./EditorSelecaoVisita";
import { TemplatesSelecaoProgramacao } from "./TemplatesSelecaoProgramacao";
import { FiltrosSelecaoLivre } from "./FiltrosSelecaoLivre";
import { camposNumericos, camposValores, obterOpcoesSelecao, previaGrupo, type AnimalPlanner, type CriteriosSelecao, type OpcoesSelecao } from "./planner-api";
import { Paginacao } from "../ui";
import "./visitas-fluxo.css";

const animaisPorPagina = 10;

const atalhos = [
  ["Lote e categoria", "cadastro"],
  ["Situação reprodutiva", "reproducao"],
  ["DEL", "producao"],
  ["PEV e aptidão", "aptidao"],
  ["Protocolo ativo", "protocolos"],
] as const;

const rotulosFiltros = { ...camposNumericos, ...camposValores };

function FiltroAplicado({ nome, onRemover }: { nome: string; onRemover: () => void }) {
  return <button type="button" aria-label={`Remover filtro ${nome}`} onClick={onRemover}
    className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-left text-sm hover:bg-muted">
    {nome}<X size={15} className="shrink-0" aria-hidden />
  </button>;
}

const vazias: OpcoesSelecao = { lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] };
function criteriosComBusca(criterios: CriteriosSelecao, busca: string): CriteriosSelecao {
  const termo = busca.trim();
  if (!termo) return criterios;
  return {
    ...criterios,
    versao: 2,
    todas: [...criterios.todas, { tipo: "VALORES", campo: "BUSCA", valores: [termo] }],
  };
}

export function SelecaoAnimaisProgramacao({ propriedadeId, data, inicio, selecionados, onSelecionados, onIdentificados }: { propriedadeId: number; data: string; inicio?: string; selecionados: string[]; onSelecionados: (ids: string[]) => void; onIdentificados: (animais: AnimalPlanner[]) => void }) {
  const {data: sitios} = usePropriedades();
  const [criterios, setCriterios] = useState(criteriosVazios);
  const [categoriaInicial, setCategoriaInicial] = useState("cadastro");
  const [rascunho, setRascunho] = useState<CriteriosSelecao | null>(null);
  const [opcoes, setOpcoes] = useState(vazias);
  const [animais, setAnimais] = useState<AnimalPlanner[]>([]);
  const [pagina, setPagina] = useState(1), [total, setTotal] = useState(0);
  const [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [templatesAbertos, setTemplatesAbertos] = useState(false);
  const [templateAplicado, setTemplateAplicado] = useState("");
  const dataDasOpcoes = data || getHojeISO();
  const sitio = sitios.find(item => item.id === propriedadeId)?.nome ?? "Sítio selecionado";
  useEffect(() => { setPagina(1); }, [propriedadeId, data]);
  useEffect(() => { let vivo = true; void obterOpcoesSelecao(propriedadeId, dataDasOpcoes).then(o => { if (vivo) setOpcoes(o); }).catch(e => { if (vivo) setErro(String(e)); }); return () => { vivo = false; }; }, [propriedadeId, dataDasOpcoes]);
  useEffect(() => {
    if (!data) return;
    let vivo = true; setCarregando(true); setErro(null);
    const problema = validarCriterios(criterios);
    if (problema) { setErro(problema); setCarregando(false); return; }
    const timer = window.setTimeout(() => {
      const consulta = criteriosComBusca(criterios, busca);
      const argumentos: [string?] = inicio ? [dataHoraISO(inicio)] : [];
      void previaGrupo(propriedadeId, data, { origem: "LIVRE", nome: "Participantes do protocolo", criterios: consulta, tipo: "INICIAR_IATF", incluidosManualmente: [] }, pagina, animaisPorPagina, ...argumentos).then(p => { if (vivo) {
        const ultimaPagina = Math.max(1, Math.ceil(p.total / animaisPorPagina));
        if (pagina > ultimaPagina) { setPagina(ultimaPagina); return; }
        setAnimais(p.animais); setTotal(p.total); onIdentificados(p.animais); } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    }, 250);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [propriedadeId, data, inicio, criterios, busca, pagina, onIdentificados]);
  function abrirFiltros(categoria = "cadastro") {
    setCategoriaInicial(categoria);
    setRascunho(structuredClone(criterios));
  }

  function alternarAnimal({ animalId }: AnimalPlanner) {
    if (selecionados.includes(animalId)) {
      onSelecionados(selecionados.filter(id => id !== animalId));
    } else if (selecionados.length < 100) {
      onSelecionados([...selecionados, animalId]);
    }
  }

  function aplicarCriterios(novos: CriteriosSelecao, nome = "") {
    setCriterios(novos);
    setTemplateAplicado(nome);
    setPagina(1);
  }

  return <section className="grid gap-3" aria-label="Seleção de participantes">
    <header className="programacao-participantes-cabecalho">
      <h2>Participantes</h2>
      <Button secondary onClick={() => setTemplatesAbertos(true)}><Bookmark size={16} aria-hidden />Filtros salvos</Button>
    </header>
    {data && <div className="flex flex-wrap items-end gap-3"><label>Buscar animais<input className="block rounded-lg border p-2" type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} placeholder="Brinco ou nome" /></label><Button secondary onClick={() => abrirFiltros()}><SlidersHorizontal size={16} aria-hidden />Filtros dos animais</Button><strong className="ml-auto">{selecionados.length}/100 selecionados</strong></div>}
    {data && <div className="flex flex-wrap gap-2" aria-label="Filtros rápidos">
      {atalhos.map(([nome, categoria]) => <Button key={categoria} secondary className="!min-h-8 !px-2.5 !py-1"
        onClick={() => abrirFiltros(categoria)}>{nome}<ChevronDown size={14} aria-hidden /></Button>)}
    </div>}
    {(templateAplicado || criterios.todas.length > 0 || criterios.qualquer.length > 0) && (
      <div role="group" aria-label="Filtros aplicados" className="flex flex-wrap gap-2">
        {templateAplicado
          ? <FiltroAplicado nome={templateAplicado} onRemover={() => aplicarCriterios(criteriosVazios())} />
          : <>
            {criterios.todas.map((filtro, indice) => <FiltroAplicado key={`${filtro.campo}-${indice}`}
              nome={rotulosFiltros[filtro.campo]} onRemover={() => aplicarCriterios({
                ...criterios, todas: criterios.todas.filter((_, posicao) => posicao !== indice),
              })} />)}
            {criterios.qualquer.length > 0 && <FiltroAplicado nome="Condições alternativas"
              onRemover={() => aplicarCriterios({ ...criterios, qualquer: [] })} />}
          </>}
      </div>
    )}
    {!data && <p>Informe a data de início para consultar os animais no sítio.</p>}
    <ErrorBox erro={erro} />{data && carregando && <p role="status">Consultando animais na data de referência…</p>}
    {data && !carregando && !erro && <><TabelaFinanceira visualizacao="tabela" rotulo="Animais disponíveis" itens={animais} chaveDe={a=>a.animalId} onAbrir={alternarAnimal}
      classeLinha={a => selecionados.includes(a.animalId) ? "bg-accent" : ""} compacta cartaoComLinks colunas={[
      {chave:"selecao",titulo:"",celula:a=><Checkbox
        aria-label={`Selecionar ${a.brinco ?? a.nome ?? "animal"}`}
        checked={selecionados.includes(a.animalId)}
        disabled={!selecionados.includes(a.animalId) && selecionados.length >= 100}
        onClick={e => e.stopPropagation()}
        onCheckedChange={() => alternarAnimal(a)} />},
      {chave:"animal",titulo:"Animal",principal:true,celula:a=><span className="flex items-center gap-2">
        <span>{a.brinco ?? "Sem brinco"}<small className="block">{a.nome ?? "Sem nome"}</small></span>
        {a.impedimentoProgramacao && <Popover>
          <PopoverTrigger aria-label={`Aviso de aptidão de ${a.brinco ?? a.nome ?? "animal"}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-amber-100 p-0 text-amber-800 hover:bg-amber-200">
            <TriangleAlert size={14} aria-hidden />
          </PopoverTrigger>
          <PopoverContent aria-label="Aviso de aptidão" side="top" className="rounded-lg text-sm"
            onClick={e => e.stopPropagation()}>
            <p><MensagemAvisoAptidao mensagem={a.impedimentoProgramacao} /></p>
            {a.impedimentoProgramacao.includes("Condição sanitária: ") && (
              <a className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}
                href={`/pecuaria/rebanho/animais/${encodeURIComponent(a.animalId)}?sitio=${propriedadeId}#sanidade`}
                target="_blank" rel="noopener noreferrer">
                Ver condição
              </a>
            )}
          </PopoverContent>
        </Popover>}
      </span>},
      {chave:"lote",titulo:"Lote",celula:a=>a.lote?.nome??"Sem lote"},
      {chave:"categoria",titulo:"Categoria",celula:a=>a.categoria?.nome??"Não informada"},
      {chave:"situacao",titulo:"Situação reprodutiva",celula:a=>enumerados.SITUACAO?.find(o=>o.id===a.situacao)?.nome??"Não informada"},
      {chave:"del",titulo:"DEL",celula:a=>a.del ?? "—"},
      {chave:"pev",titulo:"PEV",celula:a=>enumerados.PEV?.find(o=>o.id===a.situacaoPev)?.nome ?? "—"},
      {chave:"aptidao",titulo:"Aptidão",celula:a=>enumerados.APTIDAO_REPRODUTIVA?.find(o=>o.id===a.aptidaoReprodutiva)?.nome ?? "—"},
    ]}/>{total > animaisPorPagina && <Paginacao paginaAtual={pagina}
      totalPaginas={Math.ceil(total / animaisPorPagina)} totalItens={total} itensPorPagina={animaisPorPagina}
      onPaginaChange={setPagina} rotulo="animais" idSelect="pagina-selecao-programacao" />}</>}
    {rascunho && <PainelCadastro aberto largura="sm:max-w-5xl" titulo="Filtros dos animais" onFechar={() => setRascunho(null)} rodape={<><Button secondary className="sm:mr-auto" onClick={() => setRascunho(criteriosVazios())}>Limpar filtros</Button><Button secondary onClick={() => setRascunho(null)}>Cancelar</Button><Button onClick={() => { const problema = validarCriterios(rascunho); if (problema) { setErro(problema); return; } aplicarCriterios(rascunho); setRascunho(null); }}>Aplicar filtros</Button></>}><FiltrosSelecaoLivre criterios={rascunho} onMudar={setRascunho} opcoes={opcoes} data={data} contexto="programacao" sitio={sitio} categoriaInicial={categoriaInicial} /></PainelCadastro>}
    {templatesAbertos && <TemplatesSelecaoProgramacao key={propriedadeId} propriedadeId={propriedadeId}
      criteriosAtuais={criteriosComBusca(criterios, busca)} opcoes={opcoes}
      onFechar={() => setTemplatesAbertos(false)}
      onAplicar={(novos, nome) => {
        aplicarCriterios(novos, nome);
        setBusca("");
        setTemplatesAbertos(false);
      }} />}
  </section>;
}
