// Ficha do animal — página cheia no layout de OperacaoFinanceiraDetalhe.tsx:
// voltar, cabeçalho bg-[#f4f2e9] com brinco + pills, ações no topo, seções em
// grid (dados, composição, localização, destino, pesagens, baixa, auditoria).

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { fracaoReduzida } from "../lib/composicao";
import {
  buscarComposicaoSugerida, buscarFichaAnimal, darBaixaAnimal, desfazerDestinoAnimal, desfazerLocalizacaoAnimal,
  estornarBaixaAnimal, excluirPesagem, listarCategorias, listarFilhosAnimal, listarMovimentacoes, obterCatalogos,
  RebanhoApiError, removerCategoriaManual, substituirComposicaoAnimal,
} from "../api";
import type { AnimalFicha, CategoriaDTO, Catalogos, ComposicaoSugerida, FilhoResumo, PeriodoGmd, Pesagem } from "../types";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloPapelReprodutivo, rotuloSituacao } from "../lib/rotulos";
import { formatarGmd, formatarKg, PERIODO_GMD_PADRAO } from "../lib/peso";
import { CategoriaPill, ModalMotivo, useAoMovimentarComToast } from "../ui";
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

/** Nome/brinco de mãe ou pai na seção Filiação — link para a ficha quando é animal nosso,
 *  selo "externo" quando é genitor de fora. */
function LadoFiliacao({ lado }: { lado: AnimalFicha["filiacao"]["mae"] }) {
  if (!lado) return <span className="text-ink-3">Não informada</span>;
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
  const pesoHeader = animal.peso.ultimo
    ? `Peso atual ${formatarKg(animal.peso.ultimo.kg)}${animal.peso.gmdRecente != null ? ` · ${formatarGmd(animal.peso.gmdRecente)}` : ""}`
    : "Sem pesagem";

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
          <p className="mt-2 break-words text-sm text-ink-3">
            {formatarIdade(animal.idadeMeses)}{animal.idadeNaBaixa ? " na baixa" : ""} · {pesoHeader} · {!ativo && "último sítio: "}{animal.propriedade?.nome ?? "Sem sítio"}
            {animal.lote && <> · {!ativo && "último lote: "}<LinkLote id={animal.lote.id} nome={animal.lote.nome} /></>}
          </p>
          {animal.categoriaOrigem === "MANUAL" && animal.categoriaCalculada?.id === animal.categoria?.id && <p className="mt-2 text-xs text-ink-3">O cálculo já concorda — pode voltar ao automático.</p>}
        </div>
        {podeLancar && <div className="flex flex-wrap gap-2">
          {ativo ? <>
            <Button secondary onClick={() => setEditandoDados(true)}>Editar dados</Button>
            <Button secondary onClick={() => setEditandoComposicao(true)}>Editar composição</Button>
            <Button secondary onClick={() => setDefinindoFiliacao(true)}>Definir filiação</Button>
            <Button secondary onClick={() => setMovimentando(true)}>Movimentar</Button>
            <Button secondary onClick={() => setMudandoDestino(true)}>Mudar destino</Button>
            <Button secondary onClick={() => setAlterandoCategoria(true)}>Alterar categoria</Button>
            {animal.categoriaOrigem === "MANUAL" && <Button secondary onClick={() => { setErroAcao(null); setVoltandoAutomatico(true); }}>Voltar ao automático</Button>}
            <Button secondary onClick={() => setPesagemForm({ modo: "novo" })}>Registrar pesagem</Button>
            <Button danger onClick={() => setDandoBaixa(true)}>Dar baixa</Button>
            <Button danger onClick={() => setExcluindoCadastro(true)}>Excluir cadastro</Button>
          </> : <Button onClick={() => { setErroAcao(null); setEstornandoBaixa(true); }}>Estornar baixa</Button>}
        </div>}
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Dados</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink-3">Brinco eletrônico</dt><dd className="mt-0.5">{animal.brincoEletronico ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-3">SISBOV</dt><dd className="mt-0.5">{animal.sisbov ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-3">Sexo</dt><dd className="mt-0.5">{animal.sexo === "F" ? "Fêmea" : "Macho"}</dd></div>
            <div><dt className="text-xs text-ink-3">Origem</dt><dd className="mt-0.5">{animal.origem === "NASCIDO" ? "Nascido na propriedade" : "Comprado"}</dd></div>
            <div><dt className="text-xs text-ink-3">Nascimento</dt><dd className="mt-0.5">{formatarDataBR(animal.dataNascimento)}{animal.nascimentoEstimado ? " (estimado)" : ""}</dd></div>
            <div><dt className="text-xs text-ink-3">Entrada</dt><dd className="mt-0.5">{formatarDataBR(animal.dataEntrada)}</dd></div>
            {animal.sexo === "F" && <div><dt className="text-xs text-ink-3">Partos antes da entrada</dt><dd className="mt-0.5">{animal.partosAntesDaEntrada}</dd></div>}
          </dl>
          {animal.observacao && <p className="mt-4 break-words text-sm text-ink-3">{animal.observacao}</p>}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Filiação</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-xs text-ink-3">Mãe</dt><dd className="mt-0.5"><LadoFiliacao lado={animal.filiacao.mae} /></dd></div>
            <div><dt className="text-xs text-ink-3">Pai</dt><dd className="mt-0.5"><LadoFiliacao lado={animal.filiacao.pai} /></dd></div>
          </dl>
          {filhos && filhos.length > 0 && <div className="mt-4">
            <h3 className="text-xs font-semibold text-ink-3">Filhos ({filhos.length})</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {filhos.map((f) => <li key={f.id} className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => navegarPara(`/pecuaria/rebanho/animais/${f.id}`)} className="break-words font-semibold text-mast hover:underline">{f.brinco}{f.nome ? ` — ${f.nome}` : ""}</button>
                <span className="shrink-0 text-xs text-ink-3">{f.sexo === "F" ? "Fêmea" : "Macho"} · {formatarDataBR(f.dataNascimento)} · {rotuloSituacao(f.situacao)}</span>
              </li>)}
            </ul>
          </div>}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Composição racial</h2>
            {podeLancar && ativo && (animal.filiacao.mae || animal.filiacao.pai) && <button type="button" disabled={calculandoSugestao} onClick={() => void calcularComposicaoPelosGenitores()} className="text-xs font-semibold text-green-800 disabled:text-ink-3">{calculandoSugestao ? "Calculando…" : "Calcular pelos genitores"}</button>}
          </div>
          {animal.composicao.length ? <ul className="mt-4 space-y-2 text-sm">{animal.composicao.map((item) => <li key={item.racaId} className="flex items-center justify-between gap-3"><span>{item.nome} ({item.sigla}){!item.racaAtiva && <span className="text-ink-3"> · inativa</span>}</span><span className="flex items-center gap-2"><strong>{fracaoReduzida(item.fracao64)}</strong><Pill tone={item.origem === "CALCULADA" ? "blue" : "neutral"}>{item.origem === "CALCULADA" ? "Calculada" : "Informada"}</Pill></span></li>)}</ul> : <p className="mt-4 text-sm text-ink-3">Sem composição racial informada.</p>}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Localização</h2>{podeLancar && ativo && animal.historicoLocalizacoes.length >= 2 && <button className="text-xs font-semibold text-green-800" onClick={() => { setErroAcao(null); setDesfazendoLocalizacao(true); }}>Desfazer última movimentação</button>}</div>
          <p className="mt-4 text-sm">{localizacaoAtual ? <>{localizacaoAtual.propriedade?.nome ?? "Sem sítio"}{localizacaoAtual.lote ? ` · ${localizacaoAtual.lote.nome}` : ""} <span className="text-ink-3">desde {formatarDataBR(localizacaoAtual.desde)}</span></> : "Sem localização registrada."}</p>
          {animal.historicoLocalizacoes.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Sítio</th><th className="py-1 pr-3 font-semibold">Lote</th><th className="py-1 pr-3 font-semibold">Desde</th><th className="py-1 pr-3 font-semibold">Até</th><th className="py-1 pr-3 font-semibold">Motivo</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoLocalizacoes.map((loc) => <tr key={loc.id}><td className="py-1.5 pr-3">{loc.propriedade?.nome ?? "—"}</td><td className="py-1.5 pr-3">{loc.lote ? <LinkLote id={loc.lote.id} nome={loc.lote.nome} /> : "—"}</td><td className="py-1.5 pr-3">{formatarDataBR(loc.desde)}</td><td className="py-1.5 pr-3">{loc.ate ? formatarDataBR(loc.ate) : "—"}</td><td className="py-1.5 pr-3 break-words">{loc.motivo ?? "—"}</td></tr>)}</tbody></table></div>}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Destino</h2>{podeLancar && ativo && animal.historicoDestinos.length >= 2 && <button className="text-xs font-semibold text-green-800" onClick={() => { setErroAcao(null); setDesfazendoDestino(true); }}>Desfazer última mudança</button>}</div>
          <p className="mt-4 text-sm">{destinoAtual ? <>{rotuloAptidao(destinoAtual.aptidao)}{destinoAtual.papelReprodutivo !== "NENHUM" ? ` · ${rotuloPapelReprodutivo(destinoAtual.papelReprodutivo)}` : ""} <span className="text-ink-3">desde {formatarDataBR(destinoAtual.desde)}</span></> : "Sem destino registrado."}</p>
          {animal.historicoDestinos.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Aptidão</th><th className="py-1 pr-3 font-semibold">Papel</th><th className="py-1 pr-3 font-semibold">Desde</th><th className="py-1 pr-3 font-semibold">Até</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoDestinos.map((dest) => <tr key={dest.id}><td className="py-1.5 pr-3">{rotuloAptidao(dest.aptidao)}</td><td className="py-1.5 pr-3">{rotuloPapelReprodutivo(dest.papelReprodutivo)}</td><td className="py-1.5 pr-3">{formatarDataBR(dest.desde)}</td><td className="py-1.5 pr-3">{dest.ate ? formatarDataBR(dest.ate) : "—"}</td></tr>)}</tbody></table></div>}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Categoria</h2>
          {animal.historicoCategoriasManuais.length > 0 ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Período</th><th className="py-1 pr-3 font-semibold">Categoria</th><th className="py-1 pr-3 font-semibold">Motivo</th><th className="py-1 pr-3 font-semibold">Motivo do encerramento</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoCategoriasManuais.map((h) => <tr key={h.id}><td className="py-1.5 pr-3 whitespace-nowrap">{formatarDataBR(h.desde)} – {h.ate ? formatarDataBR(h.ate) : "atual"}</td><td className="py-1.5 pr-3">{h.categoria.nome}</td><td className="py-1.5 pr-3 break-words">{h.motivo}</td><td className="py-1.5 pr-3 break-words">{h.motivoEncerramento ?? "—"}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-ink-3">Categoria calculada pelas regras da fazenda.</p>}
        </section>
      </div>

      <PesoEGanho
        animal={animal}
        periodo={periodoGmd}
        onPeriodoChange={setPeriodoGmd}
        podeLancar={podeLancar}
        onEditarPesagem={(pesagem) => setPesagemForm({ modo: "editar", pesagem })}
        onExcluirPesagem={(pesagem) => { setErroAcao(null); setExcluindoPesagem(pesagem); }}
      />

      <HistoricoBaixas historicoBaixas={animal.historicoBaixas} />

      <section className="border-t border-border p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Movimentações</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <HistoricoMovimentacoes
            carregar={carregarMovimentacoes}
            mostrarDirecao
            podeLancar={podeLancar}
            recarregarToken={refreshToken}
            onAbrir={(mov) => setMovimentacaoAbertaId(mov.id)}
            onMudou={() => { void carregar(); }}
          />
        </div>
      </section>

      <section className="border-t border-border p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Auditoria</h2>
        <AuditoriaAnimal id={animal.id} recarregarToken={refreshToken} />
      </section>
    </Panel>

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
    <ConfirmDialog open={desfazendoDestino} title="Desfazer última mudança de destino?" message={<>{erroAcao && <p className="mb-2 text-red-700">{erroAcao}</p>}<p>O destino atual será removido e o anterior será reaberto.</p></>} confirmLabel="Desfazer mudança" cancelLabel="Manter" tone="danger" processando={emAcao} onCancel={() => setDesfazendoDestino(false)} onConfirm={() => { void executar(() => desfazerDestinoAnimal(animal.id), () => setDesfazendoDestino(false)); }} />
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
