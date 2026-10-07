// Ficha do animal — página cheia no layout de OperacaoFinanceiraDetalhe.tsx:
// voltar, cabeçalho bg-[#f4f2e9] com brinco + pills, ações no topo e uma faixa de
// resumo (idade, peso, categoria, local); abaixo, um card com ícone por assunto
// (identificação, composição, localização, finalidade, categoria, peso, baixas,
// movimentações, auditoria). "Finalidade" é o DestinoAnimal do banco (aptidão +
// papel reprodutivo) — o nome na tela evita confundir com o destino de uma movimentação.

import { useCallback, useEffect, useState } from "react";
import { ArchiveX, ArrowLeft, ArrowLeftRight, Baby, CalendarDays, Dna, Hash, History, Home, IdCard, LogIn, MapPin, Mars, Nfc, Scale, StickyNote, Tags, Target, Venus, type LucideIcon } from "lucide-react";
import { fracaoReduzida } from "../lib/composicao";
import {
  buscarComposicaoSugerida, buscarFichaAnimal, darBaixaAnimal, desfazerDestinoAnimal, desfazerLocalizacaoAnimal,
  estornarBaixaAnimal, excluirPesagem, listarCategorias, listarFilhosAnimal, listarMovimentacoes, obterCatalogos,
  RebanhoApiError, removerCategoriaManual, substituirComposicaoAnimal,
} from "../api";
import type { AnimalFicha, CategoriaDTO, Catalogos, ComposicaoSugerida, FilhoResumo, PeriodoGmd, Pesagem } from "../types";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloClasseMotivo, rotuloPapelReprodutivo, rotuloSituacao, rotuloTipoBaixa } from "../lib/rotulos";
import { formatarGmd, formatarKg, PERIODO_GMD_PADRAO } from "../lib/peso";
import { CardFicha, CategoriaPill, DadoFicha, DestaqueFicha, ModalMotivo, useAoMovimentarComToast } from "../ui";
import { FormDadosAnimal } from "../forms/FormDadosAnimal";
import { FormComposicao } from "../forms/FormComposicao";
import { FormFiliacao } from "../forms/FormFiliacao";
import { FormMovimentar } from "../forms/FormMovimentar";
import { FormDestino } from "../forms/FormDestino";
import { FormAlterarCategoria } from "../forms/FormAlterarCategoria";
import { FormPesagem } from "../forms/FormPesagem";
import { FormBaixa } from "../forms/FormBaixa";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Loader } from "../../../components/Loading";
import { Button, ErrorBox, hoje, Panel, Pill } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { NavRebanho } from "./NavRebanho";
import { PesoEGanho } from "../components/PesoEGanho";
import { HistoricoBaixas } from "../components/HistoricoBaixas";
import { AuditoriaAnimal } from "../components/AuditoriaAnimal";
import { HistoricoMovimentacoes } from "../components/HistoricoMovimentacoes";
import { DetalheMovimentacao } from "../components/DetalheMovimentacao";
import { SanidadeAnimal } from "../sanidade/SanidadeAnimal";
import { ManejoAnimal } from "../manejo/ManejoAnimal";
import { NutricaoAnimal } from "../nutricao/NutricaoAnimal";

/** Nome/brinco de mãe ou pai na seção Filiação — link para a ficha quando é animal nosso,
 *  selo "externo" quando é genitor de fora. */
function LadoFiliacao({ lado, vazio }: { lado: AnimalFicha["filiacao"]["mae"]; vazio: string }) {
  if (!lado) return <span className="text-ink-3">{vazio}</span>;
  if (lado.tipo === "ANIMAL") return <span className="inline-flex items-center gap-2">
    <button type="button" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${lado.id}`)} className="break-words font-semibold text-mast hover:underline">{lado.brinco}{lado.nome ? ` — ${lado.nome}` : ""}</button>
    {lado.baixado && <Pill tone="neutral">Baixado</Pill>}
  </span>;
  return <span className="inline-flex items-center gap-2 break-words">{lado.nome}<Pill tone="brown">Externo</Pill></span>;
}

/** Nome do lote como link para a página do lote — usado no cabeçalho e no histórico de localização.
 *  Nenhuma das duas linhas onde aparece tem `onClick` no `<tr>`/container, então não precisa de stopPropagation. */
function LinkLote({ id, nome }: { id: string; nome: string }) {
  return <button type="button" onClick={() => navegarPara(`/pecuaria/rebanho/lotes/${id}`)} className="break-words font-semibold text-mast hover:underline">{nome}</button>;
}

function ResumoFicha({ icon: Icon, rotulo, valor, detalhe }: { icon: LucideIcon; rotulo: string; valor: string; detalhe: string }) {
  return <div className="flex min-w-0 items-start gap-3 border-b border-border p-5 lg:border-b-0">
    <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef1e9] text-mast"><Icon size={17} /></span>
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">{rotulo}</dt>
      <dd className="mt-1 break-words font-serif text-xl leading-tight text-ink">{valor}</dd>
      <dd className="mt-1 break-words text-xs text-ink-3">{detalhe}</dd>
    </div>
  </div>;
}

export function DetalheAnimal({ id, onVoltar, podeLancar = true }: { id: string; onVoltar: () => void; podeLancar?: boolean }) {
  const [animal, setAnimal] = useState<AnimalFicha | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDTO[]>([]);
  const [periodoGmd, setPeriodoGmd] = useState<PeriodoGmd>(PERIODO_GMD_PADRAO);
  /* sobe a cada carregar()/ação bem-sucedida — recomeça a paginação da auditoria e do
   * histórico de movimentações (ambos buscam a própria página, ver components/) */
  const [refreshToken, setRefreshToken] = useState(0);
  const [movimentacaoAbertaId, setMovimentacaoAbertaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
  const [estornandoBaixa, setEstornandoBaixa] = useState(false);
  const [excluindoCadastro, setExcluindoCadastro] = useState(false);
  const [desfazendoLocalizacao, setDesfazendoLocalizacao] = useState(false);
  const [desfazendoDestino, setDesfazendoDestino] = useState(false);
  const [excluindoPesagem, setExcluindoPesagem] = useState<Pesagem | null>(null);
  const [emAcao, setEmAcao] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const tocar = useCallback(() => setRefreshToken((t) => t + 1), []);
  // periodoGmd entra na busca da ficha: trocar o seletor da seção "Peso e ganho" refaz este fetch
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const ficha = await buscarFichaAnimal(id, { periodoDias: periodoGmd });
      setAnimal(ficha);
      tocar();
    } catch (e) { setErro(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
  }, [id, periodoGmd, tocar]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { obterCatalogos().then(setCatalogos).catch(() => undefined); }, []);
  useEffect(() => { listarCategorias().then((r) => setCategorias(r.itens)).catch(() => undefined); }, []);
  useEffect(() => {
    if (animal && animal.filhosCount > 0) listarFilhosAnimal(id).then(setFilhos).catch(() => setFilhos([]));
    else setFilhos(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, animal?.filhosCount, refreshToken]);
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

  if (!animal) return <div className="shell-wide pagina-carregando"><button onClick={onVoltar} className="mt-6 mb-5 inline-flex shrink-0 items-center gap-2 self-start text-sm font-semibold text-ink-2"><ArrowLeft size={17} /> Voltar para animais</button><ErrorBox erro={erro} />{!erro && <Loader label="Carregando animal" full />}</div>;

  const ativo = animal.situacao === "ATIVO";
  // a atual é a linha aberta; para quem saiu, a última fechada
  const localizacaoAtual = animal.historicoLocalizacoes.find((l) => l.ate == null) ?? animal.historicoLocalizacoes[0] ?? null;
  const destinoAtual = animal.historicoDestinos.find((d) => d.ate == null) ?? animal.historicoDestinos[0] ?? null;

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
  // a baixa em vigor no histórico (traz quem registrou)
  const baixaRegistro = animal.baixa ? animal.historicoBaixas.find((b) => b.id === animal.baixa?.id) ?? null : null;
  const composicaoOrdenada = [...animal.composicao].sort((a, b) => b.fracao64 - a.fracao64);
  const somaComposicao = animal.composicao.reduce((total, item) => total + item.fracao64, 0);

  return <div className="shell-wide pagina-financeira">
    <button onClick={onVoltar} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={17} /> Voltar para animais</button>
    <NavRebanho ativa="animais" />
    <div className="mt-6"><ErrorBox erro={erro} /></div>
    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border bg-[#f4f2e9] p-6">
        <div className="min-w-0 flex-[1_1_280px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{animal.brinco}</span>
            <Pill tone={ativo ? "green" : "neutral"}>{rotuloSituacao(animal.situacao)}</Pill>
            <CategoriaPill categoria={animal.categoria} categoriaOrigem={animal.categoriaOrigem} categoriaCalculada={animal.categoriaCalculada} />
            {animal.aptidao && <Pill tone="brown">{rotuloAptidao(animal.aptidao)}{!ativo && " · na baixa"}</Pill>}
            {animal.papelReprodutivo && animal.papelReprodutivo !== "NENHUM" && <Pill tone="amber">{rotuloPapelReprodutivo(animal.papelReprodutivo)}{!ativo && " · na baixa"}</Pill>}
          </div>
          <h1 className="mt-2 break-words font-serif text-[clamp(22px,5vw,30px)] leading-tight">{animal.nome || animal.brinco}</h1>
          <p className="mt-2 break-words text-sm text-ink-3">{animal.sexo === "F" ? "Fêmea" : "Macho"} · {animal.origem === "NASCIDO" ? "nascido na propriedade" : "comprado"}</p>
          {animal.categoriaOrigem === "MANUAL" && animal.categoriaCalculada?.id === animal.categoria?.id && <p className="mt-2 text-xs text-ink-3">O cálculo já concorda — pode voltar ao automático.</p>}
        </div>
        {podeLancar && <div className="flex max-w-full flex-wrap gap-2 lg:max-w-[560px] lg:justify-end">
          {ativo ? <>
            <Button secondary onClick={() => setDefinindoFiliacao(true)}>Definir filiação</Button>
            <Button secondary onClick={() => setMovimentando(true)}>Movimentar</Button>
            <Button secondary onClick={() => setPesagemForm({ modo: "novo" })}>Registrar pesagem</Button>
            <Button secondary onClick={() => setMudandoDestino(true)}>Mudar finalidade</Button>
            <Button secondary onClick={() => setAlterandoCategoria(true)}>Alterar categoria</Button>
            {animal.categoriaOrigem === "MANUAL" && <Button secondary onClick={() => { setErroAcao(null); setVoltandoAutomatico(true); }}>Voltar ao automático</Button>}
            <Button secondary onClick={() => setEditandoDados(true)}>Editar dados</Button>
            <Button secondary onClick={() => setEditandoComposicao(true)}>Editar composição</Button>
            <Button danger onClick={() => setDandoBaixa(true)}>Dar baixa</Button>
            <Button danger onClick={() => setExcluindoCadastro(true)}>Excluir cadastro</Button>
          </> : <Button onClick={() => { setErroAcao(null); setEstornandoBaixa(true); }}>Estornar baixa</Button>}
        </div>}
      </div>

      {/* animal baixado: a baixa em vigor é a informação principal da ficha */}
      {!ativo && animal.baixa && <div role="status" className="flex flex-wrap items-start gap-4 border-b border-red-200 bg-red-50 px-6 py-4 text-red-950">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-100 text-red-800"><ArchiveX size={19} /></span>
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-red-800">Animal baixado</div>
          <div className="mt-1 font-serif text-xl leading-tight">{rotuloTipoBaixa(animal.baixa.tipo)} em {formatarDataBR(animal.baixa.data)}</div>
          <p className="mt-1 break-words text-sm">
            {animal.baixa.motivo ? <>Motivo: {animal.baixa.motivo.nome} <span className="text-red-800/80">({rotuloClasseMotivo(animal.baixa.motivo.classe).toLowerCase()})</span></> : "Sem motivo informado"}
            {baixaRegistro?.criadoPor && <> · registrada por {baixaRegistro.criadoPor}</>}
          </p>
          {animal.baixa.observacao && <p className="mt-1 break-words text-sm text-red-900/85">“{animal.baixa.observacao}”</p>}
          <p className="mt-2 text-xs text-red-900/75">Idade, categoria, local e finalidade abaixo são os da data da baixa. Nenhuma ação de manejo fica disponível até a baixa ser estornada.</p>
        </div>
      </div>}

      {/* resumo de leitura rápida: o que se procura primeiro ao abrir a ficha */}
      <dl className="grid grid-cols-2 divide-border lg:grid-cols-4 lg:divide-x">
        <ResumoFicha icon={CalendarDays} rotulo={animal.idadeNaBaixa ? "Idade na baixa" : "Idade"} valor={formatarIdade(animal.idadeMeses)} detalhe={`Nascimento ${formatarDataBR(animal.dataNascimento)}${animal.nascimentoEstimado ? " (estimado)" : ""}`} />
        <ResumoFicha icon={Scale} rotulo={ativo ? "Peso atual" : "Último peso"} valor={animal.peso.ultimo ? formatarKg(animal.peso.ultimo.kg) : "—"} detalhe={animal.peso.ultimo ? `${formatarDataBR(animal.peso.ultimo.data)}${animal.peso.gmdRecente != null ? ` · ${formatarGmd(animal.peso.gmdRecente)}` : ""}` : "Sem pesagem"} />
        <ResumoFicha icon={Tags} rotulo="Categoria" valor={animal.categoria?.nome ?? "Sem categoria"} detalhe={animal.categoriaOrigem === "MANUAL" ? "Definida manualmente" : animal.categoriaOrigem === "SEM_CATEGORIA" ? "Nenhuma regra se aplica" : "Calculada pelas regras"} />
        <ResumoFicha icon={MapPin} rotulo={ativo ? "Local" : "Último local"} valor={animal.lote?.nome ?? "Sem lote"} detalhe={animal.propriedade?.nome ?? "Sem sítio"} />
      </dl>
    </Panel>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <CardFicha icon={IdCard} titulo="Identificação">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DadoFicha icon={Nfc} rotulo="Brinco eletrônico">{animal.brincoEletronico ?? "—"}</DadoFicha>
          <DadoFicha icon={Hash} rotulo="SISBOV">{animal.sisbov ?? "—"}</DadoFicha>
          <DadoFicha icon={animal.sexo === "F" ? Venus : Mars} rotulo="Sexo">{animal.sexo === "F" ? "Fêmea" : "Macho"}</DadoFicha>
          <DadoFicha icon={Home} rotulo="Origem">{animal.origem === "NASCIDO" ? "Nascido na propriedade" : "Comprado"}</DadoFicha>
          <DadoFicha icon={CalendarDays} rotulo="Nascimento">{formatarDataBR(animal.dataNascimento)}{animal.nascimentoEstimado ? " (estimado)" : ""}</DadoFicha>
          <DadoFicha icon={LogIn} rotulo="Entrada">{formatarDataBR(animal.dataEntrada)}</DadoFicha>
          {animal.sexo === "F" && <DadoFicha icon={Baby} rotulo="Partos antes da entrada">{animal.partosAntesDaEntrada}</DadoFicha>}
        </dl>
        {animal.observacao && <div className="mt-5 flex gap-2.5 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-ink-2"><StickyNote aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-ink-3" /><p className="min-w-0 break-words">{animal.observacao}</p></div>}
      </CardFicha>

      <CardFicha
        icon={Baby}
        titulo="Filiação"
        acao={podeLancar && ativo ? <button type="button" className="text-xs font-semibold text-green-800" onClick={() => setDefinindoFiliacao(true)}>Definir filiação</button> : undefined}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-ink-3">Mãe</dt><dd className="mt-1 text-sm"><LadoFiliacao lado={animal.filiacao.mae} vazio="Não informada" /></dd></div>
          <div><dt className="text-xs text-ink-3">Pai</dt><dd className="mt-1 text-sm"><LadoFiliacao lado={animal.filiacao.pai} vazio="Não informado" /></dd></div>
        </dl>
        {filhos && filhos.length > 0 && <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Filhos ({filhos.length})</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {filhos.map((f) => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${f.id}`)} className="break-words font-semibold text-mast hover:underline">{f.brinco}{f.nome ? ` — ${f.nome}` : ""}</button>
              <span className="text-xs text-ink-3">{f.sexo === "F" ? "Fêmea" : "Macho"} · {formatarDataBR(f.dataNascimento)} · {rotuloSituacao(f.situacao)}</span>
            </li>)}
          </ul>
        </div>}
      </CardFicha>

      <CardFicha
        icon={Dna}
        titulo="Composição racial"
        acao={podeLancar && ativo && (animal.filiacao.mae || animal.filiacao.pai) ? <button type="button" disabled={calculandoSugestao} onClick={() => void calcularComposicaoPelosGenitores()} className="text-xs font-semibold text-green-800 disabled:text-ink-3">{calculandoSugestao ? "Calculando…" : "Calcular pelos genitores"}</button> : undefined}
      >
        {composicaoOrdenada.length ? <>
          <ul className="space-y-3.5 text-sm">{composicaoOrdenada.map((item) => <li key={item.racaId}>
            <div className="flex flex-wrap items-baseline justify-between gap-3"><span className="min-w-0 break-words">{item.nome} <span className="text-ink-3">({item.sigla})</span>{!item.racaAtiva && <span className="text-ink-3"> · inativa</span>}</span><span className="flex items-center gap-2"><strong className="shrink-0 tabular-nums">{fracaoReduzida(item.fracao64)}</strong><Pill tone={item.fracaoCalculada64 === item.fracao64 || item.origem === "CALCULADA" ? "blue" : "neutral"}>{item.fracaoCalculada64 > 0 && item.fracaoCalculada64 < item.fracao64 ? "Calculada + informada" : item.origem === "CALCULADA" ? "Calculada" : "Informada"}</Pill></span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true"><div className="h-full rounded-full bg-[var(--cafe)]" style={{ width: `${(item.fracao64 / 64) * 100}%` }} /></div>
          </li>)}</ul>
          {somaComposicao < 64 && <p className="mt-4 text-xs text-ink-3">Restante ({fracaoReduzida(64 - somaComposicao)}) sem raça informada.</p>}
        </> : <p className="text-sm text-ink-3">Sem composição racial informada.</p>}
      </CardFicha>

      <CardFicha icon={MapPin} titulo="Localização" acao={podeLancar && ativo && animal.historicoLocalizacoes.length >= 2 ? <button className="text-xs font-semibold text-green-800" onClick={() => { setErroAcao(null); setDesfazendoLocalizacao(true); }}>Desfazer última movimentação</button> : undefined}>
        <DestaqueFicha>{localizacaoAtual ? <><strong>{localizacaoAtual.propriedade?.nome ?? "Sem sítio"}{localizacaoAtual.lote ? <> · <LinkLote id={localizacaoAtual.lote.id} nome={localizacaoAtual.lote.nome} /></> : ""}</strong> <span className="text-ink-3">desde {formatarDataBR(localizacaoAtual.desde)}</span></> : "Sem localização registrada."}</DestaqueFicha>
        {animal.historicoLocalizacoes.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Sítio</th><th className="py-1 pr-3 font-semibold">Lote</th><th className="py-1 pr-3 font-semibold">Desde</th><th className="py-1 pr-3 font-semibold">Até</th><th className="py-1 pr-3 font-semibold">Motivo</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoLocalizacoes.map((loc) => <tr key={loc.id}><td className="py-1.5 pr-3">{loc.propriedade?.nome ?? "—"}</td><td className="py-1.5 pr-3">{loc.lote ? <LinkLote id={loc.lote.id} nome={loc.lote.nome} /> : "—"}</td><td className="py-1.5 pr-3">{formatarDataBR(loc.desde)}</td><td className="py-1.5 pr-3">{loc.ate ? formatarDataBR(loc.ate) : "—"}</td><td className="py-1.5 pr-3 break-words">{loc.motivo ?? "—"}</td></tr>)}</tbody></table></div>}
      </CardFicha>

      <CardFicha icon={Target} titulo="Finalidade" acao={podeLancar && ativo && animal.historicoDestinos.length >= 2 ? <button className="text-xs font-semibold text-green-800" onClick={() => { setErroAcao(null); setDesfazendoDestino(true); }}>Desfazer última mudança</button> : undefined}>
        <DestaqueFicha>{destinoAtual ? <span className="flex flex-wrap items-center gap-2"><Pill tone="brown">{rotuloAptidao(destinoAtual.aptidao)}</Pill>{destinoAtual.papelReprodutivo !== "NENHUM" && <Pill tone="amber">{rotuloPapelReprodutivo(destinoAtual.papelReprodutivo)}</Pill>}<span className="text-ink-3">desde {formatarDataBR(destinoAtual.desde)}</span></span> : "Sem finalidade registrada."}</DestaqueFicha>
        {animal.historicoDestinos.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Aptidão</th><th className="py-1 pr-3 font-semibold">Papel reprodutivo</th><th className="py-1 pr-3 font-semibold">Desde</th><th className="py-1 pr-3 font-semibold">Até</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoDestinos.map((dest) => <tr key={dest.id}><td className="py-1.5 pr-3">{rotuloAptidao(dest.aptidao)}</td><td className="py-1.5 pr-3">{rotuloPapelReprodutivo(dest.papelReprodutivo)}</td><td className="py-1.5 pr-3">{formatarDataBR(dest.desde)}</td><td className="py-1.5 pr-3">{dest.ate ? formatarDataBR(dest.ate) : "—"}</td></tr>)}</tbody></table></div>}
      </CardFicha>

      <CardFicha icon={Tags} titulo="Categoria" className="lg:col-span-2">
        <DestaqueFicha>
          <div className="flex flex-wrap items-center gap-2">
            <CategoriaPill categoria={animal.categoria} categoriaOrigem={animal.categoriaOrigem} categoriaCalculada={animal.categoriaCalculada} />
            {animal.categoriaOrigem === "AUTOMATICA" && <span className="text-ink-3">calculada pela regra{categoriaRegra?.regra ? ` "${categoriaRegra.regra}"` : " da fazenda"}{animal.idadeNaBaixa ? ", na data da baixa" : ""}.</span>}
            {animal.categoriaOrigem === "SEM_CATEGORIA" && <span className="text-ink-3">nenhuma regra ativa se aplica a este animal — ajuste as regras em Cadastros › Categorias ou defina manualmente.</span>}
            {manualAberta && <span className="text-ink-3">definida manualmente desde {formatarDataBR(manualAberta.desde)} — {manualAberta.motivo}.</span>}
          </div>
          {animal.categoriaOrigem === "MANUAL" && <p className="mt-2 text-xs text-ink-3">Pelas regras seria {animal.categoriaCalculada ? `${animal.categoriaCalculada.nome}${categoriaCalculadaRegra?.regra ? ` (${categoriaCalculadaRegra.regra})` : ""}` : "Sem categoria"}.</p>}
        </DestaqueFicha>
        {animal.historicoCategoriasManuais.length > 0 && <>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-3">Trocas manuais</h3>
          <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Período</th><th className="py-1 pr-3 font-semibold">Categoria</th><th className="py-1 pr-3 font-semibold">Motivo</th><th className="py-1 pr-3 font-semibold">Motivo do encerramento</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoCategoriasManuais.map((h) => <tr key={h.id}><td className="py-1.5 pr-3 whitespace-nowrap">{formatarDataBR(h.desde)} – {h.ate ? formatarDataBR(h.ate) : "atual"}</td><td className="py-1.5 pr-3">{h.categoria.nome}</td><td className="py-1.5 pr-3 break-words">{h.motivo}</td><td className="py-1.5 pr-3 break-words">{h.motivoEncerramento ?? "—"}</td></tr>)}</tbody></table></div>
        </>}
      </CardFicha>

      <PesoEGanho
        animal={animal}
        periodo={periodoGmd}
        onPeriodoChange={setPeriodoGmd}
        podeLancar={podeLancar && ativo}
        onEditarPesagem={(pesagem) => setPesagemForm({ modo: "editar", pesagem })}
        onExcluirPesagem={(pesagem) => { setErroAcao(null); setExcluindoPesagem(pesagem); }}
      />

      <HistoricoBaixas historicoBaixas={animal.historicoBaixas} />

      <SanidadeAnimal animalId={animal.id} propriedadeId={localizacaoAtual?.propriedade?.id ?? null} podeLancar={podeLancar} recarregarToken={refreshToken} onMudou={() => { void carregar(); }} />
      <ManejoAnimal animalId={animal.id} propriedadeId={localizacaoAtual?.propriedade?.id ?? null} localizacoes={animal.historicoLocalizacoes} baixaData={animal.baixa?.data ?? null} podeLancar={podeLancar} onSalvo={() => { void carregar(); }} />
      <NutricaoAnimal animalId={animal.id} recarregarToken={refreshToken} />

      <CardFicha icon={ArrowLeftRight} titulo="Movimentações" className="lg:col-span-2">
        <div className="-m-5">
          <HistoricoMovimentacoes
            carregar={carregarMovimentacoes}
            mostrarDirecao
            podeLancar={podeLancar}
            recarregarToken={refreshToken}
            onAbrir={(mov) => setMovimentacaoAbertaId(mov.id)}
            onMudou={() => { void carregar(); }}
          />
        </div>
      </CardFicha>

      <CardFicha icon={History} titulo="Auditoria" className="lg:col-span-2">
        <AuditoriaAnimal id={animal.id} recarregarToken={refreshToken} />
      </CardFicha>
    </div>

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
  </div>;
}
