import "./ficha-geral.css";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { revelarSecao } from "../components/SecaoRecolhivel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./rotinas-aprovadas.css";
import { SubTabs } from "@/components/SubTabs";
import { HistoricoAnimalVisual } from "./HistoricoAnimalVisual";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { ResumoAlertas } from "../alertas/ResumoAlertas";
import { AcompanhamentoBezerreiro } from "../bezerreiro/AcompanhamentoBezerreiro";
import { useConsultaBezerreiro } from "../bezerreiro/ui";
import type { AcompanhamentoAnimal } from "../bezerreiro/types";
import { linkFichaAnimal, linkFichaLote } from "../lib/navegacao";
// Ficha por domínio; os painéis permanecem montados para preservar rascunhos.
// Ações principais no cabeçalho; alterações secundárias em Mais ações.
// Finalidade representa FinalidadeAnimal; o papel reprodutivo tem histórico próprio.

import { useCallback, useEffect, useRef, useState } from "react";
import { HeartPulse, History, GitBranch, Milk, Leaf, Plus, ArchiveX, ArrowLeft, Baby, CalendarDays, Dna, Hash, Home, IdCard, LogIn, MapPin, Mars, Nfc, Scale, Target, Venus } from "lucide-react";
import { fracaoReduzida } from "../lib/composicao";
import {
  buscarComposicaoSugerida, buscarFichaAnimal, darBaixaAnimal, desfazerDestinoAnimal, desfazerLocalizacaoAnimal,
  estornarBaixaAnimal, excluirPesagem, listarCategorias, listarFilhosAnimal, listarMovimentacoes, obterCatalogos,
  RebanhoApiError, removerCategoriaManual, substituirComposicaoAnimal,
} from "../api";
import type { AnimalFicha, CategoriaDTO, Catalogos, ComposicaoSugerida, FilhoResumo, PeriodoGmd, Pesagem } from "../types";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloPapelReprodutivo, rotuloSituacao, rotuloTipoBaixa } from "../lib/rotulos";
import { PERIODO_GMD_PADRAO } from "../lib/peso";
import { CategoriaPill, DadoFicha, ModalMotivo, useAoMovimentarComToast } from "../ui";
import { FormDadosAnimal } from "../forms/FormDadosAnimal";
import { FormComposicao } from "../forms/FormComposicao";
import { FormFiliacao } from "../forms/FormFiliacao";
import { FormMovimentar } from "../forms/FormMovimentar";
import { FormDestino } from "../forms/FormDestino";
import { FormAlterarCategoria } from "../forms/FormAlterarCategoria";
import { FormPesagem } from "../forms/FormPesagem";
import { FormBaixa } from "../forms/FormBaixa";
import { FormBaixaHistorica } from "../forms/FormBaixaHistorica";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Loader } from "../../../components/Loading";
import { Button, ErrorBox, hoje, PageHeader, PaginaFinanceira, Pill } from "../../../financeiro/financeiro-ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { PesoEGanho } from "../components/PesoEGanho";
import { HistoricoBaixas } from "../components/HistoricoBaixas";
import { SecaoFicha } from "../components/SecaoRecolhivel";
import { QualidadeAnimalLeite } from "../leite/QualidadeAnimalLeite";
import { HistoricoProdutivoLeite } from "../leite/HistoricoProdutivoLeite";
import { HistoricoMovimentacoes } from "../components/HistoricoMovimentacoes";
import { DetalheMovimentacao } from "../components/DetalheMovimentacao";
import { SanidadeAnimal } from "../sanidade/SanidadeAnimal";
import { ManejoAnimal } from "../manejo/ManejoAnimal";
import { IdentificarCria } from "../reproducao/IdentificarCria";
import { ReproducaoAnimal } from "../reproducao/Reproducao";
import { StatusOperacionaisAnimal } from "../components/StatusOperacionaisAnimal";
import { SinaisClinicosAnimal } from "../components/SinaisClinicosAnimal";
import type { CarenciaAnimal } from "../sanidade/api";
import { NutricaoAnimal } from "../nutricao/NutricaoAnimal";

const ABAS_FICHA = [["geral", "Geral"], ["producao", "Produção"], ["reproducao", "Reprodução"], ["sanidade", "Sanidade"], ["nutricao", "Nutrição"], ["bezerreiro", "Bezerreiro"]] as const;
const ICONES_FICHA = {geral: IdCard, producao: Milk, reproducao: GitBranch, sanidade: HeartPulse, nutricao: Leaf, bezerreiro: Baby, cadastro: IdCard};
function secaoDaUrl() {
  const hash = window.location.hash.slice(1);
  if (["resumo", "cadastro", "historico", "auditoria", "identificacao-genetica", "categoria", "peso", "peso-manejo"].includes(hash)) return "geral";
  if (hash === "producao-leite") return "producao";
  return ABAS_FICHA.some(([id]) => id === hash) ? hash : "geral";
}
const destinoGeral = (hash: string) => ({ resumo: "peso", "peso-manejo": "peso", cadastro: "cadastro", categoria: "cadastro", "identificacao-genetica": "identificacao-genetica", historico: "historico", auditoria: "historico" }[hash] ?? hash);

/** Nome/brinco de mãe ou pai na seção Filiação — link para a ficha quando é animal nosso,
 *  selo "externo" quando é genitor de fora. */
function LadoFiliacao({ lado, vazio }: { lado: AnimalFicha["filiacao"]["mae"]; vazio: string }) {
  if (!lado) return <span className="text-ink-3">{vazio}</span>;
  if (lado.tipo === "ANIMAL") return <span className="inline-flex items-center gap-2">
    <button type="button" onClick={() => navegarPara(linkFichaAnimal(lado.id))} className="break-words font-semibold text-mast hover:underline">{lado.brinco}{lado.nome ? ` — ${lado.nome}` : ""}</button>
    {lado.baixado && <Pill tone="neutral">Baixado</Pill>}
  </span>;
  return <span className="inline-flex items-center gap-2 break-words">{lado.nome}<Pill tone="brown">Externo</Pill></span>;
}

/** Nome do lote como link para a página do lote — usado no cabeçalho e no histórico de localização.
 *  Nenhuma das duas linhas onde aparece tem `onClick` no `<tr>`/container, então não precisa de stopPropagation. */
function LinkLote({ id, nome }: { id: string; nome: string }) {
  return <button type="button" onClick={() => navegarPara(linkFichaLote(id))} className="break-words font-semibold text-mast hover:underline">{nome}</button>;
}



export function DetalheAnimal({ id, onVoltar, podeLancar = true, rotuloVoltar = "Animais" }: { id: string; onVoltar: () => void; podeLancar?: boolean; rotuloVoltar?: string }) {
  const [situacaoReprodutiva, setSituacaoReprodutiva] = useState<string | null>(null);
  const visualHistorico = useVisualizacaoConsulta("visualHistoricoAnimal", "rebanho");
  const [carenciaResumo, setCarenciaResumo] = useState<CarenciaAnimal | null>(null);
  useEffect(() => { setSituacaoReprodutiva(null); setCarenciaResumo(null); }, [id]);
  const [identificandoCria,setIdentificandoCria]=useState(false);
  const sitioDaUrl = () => { const valor = Number(new URLSearchParams(window.location.search).get("sitio")); return Number.isSafeInteger(valor) && valor > 0 ? valor : undefined; };
  const [sitioConsulta, setSitioConsulta] = useState(sitioDaUrl);
  const [secaoAtiva, setSecaoAtiva] = useState(secaoDaUrl);
  const selecionarSecao = (secao: string) => {
    const destino = destinoGeral(secao);
    setSecaoAtiva(["cadastro", "identificacao-genetica", "peso", "historico"].includes(destino) ? "geral" : secao);
    const url = new URL(window.location.href); url.hash = secao;
    if (window.location.hash !== url.hash) window.history.pushState(window.history.state, "", url.pathname + url.search + url.hash);
    if (["cadastro", "identificacao-genetica", "peso", "historico"].includes(destino)) requestAnimationFrame(() => revelarSecao(destino));
  };
  useEffect(() => {
    const atualizar = () => { setSecaoAtiva(secaoDaUrl()); setSitioConsulta(sitioDaUrl()); };
    window.addEventListener("hashchange", atualizar); window.addEventListener("popstate", atualizar);
    return () => { window.removeEventListener("hashchange", atualizar); window.removeEventListener("popstate", atualizar); };
  }, []);
  const [categoriaDetalhe, setCategoriaDetalhe] = useState(false);
  const [historicosDetalhe, setHistoricosDetalhe] = useState(false);
  const [baixasDetalhe, setBaixasDetalhe] = useState(false);
  const [manejoDetalhe, setManejoDetalhe] = useState(false);
  const [erroFilhos, setErroFilhos] = useState<string | null>(null);
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  useEffect(() => {
    if (!acoesAbertas) return;
    const trigger = document.getElementById("acoes-animal-trigger");
    const painel = document.getElementById("acoes-secundarias-animal");
    painel?.querySelector<HTMLButtonElement>("button")?.focus();
    const fechar = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAcoesAbertas(false); trigger?.focus(); }
    };
    const fora = (event: PointerEvent) => {
      if (event.target instanceof Node && !painel?.contains(event.target) && !trigger?.contains(event.target)) setAcoesAbertas(false);
    };
    document.addEventListener("keydown", fechar);
    document.addEventListener("pointerdown", fora);
    return () => { document.removeEventListener("keydown", fechar); document.removeEventListener("pointerdown", fora); };
  }, [acoesAbertas]);

  const [animal, setAnimal] = useState<AnimalFicha | null>(null);
  useEffect(() => {
    if (animal?.id !== id) return;
    setSecaoAtiva(secaoDaUrl());
  }, [id, animal?.id]);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDTO[]>([]);
  const [periodoGmd, setPeriodoGmd] = useState<PeriodoGmd>(PERIODO_GMD_PADRAO);
  /* sobe a cada carregar()/ação bem-sucedida — recomeça a paginação da auditoria e do
   * histórico de movimentações (ambos buscam a própria página, ver components/) */
  const [refreshToken, setRefreshToken] = useState(0);
  const [movimentacaoAbertaId, setMovimentacaoAbertaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  const [editandoDados, setEditandoDados] = useState(false);
  const [editandoComposicao, setEditandoComposicao] = useState(false);
  const [definindoFiliacao, setDefinindoFiliacao] = useState(false);
  const [filhos, setFilhos] = useState<FilhoResumo[] | null>(null);
  const [sugestaoComposicao, setSugestaoComposicao] = useState<ComposicaoSugerida | null>(null);
  const [calculandoSugestao, setCalculandoSugestao] = useState(false);
  const [aplicandoSugestao, setAplicandoSugestao] = useState(false);
  const [movimentando, setMovimentando] = useState(false);
  const [mudandoDestino, setMudandoDestino] = useState(false);
  const [alterandoCategoria, setAlterandoCategoria] = useState(false);
  const [voltandoAutomatico, setVoltandoAutomatico] = useState(false);
  const [pesagemForm, setPesagemForm] = useState<{ modo: "novo" } | { modo: "editar"; pesagem: Pesagem } | null>(null);
  const [dandoBaixa, setDandoBaixa] = useState(false);
  const [baixaHistorica, setBaixaHistorica] = useState<{ baixa?: AnimalFicha["historicoBaixas"][number] } | null>(null);
  const [estornandoBaixa, setEstornandoBaixa] = useState(false);
  const [excluindoCadastro, setExcluindoCadastro] = useState(false);
  const [desfazendoLocalizacao, setDesfazendoLocalizacao] = useState(false);
  const [desfazendoDestino, setDesfazendoDestino] = useState(false);
  const [excluindoPesagem, setExcluindoPesagem] = useState<Pesagem | null>(null);
  const [emAcao, setEmAcao] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const dialogoAberto = Boolean(categoriaDetalhe || historicosDetalhe || baixasDetalhe || manejoDetalhe || identificandoCria || editandoDados || editandoComposicao || definindoFiliacao || movimentando || mudandoDestino || alterandoCategoria || voltandoAutomatico || pesagemForm || dandoBaixa || baixaHistorica || estornandoBaixa || excluindoCadastro || desfazendoLocalizacao || desfazendoDestino || excluindoPesagem);
  const haviaDialogo = useRef(false);
  useEffect(() => {
    const devolver = haviaDialogo.current && !dialogoAberto;
    haviaDialogo.current = dialogoAberto;
    if (!devolver) return;
    // A opção do submenu deixa de existir ao abrir o formulário. Nesse caso,
    // devolve ao acionador estável, respeitando destinos explícitos do diálogo.
    const quadro = requestAnimationFrame(() => {
      if (document.activeElement === document.body) document.getElementById("acoes-animal-trigger")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(quadro);
  }, [dialogoAberto]);

  const tocar = useCallback(() => setRefreshToken((t) => t + 1), []);
  const consultaFicha = useRef(0);
  useEffect(() => { setAnimal(null); return () => { consultaFicha.current += 1; }; }, [id, sitioConsulta]);
  // periodoGmd entra na busca da ficha: trocar o seletor da seção "Peso e ganho" refaz este fetch
  const carregar = useCallback(async () => {
    const consulta = ++consultaFicha.current;
    try {
      setErro(null); setIndisponivel(false);
      const ficha = sitioConsulta != null ? await buscarFichaAnimal(id, { periodoDias: periodoGmd }, sitioConsulta) : await buscarFichaAnimal(id, { periodoDias: periodoGmd });
      if (consulta !== consultaFicha.current) return;
      setAnimal(ficha);
      tocar();
    } catch (e) {
      if (consulta !== consultaFicha.current) return;
      setIndisponivel(e instanceof RebanhoApiError && e.status === 404);
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [id, periodoGmd, tocar, sitioConsulta]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (animal?.sexo === "M" && ["reproducao", "producao"].includes(secaoAtiva)) setSecaoAtiva("geral"); }, [animal?.sexo, secaoAtiva]);
  useEffect(() => { obterCatalogos().then(setCatalogos).catch(() => undefined); }, []);
  useEffect(() => { listarCategorias().then((r) => setCategorias(r.itens)).catch(() => undefined); }, []);
  useEffect(() => {
    let vigente = true;
    setFilhos(null); setErroFilhos(null);
    if (animal && animal.filhosCount > 0) listarFilhosAnimal(id).then(r => { if(vigente) setFilhos(r); }).catch(e => { if(vigente) setErroFilhos(e instanceof Error ? e.message : "Não foi possível consultar os filhos."); });
    return () => { vigente = false; };
  }, [id, animal?.filhosCount, refreshToken]);
  useEffect(() => {
    if (!animal || secaoAtiva !== "geral") return;
    const abrir = () => { const destino = destinoGeral(window.location.hash.slice(1)); if (["cadastro", "identificacao-genetica", "peso", "historico"].includes(destino)) requestAnimationFrame(() => revelarSecao(destino)); };
    abrir(); window.addEventListener("hashchange", abrir); window.addEventListener("popstate", abrir);
    return () => { window.removeEventListener("hashchange", abrir); window.removeEventListener("popstate", abrir); };
  }, [animal?.id, secaoAtiva]);
  const aoMovimentar = useAoMovimentarComToast(carregar);

  const calcularComposicaoPelosGenitores = async () => {
    setCalculandoSugestao(true); setErroAcao(null);
    try { setSugestaoComposicao(await buscarComposicaoSugerida(id)); }
    catch (e) { setErroAcao(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
    finally { setCalculandoSugestao(false); }
  };

  const aplicarComposicaoSugerida = async () => {
    if (!sugestaoComposicao) return;
    setAplicandoSugestao(true); setErroAcao(null);
    try {
      await substituirComposicaoAnimal(id, { itens: sugestaoComposicao.itens.map((i) => ({ racaId: i.racaId, fracao64: i.fracao64 })), origem: "CALCULADA" });
      setSugestaoComposicao(null);
      await carregar();
    } catch (e) { setErroAcao(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
    finally { setAplicandoSugestao(false); }
  };
  const carregarMovimentacoes = useCallback((pagina: number) => listarMovimentacoes({ animalId: id, incluirDesfeitas: true, page: pagina, pageSize: 20 }), [id]);

  const sitioBezerreiro = sitioConsulta ?? getPropriedadeAtiva() ?? animal?.historicoLocalizacoes.find(l => l.ate == null)?.propriedade?.id ?? animal?.historicoLocalizacoes[0]?.propriedade?.id ?? null;
  const bezerreiro = useConsultaBezerreiro<AcompanhamentoAnimal>(animal ? `/animais/${id}/acompanhamento` : null, sitioBezerreiro, refreshToken);
  useEffect(() => { if (secaoAtiva === "bezerreiro" && bezerreiro.dados?.temHistorico === false) setSecaoAtiva("geral"); }, [secaoAtiva, bezerreiro.dados]);

  if (!animal) return <PaginaFinanceira><nav aria-label="Navegação" className="pec-breadcrumb"><button type="button" onClick={onVoltar}>{rotuloVoltar}</button></nav><PageHeader titulo="Animal" /><div className="rebanho-carregamento">
    {indisponivel ? <section className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5" aria-labelledby="animal-indisponivel">
      <h1 id="animal-indisponivel" className="text-xl font-semibold">{getPropriedadeAtiva() == null ? "Animal não encontrado" : "Animal não disponível no sítio selecionado"}</h1>
      <p className="text-ink-3">{getPropriedadeAtiva() == null ? "Volte à lista para localizar um animal disponível." : "Confira o sítio no seletor lateral ou volte à lista de animais deste sítio."}</p>
      <Button secondary onClick={onVoltar}><ArrowLeft size={17} aria-hidden="true"/>Voltar para {rotuloVoltar.toLocaleLowerCase("pt-BR")}</Button>
    </section> : <><Button secondary onClick={onVoltar} className="mt-6"><ArrowLeft size={17} aria-hidden="true"/>Voltar para {rotuloVoltar.toLocaleLowerCase("pt-BR")}</Button><ErrorBox erro={erro}/>{!erro && <Loader label="Carregando animal"/>}</>}
  </div></PaginaFinanceira>;

  const ativo = animal.situacao === "ATIVO";
  // a atual é a linha aberta; para quem saiu, a última fechada
  const localizacaoAtual = animal.historicoLocalizacoes.find((l) => l.ate == null) ?? animal.historicoLocalizacoes[0] ?? null;

  const executar = async (fn: () => Promise<AnimalFicha | void>, aoTerminar: () => void) => {
    if (emAcao) return;
    setEmAcao(true); setErroAcao(null);
    try {
      const atualizado = await fn();
      if (atualizado) { setAnimal(atualizado); tocar(); }
      else await carregar();
      aoTerminar();
    } catch (e) { setErroAcao(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
    finally { setEmAcao(false); }
  };

  const excluirPesagemConfirmada = async () => {
    if (!excluindoPesagem) return;
    await executar(async () => { await excluirPesagem(excluindoPesagem.id); }, () => setExcluindoPesagem(null));
  };

  const categoriaRegra = animal.categoria ? categorias.find((c) => c.id === animal.categoria?.id) : undefined;
  const categoriaCalculadaRegra = animal.categoriaCalculada ? categorias.find((c) => c.id === animal.categoriaCalculada?.id) : undefined;
  const manualAberta = animal.categoriaOrigem === "MANUAL" ? animal.historicoCategoriasManuais.find((h) => h.ate == null) ?? null : null;
  const composicaoOrdenada = [...animal.composicao].sort((a, b) => b.fracao64 - a.fracao64);
  const somaComposicao = animal.composicao.reduce((total, item) => total + item.fracao64, 0);

  const acoesCabecalho = podeLancar && <div className="flex max-w-full flex-wrap gap-2 lg:max-w-[560px] lg:justify-end">
          {ativo ? <>
            {animal.identificacaoProvisoria && <Button secondary onClick={()=>setIdentificandoCria(true)}>Completar identificação</Button>}


            <div className="relative ficha-animal-menu">
              <button type="button" aria-expanded={acoesAbertas} id="acoes-animal-trigger" aria-controls={acoesAbertas ? "acoes-secundarias-animal" : undefined} onClick={() => setAcoesAbertas((abertas) => !abertas)} className="min-h-10 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-2">Mais ações</button>
              {acoesAbertas && <div id="acoes-secundarias-animal" className="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-lg">
                <Button secondary onClick={() => { setAcoesAbertas(false); setMovimentando(true); }}>Movimentar</Button>
                <Button secondary onClick={() => { setAcoesAbertas(false); setManejoDetalhe(true); }}>Desmama e castração</Button>
                {secaoAtiva !== "geral" && <Button secondary onClick={() => { setAcoesAbertas(false); setPesagemForm({ modo: "novo" }); }}>Registrar pesagem</Button>}
                <Button secondary onClick={() => { setAcoesAbertas(false); setDefinindoFiliacao(true); }}>Definir filiação</Button>
                <Button secondary onClick={() => { setAcoesAbertas(false); setMudandoDestino(true); }}>Mudar finalidade</Button>
                {animal.historicoLocalizacoes.length >= 2 && <Button secondary onClick={() => { setAcoesAbertas(false); setErroAcao(null); setDesfazendoLocalizacao(true); }}>Desfazer última movimentação</Button>}
                {animal.historicoDestinos.length >= 2 && <Button secondary onClick={() => { setAcoesAbertas(false); setErroAcao(null); setDesfazendoDestino(true); }}>Desfazer última mudança</Button>}
                <Button secondary onClick={() => { setAcoesAbertas(false); setAlterandoCategoria(true); }}>Alterar categoria</Button>
                {animal.categoriaOrigem === "MANUAL" && <Button secondary onClick={() => { setAcoesAbertas(false); setErroAcao(null); setVoltandoAutomatico(true); }}>Voltar ao automático</Button>}
                {secaoAtiva !== "geral" && <Button secondary onClick={() => { setAcoesAbertas(false); setEditandoDados(true); }}>Editar dados</Button>}
                <Button secondary onClick={() => { setAcoesAbertas(false); setEditandoComposicao(true); }}>Editar composição</Button>
                <Button secondary onClick={() => { setAcoesAbertas(false); setBaixaHistorica({}); }}>Regularizar baixa histórica</Button>
                <Button danger onClick={() => { setAcoesAbertas(false); setDandoBaixa(true); }}>Dar baixa</Button>
                <Button danger onClick={() => { setAcoesAbertas(false); setExcluindoCadastro(true); }}>Excluir cadastro</Button>
              </div>}
            </div>
          </> : <Button onClick={() => { setErroAcao(null); setEstornandoBaixa(true); }}>Estornar baixa</Button>}
        </div>;
  return <PaginaFinanceira>
    <nav aria-label="Navegação" className="pec-breadcrumb">{rotuloVoltar !== "Rebanho" && <><button type="button" onClick={() => navegarPara("/pecuaria/rebanho")}>Rebanho</button><span aria-hidden="true">/</span></>}<button type="button" onClick={onVoltar}>{rotuloVoltar}</button><span aria-hidden="true">/</span><span aria-current="page">{animal.brinco}</span>{new URLSearchParams(window.location.search).has("participacaoId") && new URLSearchParams(window.location.search).get("retorno")?.startsWith("/pecuaria/") && <a className="underline" href={new URLSearchParams(window.location.search).get("retorno")!} onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara(new URLSearchParams(window.location.search).get("retorno")!); } }}>Voltar ao protocolo</a>}</nav>
    {erro && <div className="mt-3"><ErrorBox erro={erro} /></div>}
    <article className="pec-ficha ficha-v4 ficha-animal-geral">
    <div className="ficha-animal-cabecalho">
      <img className="ficha-animal-ilustracao" src="/images/pecuaria/vaca.png" width={110} height={110} alt="Ilustração genérica de bovino" />
      <div className="ficha-animal-identidade">
      <PageHeader integrado
        titulo={<><span className="ficha-animal-nome">{animal.nome ?? animal.brinco}</span>{animal.nome && <span className="ficha-brinco">#{animal.brinco}</span>}</>}
        descricao={`${animal.propriedade?.nome ?? "Sem sítio"} · ${animal.lote?.nome ?? "Sem lote"}`}
      >          {animal.categoriaOrigem === "MANUAL" && animal.categoriaCalculada?.id === animal.categoria?.id && <p className="mt-2 text-sm text-ink-3">O cálculo já concorda — pode voltar ao automático.</p>}</PageHeader>

      </div>
      <div className="ficha-animal-acoes">{acoesCabecalho}{(!podeLancar || !ativo) && <Button secondary onClick={() => setManejoDetalhe(true)}>Desmama e castração</Button>}</div>
    <div className="ficha-status">
            {!ativo && <Pill tone="neutral">Baixado</Pill>}
            {animal.identificacaoProvisoria && <Pill tone="amber">Brinco pendente · cadastro provisório</Pill>}
            <CategoriaPill categoria={animal.categoria} categoriaOrigem={animal.categoriaOrigem} categoriaCalculada={animal.categoriaCalculada} />
            {animal.aptidao && <Pill tone="brown">{rotuloAptidao(animal.aptidao)}{!ativo && " · na baixa"}</Pill>}
            {animal.papelReprodutivo && animal.papelReprodutivo !== "NENHUM" && <Pill tone="amber">{rotuloPapelReprodutivo(animal.papelReprodutivo)}{!ativo && " · na baixa"}</Pill>}
            <StatusOperacionaisAnimal animalId={animal.id} propriedadeId={localizacaoAtual?.propriedade?.id??null} revisao={refreshToken}/>
            <SinaisClinicosAnimal situacao={animal.sexo === "F" ? situacaoReprodutiva : null} carencia={carenciaResumo} />
          </div>
      {!ativo && animal.baixa && <div role="status" className="ficha-baixa-resumo">
        <ArchiveX size={18} aria-hidden="true" />
        <div><strong>Animal baixado · {rotuloTipoBaixa(animal.baixa.tipo)} em {formatarDataBR(animal.baixa.data)}</strong>
          <p>Dados referentes à baixa; registros posteriores indisponíveis. Motivo, observações e autoria em <button type="button" onClick={() => selecionarSecao("historico")}>Histórico</button>.</p>
        </div>
      </div>}

    </div>
    <ResumoAlertas animalId={animal.id} propriedadeId={sitioConsulta ?? localizacaoAtual?.propriedade?.id} revisao={refreshToken} />
    <SubTabs ariaLabel="Seções da ficha" tabs={ABAS_FICHA.filter(([ancora]) => (ancora !== "bezerreiro" || !!bezerreiro.dados?.temHistorico) && (!["reproducao", "producao"].includes(ancora) || animal.sexo === "F")).map(([id, label]) => ({ id, label, icon: ICONES_FICHA[id] }))} active={secaoAtiva} onSelect={selecionarSecao} idDaAba={aba => `aba-${aba}`} idDoPainel={aba => `ficha-painel-${aba}`} />
    {secaoAtiva === "bezerreiro" && !bezerreiro.dados && <div className="p-5" role={bezerreiro.erro ? "alert" : "status"}>{bezerreiro.erro || "Consultando acompanhamento do bezerreiro…"}{bezerreiro.erro && <Button secondary onClick={bezerreiro.tentar}>Tentar novamente</Button>}</div>}
    {bezerreiro.dados?.temHistorico && sitioBezerreiro != null && <section id="ficha-painel-bezerreiro" role="tabpanel" aria-labelledby="aba-bezerreiro" hidden={secaoAtiva !== "bezerreiro"}>{<AcompanhamentoBezerreiro animalId={animal.id} sitio={sitioBezerreiro} podeLancar={podeLancar} revisao={refreshToken} embutido dadosIniciais={bezerreiro.dados}/>}</section>}
    <div id="ficha-painel-geral" role="tabpanel" aria-labelledby="aba-geral" hidden={secaoAtiva !== "geral"} className="ficha-geral">
      <SecaoGeralAnimal id="cadastro" icon={IdCard} titulo="Identificação" acao={podeLancar && ativo ? <Button secondary onClick={() => setEditandoDados(true)}>Editar dados</Button> : undefined}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DadoFicha icon={Nfc} rotulo="Brinco eletrônico">{animal.brincoEletronico ?? "—"}</DadoFicha>
          <DadoFicha icon={Hash} rotulo="SISBOV">{animal.sisbov ?? "—"}</DadoFicha>
          <DadoFicha icon={animal.sexo === "F" ? Venus : Mars} rotulo="Sexo">{animal.sexo === "F" ? "Fêmea" : "Macho"}</DadoFicha>
          <DadoFicha icon={Home} rotulo="Origem">{animal.origem === "NASCIDO" ? "Nascido na propriedade" : "Comprado"}</DadoFicha>
          <DadoFicha icon={CalendarDays} rotulo="Nascimento">{formatarDataBR(animal.dataNascimento)}{animal.nascimentoEstimado ? " (estimado)" : ""}</DadoFicha>
          <DadoFicha icon={CalendarDays} rotulo={animal.idadeNaBaixa ? "Idade na baixa" : "Idade"}>{formatarIdade(animal.idadeMeses)}</DadoFicha>
          <DadoFicha icon={LogIn} rotulo="Entrada">{formatarDataBR(animal.dataEntrada)}</DadoFicha>
          {animal.sexo === "F" && <DadoFicha icon={Baby} rotulo="Partos antes da entrada">{animal.partosAntesDaEntrada}</DadoFicha>}
          <DadoFicha icon={Target} rotulo="Finalidade">{rotuloAptidao(animal.aptidao)}</DadoFicha>
          <DadoFicha icon={GitBranch} rotulo="Papel reprodutivo">{animal.papelReprodutivoEstado === "CONFLITO" ? "Evidências conflitantes" : rotuloPapelReprodutivo(animal.papelReprodutivo)}</DadoFicha>


        </dl>
        {animal.observacao && <div className="mt-4 border-t border-border pt-4"><h3 className="text-sm font-semibold">Observações do cadastro</h3><p className="mt-2 break-words text-sm text-ink-2">{animal.observacao}</p></div>}
<div className="ficha-categoria-localizacao">
  <section aria-label="Categoria"><dl><DadoFicha icon={Target} rotulo="Categoria"><CategoriaPill categoria={animal.categoria} categoriaOrigem={animal.categoriaOrigem} categoriaCalculada={animal.categoriaCalculada}/></DadoFicha></dl><Button secondary onClick={() => setCategoriaDetalhe(true)}>Categoria</Button></section>
  <section aria-label="Localização atual"><dl><DadoFicha icon={MapPin} rotulo={ativo ? "Localização atual" : "Localização na baixa"}>{localizacaoAtual?.propriedade?.nome ?? "Sem sítio"} · {localizacaoAtual?.lote ? <LinkLote id={localizacaoAtual.lote.id} nome={localizacaoAtual.lote.nome}/> : "Sem lote"}</DadoFicha></dl><Button secondary onClick={() => setHistoricosDetalhe(true)}>Ver histórico</Button></section>
</div>

      </SecaoGeralAnimal>

      <SecaoGeralAnimal id="identificacao-genetica" icon={Dna} titulo="Filiação e composição racial">
        <div className="ficha-genetica">
          <section aria-label="Filiação">
            <header className="ficha-subcabecalho"><h3>Filiação</h3>{podeLancar && ativo && <button type="button" className="ficha-botao-contorno" onClick={() => setDefinindoFiliacao(true)}>Definir filiação</button>}</header>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-ink-3">Mãe</dt><dd className="mt-1 text-sm"><LadoFiliacao lado={animal.filiacao.mae} vazio="Não informada" /></dd></div>
          <div><dt className="text-sm text-ink-3">Pai</dt><dd className="mt-1 text-sm"><LadoFiliacao lado={animal.filiacao.pai} vazio="Não informado" /></dd></div>
        </dl>
        {erroFilhos && <p role="alert">{erroFilhos}</p>}
        {animal.filhosCount > 0 && !filhos && !erroFilhos && <p role="status">Consultando filhos…</p>}
        {animal.filhosCount === 0 && <p className="mt-4 text-sm text-ink-3">Nenhum filho registrado.</p>}
        {filhos && filhos.length > 0 && <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Filhos ({filhos.length})</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {filhos.map((f) => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => navegarPara(linkFichaAnimal(f.id))} className="break-words font-semibold text-mast hover:underline">{f.brinco}{f.nome ? ` — ${f.nome}` : ""}</button>
              <span className="text-sm text-ink-3">{f.sexo === "F" ? "Fêmea" : "Macho"} · {formatarDataBR(f.dataNascimento)} · {rotuloSituacao(f.situacao)}</span>
            </li>)}
          </ul>
        </div>}
          </section>
          <section aria-label="Composição racial">
            <header className="ficha-subcabecalho"><h3>Composição racial</h3>{podeLancar && ativo && <button type="button" className="ficha-botao-contorno" onClick={() => setEditandoComposicao(true)}>Editar composição</button>}{podeLancar && ativo && (animal.filiacao.mae || animal.filiacao.pai) && <button type="button" disabled={calculandoSugestao} onClick={() => void calcularComposicaoPelosGenitores()} className="ficha-botao-contorno disabled:opacity-50">{calculandoSugestao ? "Calculando…" : "Calcular pelos genitores"}</button>}</header>
        {composicaoOrdenada.length ? <>
          <ul className="space-y-3.5 text-sm">{composicaoOrdenada.map((item) => <li key={item.racaId}>
            <div className="flex flex-wrap items-baseline justify-between gap-3"><span className="min-w-0 break-words">{item.nome} <span className="text-ink-3">({item.sigla})</span>{!item.racaAtiva && <span className="text-ink-3"> · inativa</span>}</span><span className="flex items-center gap-2"><strong className="shrink-0 tabular-nums">{fracaoReduzida(item.fracao64)}</strong><Pill tone={item.fracaoCalculada64 === item.fracao64 || item.origem === "CALCULADA" ? "blue" : "neutral"}>{item.fracaoCalculada64 > 0 && item.fracaoCalculada64 < item.fracao64 ? "Calculada + informada" : item.origem === "CALCULADA" ? "Calculada" : "Informada"}</Pill></span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true"><div className="h-full rounded-full bg-[var(--cafe)]" style={{ width: `${(item.fracao64 / 64) * 100}%` }} /></div>
          </li>)}</ul>
          {somaComposicao < 64 && <p className="mt-4 text-sm text-ink-3">Restante ({fracaoReduzida(64 - somaComposicao)}) sem raça informada.</p>}
        </> : <p className="text-sm text-ink-3">Sem composição racial informada.</p>}
          </section>
        </div>
      </SecaoGeralAnimal>
<SecaoGeralAnimal id="peso" icon={Scale} titulo="Peso" acao={podeLancar && ativo ? <Button onClick={() => setPesagemForm({ modo: "novo" })}><Plus size={17}/>Registrar pesagem</Button> : undefined}>
      <PesoEGanho
        animal={animal}
        periodo={periodoGmd}
        onPeriodoChange={setPeriodoGmd}
        podeLancar={podeLancar && ativo}
        onEditarPesagem={(pesagem) => setPesagemForm({ modo: "editar", pesagem })}
        onExcluirPesagem={(pesagem) => { setErroAcao(null); setExcluindoPesagem(pesagem); }}
      />
</SecaoGeralAnimal>
<SecaoGeralAnimal id="historico" icon={History} titulo="Histórico e auditoria" acao={<AlternarVisualizacaoConsulta {...visualHistorico} visual="Linha do tempo" rotulo="Visualização do histórico do animal"/>}>
<HistoricoAnimalVisual animal={animal} ativo={secaoAtiva === "geral"} revisao={refreshToken} modo={visualHistorico.modo}/>
{animal.historicoBaixas.length > 0 && <div className="mt-4"><Button secondary onClick={() => setBaixasDetalhe(true)}>Consultar baixa e autoria</Button></div>}
</SecaoGeralAnimal></div>
<Dialog open={categoriaDetalhe} onOpenChange={setCategoriaDetalhe}><DialogContent className="ficha-dialogo max-w-3xl" aria-describedby={undefined}><DialogHeader><DialogTitle>Categoria</DialogTitle></DialogHeader>      <section aria-label="Regra de categoria" className="mt-4 border-t border-border pt-4 text-sm">
        <h3 className="mb-2 font-semibold">Regra de categoria</h3>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {animal.categoriaOrigem === "AUTOMATICA" && <span className="text-ink-3">calculada pela regra{categoriaRegra?.regra ? ` "${categoriaRegra.regra}"` : " da fazenda"}{animal.idadeNaBaixa ? ", na data da baixa" : ""}.</span>}
            {animal.categoriaOrigem === "SEM_CATEGORIA" && <span className="text-ink-3">nenhuma regra ativa se aplica a este animal — ajuste as regras em Configurações › Pecuária › Categorias ou defina manualmente.</span>}
            {manualAberta && <span className="text-ink-3">definida manualmente desde {formatarDataBR(manualAberta.desde)} — {manualAberta.motivo}.</span>}
          </div>
          {animal.categoriaOrigem === "MANUAL" && <p className="mt-2 text-sm text-ink-3">Pelas regras seria {animal.categoriaCalculada ? `${animal.categoriaCalculada.nome}${categoriaCalculadaRegra?.regra ? ` (${categoriaCalculadaRegra.regra})` : ""}` : "Sem categoria"}.</p>}
        </div>
        {animal.historicoCategoriasManuais.length > 0 && <>
          <h3 className="mt-5 text-sm font-semibold uppercase tracking-wider text-ink-3">Trocas manuais</h3>
          <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm consulta-tabela"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Período</th><th className="py-1 pr-3 font-semibold">Categoria</th><th className="py-1 pr-3 font-semibold">Motivo</th><th className="py-1 pr-3 font-semibold">Motivo do encerramento</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoCategoriasManuais.map((h) => <tr key={h.id}><td className="py-1.5 pr-3 whitespace-nowrap">{formatarDataBR(h.desde)} – {h.ate ? formatarDataBR(h.ate) : "atual"}</td><td className="py-1.5 pr-3">{h.categoria.nome}</td><td className="py-1.5 pr-3 break-words">{h.motivo}</td><td className="py-1.5 pr-3 break-words">{h.motivoEncerramento ?? "—"}</td></tr>)}</tbody></table></div>
        </>}
      </section>{podeLancar && ativo && <div className="flex flex-wrap gap-2"><Button onClick={() => {setCategoriaDetalhe(false);setAlterandoCategoria(true);}}>Alterar categoria</Button>{animal.categoriaOrigem === "MANUAL" && <Button secondary onClick={() => {setCategoriaDetalhe(false);setVoltandoAutomatico(true);}}>Voltar ao automático</Button>}</div>}</DialogContent></Dialog>
<Dialog open={historicosDetalhe} onOpenChange={setHistoricosDetalhe}><DialogContent className="ficha-dialogo max-w-5xl" aria-describedby={undefined}><DialogHeader><DialogTitle>Histórico de movimentações</DialogTitle></DialogHeader>
  <HistoricoMovimentacoes visualizacao="tabela" carregar={carregarMovimentacoes} mostrarDirecao podeLancar={podeLancar} recarregarToken={refreshToken} onAbrir={mov => setMovimentacaoAbertaId(mov.id)} onMudou={() => { void carregar(); }}/>
</DialogContent></Dialog>
<Dialog open={baixasDetalhe} onOpenChange={setBaixasDetalhe}><DialogContent className="ficha-dialogo max-w-5xl" aria-describedby={undefined}><DialogHeader><DialogTitle>Baixa e autoria</DialogTitle></DialogHeader>
  <HistoricoBaixas historicoBaixas={animal.historicoBaixas} onRevisar={podeLancar ? baixa => { setBaixasDetalhe(false); setBaixaHistorica({ baixa }); } : undefined}/>
</DialogContent></Dialog>
<Dialog open={manejoDetalhe} onOpenChange={setManejoDetalhe}><DialogContent className="ficha-dialogo max-w-4xl" aria-describedby={undefined}><DialogHeader><DialogTitle>Desmama e castração</DialogTitle></DialogHeader><ManejoAnimal animalId={animal.id} propriedadeId={localizacaoAtual?.propriedade?.id ?? null} localizacoes={animal.historicoLocalizacoes} baixaData={animal.baixa?.data ?? null} podeLancar={podeLancar} onSalvo={() => { void carregar(); }}/></DialogContent></Dialog>
      {animal.sexo === "F" && <section id="ficha-painel-producao" role="tabpanel" aria-labelledby="aba-producao" hidden={secaoAtiva !== "producao"}>
        <SecaoFicha id="producao-leite" titulo="Produção individual" resumo="Controles nas datas aferidas; ausência de medição não é produção zero">
          <HistoricoProdutivoLeite animalId={animal.id} propriedadeId={localizacaoAtual?.propriedade?.id ?? null} recarregarToken={refreshToken} />
        </SecaoFicha>
        {secaoAtiva === "producao" && <QualidadeAnimalLeite key={animal.id} animalId={animal.id} propriedadeId={localizacaoAtual?.propriedade?.id ?? null} recarregarToken={refreshToken} />}
      </section>}
      {animal.sexo==="F"&&<section id="ficha-painel-reproducao" role="tabpanel" aria-labelledby="aba-reproducao" hidden={secaoAtiva !== "reproducao"} className="scroll-mt-6"><ReproducaoAnimal animalId={animal.id} propriedadeId={sitioConsulta ?? localizacaoAtual?.propriedade?.id ?? null} podeLancar={podeLancar} recarregarToken={refreshToken} onSituacao={setSituacaoReprodutiva} /></section>}
      <section id="ficha-painel-sanidade" role="tabpanel" aria-labelledby="aba-sanidade" hidden={secaoAtiva !== "sanidade"} className="scroll-mt-6">
      <SanidadeAnimal onCarencia={setCarenciaResumo} animalId={animal.id} propriedadeId={sitioConsulta ?? localizacaoAtual?.propriedade?.id ?? null} podeLancar={podeLancar} recarregarToken={refreshToken} onMudou={() => { void carregar(); }} />
      </section>
      <section id="ficha-painel-nutricao" role="tabpanel" aria-labelledby="aba-nutricao" hidden={secaoAtiva !== "nutricao"} className="scroll-mt-6">
      <NutricaoAnimal animalId={animal.id} recarregarToken={refreshToken} />

      </section>
    {identificandoCria && <IdentificarCria animalId={animal.id} propriedadeId={localizacaoAtual?.propriedade?.id??null} nomeInicial={animal.nome} onFechar={()=>setIdentificandoCria(false)} onSalvo={()=>{setIdentificandoCria(false);void carregar();}} />}
    </article>

    {editandoDados && <FormDadosAnimal animal={animal} onFechar={() => setEditandoDados(false)} onSalvo={async (atualizado) => { setAnimal(atualizado); tocar(); setEditandoDados(false); }} />}
    {editandoComposicao && catalogos && <FormComposicao animal={animal} racas={catalogos.racas} onFechar={() => setEditandoComposicao(false)} onSalvo={async () => { setEditandoComposicao(false); await carregar(); }} />}
    {definindoFiliacao && <FormFiliacao animal={animal} onFechar={() => setDefinindoFiliacao(false)} onSalvo={async (atualizado) => { setAnimal(atualizado); tocar(); setDefinindoFiliacao(false); }} />}
    {movimentando && catalogos && <FormMovimentar animais={[animal]} propriedades={catalogos.propriedades} lotes={catalogos.lotes} propriedadeInicial={animal.propriedade?.id} loteInicial={animal.lote?.id} onFechar={() => setMovimentando(false)} onSalvo={async (resultado) => { setMovimentando(false); await aoMovimentar(resultado); }} />}
    {mudandoDestino && <FormDestino animal={animal} onFechar={() => setMudandoDestino(false)} onSalvo={async (atualizado) => { setAnimal(atualizado); tocar(); setMudandoDestino(false); }} />}
    {alterandoCategoria && <FormAlterarCategoria
      animal={animal}
      categorias={categorias.filter((c) => c.ativo && c.sexo === animal.sexo && c.id !== animal.categoria?.id)}
      onFechar={() => setAlterandoCategoria(false)}
      onSalvo={async (atualizado) => { setAnimal(atualizado); tocar(); setAlterandoCategoria(false); }}
    />}
    {pesagemForm && <FormPesagem animalId={animal.id} pesagem={pesagemForm.modo === "editar" ? pesagemForm.pesagem : null} onFechar={() => setPesagemForm(null)} onSalvo={async () => { setPesagemForm(null); await carregar(); }} />}
    {baixaHistorica && catalogos && <FormBaixaHistorica animal={animal} baixa={baixaHistorica.baixa} motivos={catalogos.motivosBaixa} onFechar={() => setBaixaHistorica(null)} onSalvo={async () => { const ficha = await buscarFichaAnimal(animal.id, { periodoDias: periodoGmd }, sitioConsulta); setAnimal(ficha); tocar(); setBaixaHistorica(null); }} />}
    {dandoBaixa && catalogos && <FormBaixa animal={animal} motivos={catalogos.motivosBaixa} onFechar={() => setDandoBaixa(false)} onSalvo={async (atualizado) => { setAnimal(atualizado); tocar(); setDandoBaixa(false); }} />}

    {voltandoAutomatico && <ModalMotivo titulo="Voltar ao automático" eyebrow={`Animal ${animal.brinco}`} impacto={<p>O animal passa a ser {animal.categoriaCalculada?.nome ?? "Sem categoria"} pelo cálculo.</p>} labelManter="Manter categoria" labelConfirmar="Confirmar" confirmando={emAcao} erro={erroAcao} onFechar={() => setVoltandoAutomatico(false)} onConfirmar={(motivo) => { void executar(() => removerCategoriaManual(animal.id, { motivo }), () => setVoltandoAutomatico(false)); }} />}
    {estornandoBaixa && <ModalMotivo titulo="Estornar baixa" eyebrow={`Animal ${animal.brinco}`} labelManter="Manter baixa" labelConfirmar="Confirmar estorno" confirmando={emAcao} erro={erroAcao} onFechar={() => setEstornandoBaixa(false)} onConfirmar={(motivo) => { void executar(() => estornarBaixaAnimal(animal.id, { motivo }), () => setEstornandoBaixa(false)); }} />}
    {excluindoCadastro && <ModalMotivo titulo="Excluir cadastro" eyebrow={`Animal ${animal.brinco}`} impacto={<p>O animal receberá uma baixa do tipo "Cadastro indevido" e deixará de contar como ativo. Esta ação pode ser estornada depois, reabrindo o cadastro.</p>} labelManter="Manter cadastro" labelConfirmar="Excluir cadastro" confirmando={emAcao} erro={erroAcao} onFechar={() => setExcluindoCadastro(false)} onConfirmar={(motivo) => { void executar(() => darBaixaAnimal(animal.id, { data: hoje(), tipo: "CADASTRO_INDEVIDO", motivoId: null, observacao: motivo }), () => setExcluindoCadastro(false)); }} />}

    <ConfirmDialog open={desfazendoLocalizacao} title="Desfazer última movimentação?" message={<>{erroAcao && <p className="mb-2 text-red-700">{erroAcao}</p>}<p>A localização atual será removida e a anterior será reaberta.</p></>} confirmLabel="Desfazer movimentação" cancelLabel="Manter" tone="danger" processando={emAcao} onCancel={() => setDesfazendoLocalizacao(false)} onConfirm={() => { void executar(() => desfazerLocalizacaoAnimal(animal.id), () => setDesfazendoLocalizacao(false)); }} />
    <ConfirmDialog open={desfazendoDestino} title="Desfazer última mudança de finalidade?" message={<>{erroAcao && <p className="mb-2 text-red-700">{erroAcao}</p>}<p>A finalidade atual será removida e a anterior será reaberta.</p></>} confirmLabel="Desfazer mudança" cancelLabel="Manter" tone="danger" processando={emAcao} onCancel={() => setDesfazendoDestino(false)} onConfirm={() => { void executar(() => desfazerDestinoAnimal(animal.id), () => setDesfazendoDestino(false)); }} />
    <ConfirmDialog open={!!excluindoPesagem} title="Excluir pesagem?" message={<>{erroAcao && <p className="mb-2 text-red-700">{erroAcao}</p>}<p>Esta pesagem será removida permanentemente do histórico do animal.</p></>} confirmLabel="Excluir pesagem" cancelLabel="Manter" tone="danger" processando={emAcao} onCancel={() => setExcluindoPesagem(null)} onConfirm={() => { void excluirPesagemConfirmada(); }} />

    {movimentacaoAbertaId && <DetalheMovimentacao id={movimentacaoAbertaId} podeLancar={podeLancar} onFechar={() => setMovimentacaoAbertaId(null)} onMudou={() => { void carregar(); }} />}

    <ConfirmDialog
      open={sugestaoComposicao != null}
      title="Aplicar composição calculada?"
      message={sugestaoComposicao ? <p>Composição calculada pelos genitores: <strong>{sugestaoComposicao.rotulo}</strong></p> : ""}
      confirmLabel="Aplicar composição"
      cancelLabel="Cancelar"
      tone="neutral"
      processando={aplicandoSugestao}
      onConfirm={() => { void aplicarComposicaoSugerida(); }}
      onCancel={() => setSugestaoComposicao(null)}
    />
  </PaginaFinanceira>;
}
