import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ajustarDoses,
  criarCentralSemen,
  criarLoteSemen,
  criarReprodutor,
  excluirReprodutor,
  listarCaseinas,
  listarCentraisSemen,
  listarEstoqueSemen,
  listarIndicadores,
  listarMarcadores,
  listarRacas,
  listarTiposSemen,
  obterFichaGenetica,
  rankingReprodutores,
  salvarFichaGenetica,
  useReprodutores,
  type CentralSemenDTO,
  type DicionarioGeneticoDTO,
  type EstoqueSemenDTO,
  type FichaGeneticaDTO,
  type IndicadorGeneticoDTO,
  type PedigreeReprodutorDTO,
  type RacaDTO,
  type ReprodutorDTO,
  type TipoSemenDTO,
} from "../api";
import { PromptDialog } from "@/components/PromptDialog";
import { fmt } from "@/components/charts";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { RebAnm, RebBox, RebBoxSection, RebEmpty, RebPill } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";

const PEDIGREE_VAZIO: PedigreeReprodutorDTO = {
  paiNome: null,
  paiCodigo: null,
  maeNome: null,
  maeCodigo: null,
  avoMaternoNome: null,
  avoMaternoCodigo: null,
  avoPaternoNome: null,
  avoPaternoCodigo: null,
};

type CampoPedigree = keyof PedigreeReprodutorDTO;
type MapaTexto = Record<number, string>;

type CatalogosGeneticos = {
  indicadores: IndicadorGeneticoDTO[];
  marcadores: DicionarioGeneticoDTO[];
  caseinas: DicionarioGeneticoDTO[];
  tiposSemen: TipoSemenDTO[];
};

const CATALOGOS_VAZIOS: CatalogosGeneticos = {
  indicadores: [],
  marcadores: [],
  caseinas: [],
  tiposSemen: [],
};

function mensagemErro(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function numeroOuNull(valor: string) {
  return valor.trim() === "" ? null : Number(valor);
}

function textoOuNull(valor: string) {
  return valor.trim() || null;
}

function pedigreeNormalizado(pedigree: PedigreeReprodutorDTO): PedigreeReprodutorDTO {
  return {
    paiNome: textoOuNull(pedigree.paiNome ?? ""),
    paiCodigo: textoOuNull(pedigree.paiCodigo ?? ""),
    maeNome: textoOuNull(pedigree.maeNome ?? ""),
    maeCodigo: textoOuNull(pedigree.maeCodigo ?? ""),
    avoMaternoNome: textoOuNull(pedigree.avoMaternoNome ?? ""),
    avoMaternoCodigo: textoOuNull(pedigree.avoMaternoCodigo ?? ""),
    avoPaternoNome: textoOuNull(pedigree.avoPaternoNome ?? ""),
    avoPaternoCodigo: textoOuNull(pedigree.avoPaternoCodigo ?? ""),
  };
}

function valorFormatado(valor: number | null, decimais = 0) {
  return valor == null ? "—" : fmt(valor, { decimals: decimais });
}

export function ReprodutoresSection() {
  const { data, loading, recarregar } = useReprodutores(true);
  const [centrais, setCentrais] = useState<CentralSemenDTO[]>([]);
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogosGeneticos>(CATALOGOS_VAZIOS);
  const [ranking, setRanking] = useState<number[]>([]);
  const [indicadorRanking, setIndicadorRanking] = useState("");
  const [carregandoCatalogos, setCarregandoCatalogos] = useState(true);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [promptCentralAberto, setPromptCentralAberto] = useState(false);
  const rankingRequestId = useRef(0);

  const carregarCatalogos = useCallback(async () => {
    setCarregandoCatalogos(true);
    setErroGeral(null);
    try {
      const [centraisResp, racasResp, indicadores, marcadores, caseinas, tiposSemen, rankingResp] = await Promise.all([
        listarCentraisSemen(),
        listarRacas(),
        listarIndicadores(),
        listarMarcadores(),
        listarCaseinas(),
        listarTiposSemen(),
        rankingReprodutores(),
      ]);
      setCentrais(centraisResp);
      setRacas(racasResp);
      setCatalogos({ indicadores, marcadores, caseinas, tiposSemen });
      setRanking(rankingResp.ordem);
    } catch (err) {
      setErroGeral(mensagemErro(err, "Não foi possível carregar os catálogos genéticos."));
    } finally {
      setCarregandoCatalogos(false);
    }
  }, []);

  useEffect(() => { void carregarCatalogos(); }, [carregarCatalogos]);

  const lista = useMemo(() => {
    const reprodutores = data?.reprodutores ?? [];
    if (ranking.length === 0) return reprodutores;
    const posicao = new Map(ranking.map((id, index) => [id, index]));
    return [...reprodutores].sort((a, b) => (posicao.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (posicao.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [data?.reprodutores, ranking]);

  async function mudarRanking(valor: string) {
    const requestId = ++rankingRequestId.current;
    setIndicadorRanking(valor);
    setErroGeral(null);
    try {
      const resposta = await rankingReprodutores(valor ? Number(valor) : undefined);
      if (requestId === rankingRequestId.current) setRanking(resposta.ordem);
    } catch (err) {
      if (requestId === rankingRequestId.current) {
        setErroGeral(mensagemErro(err, "Não foi possível atualizar o ranking."));
      }
    }
  }

  async function excluir(reprodutor: ReprodutorDTO) {
    setErroGeral(null);
    try {
      await excluirReprodutor(reprodutor.id);
      if (expandidoId === reprodutor.id) setExpandidoId(null);
      recarregar();
    } catch (err) {
      setErroGeral(mensagemErro(err, "Não foi possível excluir o reprodutor."));
    }
  }

  async function confirmarNovaCentral(nome: string) {
    setPromptCentralAberto(false);
    try {
      const central = await criarCentralSemen({ nome });
      setCentrais((atuais) => [...atuais, central].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    } catch (err) {
      setErroGeral(mensagemErro(err, "Não foi possível cadastrar a central."));
    }
  }

  if (loading) return null;
  const resumo = data?.resumo;

  return (
    <RebBox>
      <div className="mb-[11px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Biblioteca de reprodutores</h4>
          {resumo && resumo.total > 0 && (
            <p className="mb-0 mt-1 text-sm text-ink-3">
              {resumo.total} touros · PTA leite média {valorFormatado(resumo.mediaPtaLeite, 1)} · TPI médio {valorFormatado(resumo.mediaTpi)}
            </p>
          )}
        </div>
        <RebButton variant="pri" onClick={() => setNovoAberto((aberto) => !aberto)} aria-expanded={novoAberto} aria-controls="novo-reprodutor-form">
          {novoAberto ? "Fechar cadastro" : "+ Novo reprodutor"}
        </RebButton>
      </div>

      {novoAberto && (
        <NovoReprodutorForm
          centrais={centrais}
          racas={racas}
          onNovaCentral={() => setPromptCentralAberto(true)}
          onCancelar={() => setNovoAberto(false)}
          onSalvo={() => { setNovoAberto(false); recarregar(); }}
        />
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-y border-dashed border-[color:var(--rule-soft)] py-3">
        <label className="flex min-w-[240px] flex-col gap-1 font-serif text-sm italic text-ink-3">
          Ordenar reprodutores por
          <RebSelect
            className="min-h-9 rounded-lg border border-border bg-card px-3 py-1.5 font-sans not-italic hover:border-border focus-visible:border-[color:var(--cafe)] data-[state=open]:border-[color:var(--cafe)]"
            aria-label="Ordenar reprodutores por"
            value={indicadorRanking}
            onChange={(v) => void mudarRanking(v)}
            disabled={carregandoCatalogos}
          >
            <option value="" data-descricao="Ordem padrão pelos valores de PTA leite e TPI já cadastrados.">PTA leite / TPI atuais</option>
            {catalogos.indicadores.filter((indicador) => indicador.ranking && indicador.ativo).map((indicador) => (
              <option key={indicador.id} value={indicador.id}>{indicador.sigla} · {indicador.nome}</option>
            ))}
          </RebSelect>
        </label>
        <p className="m-0 text-sm text-ink-3">Ausentes ficam no fim; empates mantêm ordem estável.</p>
      </div>

      <div aria-live="polite">{erroGeral && <p className="my-2 text-sm text-prejuizo">Erro: {erroGeral}</p>}</div>

      {lista.length === 0 ? (
        <RebEmpty>Nenhum reprodutor cadastrado. Cadastre um touro para registrar a ficha genética e os lotes de sêmen disponíveis.</RebEmpty>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((reprodutor, index) => (
            <ReprodutorCard
              key={reprodutor.id}
              reprodutor={reprodutor}
              posicao={index + 1}
              aberto={expandidoId === reprodutor.id}
              catalogos={catalogos}
              onAlternar={() => setExpandidoId((atual) => atual === reprodutor.id ? null : reprodutor.id)}
              onExcluir={() => void excluir(reprodutor)}
            />
          ))}
        </div>
      )}

      <PromptDialog
        open={promptCentralAberto}
        title="Nova central de sêmen"
        label="Nome da central"
        placeholder="Ex.: Alta Genetics · Semex"
        onConfirm={confirmarNovaCentral}
        onCancel={() => setPromptCentralAberto(false)}
      />
    </RebBox>
  );
}

function NovoReprodutorForm({
  centrais,
  racas,
  onNovaCentral,
  onCancelar,
  onSalvo,
}: {
  centrais: CentralSemenDTO[];
  racas: RacaDTO[];
  onNovaCentral: () => void;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({ nome: "", codigo: "", racaId: "", centralSemenId: "", ptaLeite: "", ptaGordura: "", ptaProteina: "", tpi: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function set(campo: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form.nome.trim()) {
      setErro("Informe o nome do reprodutor.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarReprodutor({
        nome: form.nome.trim(),
        codigo: textoOuNull(form.codigo),
        racaId: form.racaId ? Number(form.racaId) : null,
        centralSemenId: form.centralSemenId ? Number(form.centralSemenId) : null,
        ptaLeite: numeroOuNull(form.ptaLeite),
        ptaGordura: numeroOuNull(form.ptaGordura),
        ptaProteina: numeroOuNull(form.ptaProteina),
        tpi: numeroOuNull(form.tpi),
      });
      onSalvo();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível salvar o reprodutor."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form id="novo-reprodutor-form" onSubmit={salvar} className="mb-4 rounded-[10px] border border-dashed border-[color:var(--rule)] bg-[color:var(--bg-card-2)] p-4">
      <div className="grid grid-cols-4 gap-x-4 max-[800px]:grid-cols-2 max-[520px]:grid-cols-1">
        <RebField label="Nome"><input value={form.nome} onChange={(e) => set("nome", e.target.value)} maxLength={120} required /></RebField>
        <RebField label="Código"><input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} maxLength={60} /></RebField>
        <RebField label="Raça">
          <RebSelect aria-label="Raça" value={form.racaId} onChange={(v) => set("racaId", v)}><option value="">Não informada</option>{racas.map((raca) => <option key={raca.id} value={raca.id}>{raca.nome}</option>)}</RebSelect>
        </RebField>
        <RebField label="Central">
          <RebSelect aria-label="Central" value={form.centralSemenId} onChange={(v) => set("centralSemenId", v)}><option value="">Não informada</option>{centrais.map((central) => <option key={central.id} value={central.id}>{central.nome}</option>)}</RebSelect>
        </RebField>
      </div>
      <div className="grid grid-cols-4 gap-x-4 max-[620px]:grid-cols-2">
        <RebField label="PTA leite"><input type="number" step="any" value={form.ptaLeite} onChange={(e) => set("ptaLeite", e.target.value)} /></RebField>
        <RebField label="PTA gordura"><input type="number" step="any" value={form.ptaGordura} onChange={(e) => set("ptaGordura", e.target.value)} /></RebField>
        <RebField label="PTA proteína"><input type="number" step="any" value={form.ptaProteina} onChange={(e) => set("ptaProteina", e.target.value)} /></RebField>
        <RebField label="TPI"><input type="number" step="any" value={form.tpi} onChange={(e) => set("tpi", e.target.value)} /></RebField>
      </div>
      <div aria-live="polite">{erro && <p className="mt-0 text-sm text-prejuizo">Erro: {erro}</p>}</div>
      <div className="flex flex-wrap gap-2">
        <RebButton variant="pri" type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar reprodutor"}</RebButton>
        <RebButton onClick={onCancelar} disabled={salvando}>Cancelar</RebButton>
        <RebButton onClick={onNovaCentral}>+ Cadastrar central</RebButton>
      </div>
    </form>
  );
}

function ReprodutorCard({
  reprodutor,
  posicao,
  aberto,
  catalogos,
  onAlternar,
  onExcluir,
}: {
  reprodutor: ReprodutorDTO;
  posicao: number;
  aberto: boolean;
  catalogos: CatalogosGeneticos;
  onAlternar: () => void;
  onExcluir: () => void;
}) {
  const painelId = `ficha-reprodutor-${reprodutor.id}`;
  return (
    <article className="overflow-hidden rounded-[10px] border border-[color:var(--rule-soft)] bg-card">
      <div className="flex min-h-14 items-stretch">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent px-3 py-2.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
          onClick={onAlternar}
          aria-expanded={aberto}
          aria-controls={painelId}
          aria-label={`${aberto ? "Fechar" : "Abrir"} ficha genética de ${reprodutor.nome}`}
        >
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[color:var(--rule)] font-serif text-sm text-ink-3" aria-label={`Posição ${posicao}`}>{posicao}</span>
          <span className="min-w-0 flex-1">
            <RebAnm className={reprodutor.ativo ? "" : "text-ink-3 line-through"}>{reprodutor.nome}{reprodutor.codigo ? <small> · {reprodutor.codigo}</small> : null}</RebAnm>
            <span className="mt-0.5 block text-sm text-ink-3">{[reprodutor.racaNome, reprodutor.centralNome].filter(Boolean).join(" · ") || "Sem raça ou central informada"}</span>
          </span>
          <span className="hidden gap-4 text-sm tabular-nums text-ink-2 min-[680px]:flex">
            <span><small className="block text-xs uppercase tracking-[.04em] text-ink-3">PTA leite</small>{valorFormatado(reprodutor.ptaLeite, 1)}</span>
            <span><small className="block text-xs uppercase tracking-[.04em] text-ink-3">TPI</small>{valorFormatado(reprodutor.tpi)}</span>
          </span>
          <span aria-hidden="true" className="text-lg text-ink-3">{aberto ? "−" : "+"}</span>
        </button>
        <RebButton className="m-2 shrink-0 self-center" onClick={onExcluir} aria-label={`Excluir ${reprodutor.nome}`}>Excluir</RebButton>
      </div>
      {aberto && <FichaTecnica reprodutor={reprodutor} catalogos={catalogos} painelId={painelId} />}
    </article>
  );
}

function FichaTecnica({ reprodutor, catalogos, painelId }: { reprodutor: ReprodutorDTO; catalogos: CatalogosGeneticos; painelId: string }) {
  const [ficha, setFicha] = useState<FichaGeneticaDTO | null>(null);
  const [estoque, setEstoque] = useState<EstoqueSemenDTO[]>([]);
  const [indicadores, setIndicadores] = useState<MapaTexto>({});
  const [marcadores, setMarcadores] = useState<MapaTexto>({});
  const [caseinas, setCaseinas] = useState<MapaTexto>({});
  const [pedigree, setPedigree] = useState<PedigreeReprodutorDTO>(PEDIGREE_VAZIO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [fichaResp, estoqueResp] = await Promise.all([
        obterFichaGenetica(reprodutor.id),
        listarEstoqueSemen(reprodutor.id),
      ]);
      setFicha(fichaResp);
      setEstoque(estoqueResp);
      setIndicadores(Object.fromEntries(fichaResp.valoresIndicador.map((item) => [item.indicadorId, String(item.valor)])));
      setMarcadores(Object.fromEntries(fichaResp.valoresMarcador.map((item) => [item.marcadorId, item.resultado])));
      setCaseinas(Object.fromEntries(fichaResp.valoresCaseina.map((item) => [item.caseinaId, item.genotipo])));
      setPedigree(fichaResp.pedigree ?? PEDIGREE_VAZIO);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível carregar a ficha técnica."));
    } finally {
      setLoading(false);
    }
  }, [reprodutor.id]);

  useEffect(() => { void carregar(); }, [carregar]);

  function atualizarPedigree(campo: CampoPedigree, valor: string) {
    setPedigree((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvarFicha(evento: React.FormEvent) {
    evento.preventDefault();
    const valoresIndicador = Object.entries(indicadores)
      .filter(([, valor]) => valor.trim() !== "")
      .map(([indicadorId, valor]) => ({ indicadorId: Number(indicadorId), valor: Number(valor) }));
    if (valoresIndicador.some((item) => !Number.isFinite(item.valor))) {
      setErro("Revise os valores dos indicadores: use apenas números válidos.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await salvarFichaGenetica(reprodutor.id, {
        valoresIndicador,
        valoresMarcador: Object.entries(marcadores).filter(([, valor]) => valor.trim() !== "").map(([marcadorId, resultado]) => ({ marcadorId: Number(marcadorId), resultado: resultado.trim() })),
        valoresCaseina: Object.entries(caseinas).filter(([, valor]) => valor.trim() !== "").map(([caseinaId, genotipo]) => ({ caseinaId: Number(caseinaId), genotipo: genotipo.trim() })),
        pedigree: pedigreeNormalizado(pedigree),
      });
      setFicha(resposta);
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível salvar a ficha genética."));
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return <div id={painelId} role="region" aria-label={`Ficha genética de ${reprodutor.nome}`} className="border-t border-[color:var(--rule-soft)] p-4 text-sm text-ink-3" aria-live="polite">Carregando ficha genética e estoque…</div>;
  }

  const formId = `form-ficha-genetica-${reprodutor.id}`;

  return (
    <div id={painelId} role="region" aria-label={`Ficha genética de ${reprodutor.nome}`} className="border-t border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)] p-4">
      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)] gap-4 max-[900px]:grid-cols-1">
        <form id={formId} onSubmit={salvarFicha} className="min-w-0">
          <RebBox className="mb-3 bg-card">
            <h4>Pedigree</h4>
            <p className="-mt-1 mb-3 text-sm text-ink-3">Linhagem paterna e materna para consulta técnica e controle de consanguinidade.</p>
            <div className="grid grid-cols-2 gap-x-4 max-[560px]:grid-cols-1">
              <ParPedigree titulo="Pai" nome={pedigree.paiNome} codigo={pedigree.paiCodigo} onNome={(valor) => atualizarPedigree("paiNome", valor)} onCodigo={(valor) => atualizarPedigree("paiCodigo", valor)} />
              <ParPedigree titulo="Mãe" nome={pedigree.maeNome} codigo={pedigree.maeCodigo} onNome={(valor) => atualizarPedigree("maeNome", valor)} onCodigo={(valor) => atualizarPedigree("maeCodigo", valor)} />
              <ParPedigree titulo="Avô paterno" nome={pedigree.avoPaternoNome} codigo={pedigree.avoPaternoCodigo} onNome={(valor) => atualizarPedigree("avoPaternoNome", valor)} onCodigo={(valor) => atualizarPedigree("avoPaternoCodigo", valor)} />
              <ParPedigree titulo="Avô materno" nome={pedigree.avoMaternoNome} codigo={pedigree.avoMaternoCodigo} onNome={(valor) => atualizarPedigree("avoMaternoNome", valor)} onCodigo={(valor) => atualizarPedigree("avoMaternoCodigo", valor)} />
            </div>
          </RebBox>

          <RebBox className="mb-3 bg-card">
            <h4>Indicadores genéticos</h4>
            {catalogos.indicadores.length === 0 ? (
              <RebEmpty>Cadastre indicadores na aba Cadastros para registrar os índices deste reprodutor.</RebEmpty>
            ) : (
              <RebTable>
                <thead><tr><th>Sigla</th><th>Indicador</th><th>Direção</th><th>Valor</th></tr></thead>
                <tbody>{catalogos.indicadores.map((indicador) => (
                  <tr key={indicador.id}>
                    <td><RebAnm>{indicador.sigla}</RebAnm></td>
                    <td>{indicador.nome}{indicador.unidade ? <small className="ml-1 text-ink-3">({indicador.unidade})</small> : null}</td>
                    <td>{indicador.direcao === "maior_melhor" ? "↑ maior" : "↓ menor"}</td>
                    <td>
                      <label className="sr-only" htmlFor={`indicador-${reprodutor.id}-${indicador.id}`}>Valor de {indicador.nome}</label>
                      <input
                        id={`indicador-${reprodutor.id}-${indicador.id}`}
                        type="number"
                        step="any"
                        className="min-h-8 w-28 rounded-lg border border-border bg-[color:var(--bg)] px-2 py-1 text-right font-sans text-sm tabular-nums"
                        value={indicadores[indicador.id] ?? ""}
                        onChange={(e) => setIndicadores((atual) => ({ ...atual, [indicador.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}</tbody>
              </RebTable>
            )}
          </RebBox>

          <RebBox className="mb-0 bg-card">
            <h4>Marcadores e caseínas</h4>
            {catalogos.marcadores.length === 0 && catalogos.caseinas.length === 0 ? (
              <RebEmpty>Nenhum marcador ou tipo de caseína no catálogo. A ficha continuará válida apenas com indicadores e pedigree.</RebEmpty>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 max-[620px]:grid-cols-1">
                <GrupoValores titulo="Marcadores" itens={catalogos.marcadores} valores={marcadores} placeholder="Resultado" onChange={setMarcadores} />
                <GrupoValores titulo="Caseínas" itens={catalogos.caseinas} valores={caseinas} placeholder="Genótipo" onChange={setCaseinas} />
              </div>
            )}
          </RebBox>
        </form>

        <EstoqueSemenDrawer reprodutor={reprodutor} tipos={catalogos.tiposSemen} estoque={estoque} setEstoque={setEstoque} />
      </div>

      <div aria-live="polite">{erro && <p className="mb-0 mt-3 text-sm text-prejuizo">Erro: {erro}</p>}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-[color:var(--rule)] pt-4">
        <RebButton variant="pri" type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando ficha…" : "Salvar ficha genética"}</RebButton>
        {ficha && <span className="text-sm text-ink-3">A gravação substitui os valores atuais desta ficha.</span>}
      </div>
    </div>
  );
}

function ParPedigree({ titulo, nome, codigo, onNome, onCodigo }: { titulo: string; nome: string | null; codigo: string | null; onNome: (valor: string) => void; onCodigo: (valor: string) => void }) {
  return (
    <fieldset className="mb-3 min-w-0 rounded-[8px] border border-dashed border-[color:var(--rule-soft)] px-3 pt-2">
      <legend className="px-1 font-serif text-sm italic text-ink-3">{titulo}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3 max-[460px]:grid-cols-1">
        <RebField label="Nome"><input value={nome ?? ""} onChange={(e) => onNome(e.target.value)} /></RebField>
        <RebField label="Código"><input value={codigo ?? ""} onChange={(e) => onCodigo(e.target.value)} /></RebField>
      </div>
    </fieldset>
  );
}

function GrupoValores({ titulo, itens, valores, placeholder, onChange }: { titulo: string; itens: DicionarioGeneticoDTO[]; valores: MapaTexto; placeholder: string; onChange: React.Dispatch<React.SetStateAction<MapaTexto>> }) {
  return (
    <RebBoxSection>
      <h4>{titulo}</h4>
      {itens.length === 0 ? <p className="text-sm text-ink-3">Nenhum item no catálogo.</p> : itens.map((item) => (
        <label key={item.id} className="mb-2 grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 text-sm text-ink-2">
          <span><strong className="text-foreground">{item.sigla}</strong> · {item.nome}</span>
          <span className="sr-only">{placeholder} de {item.nome}</span>
          <input
            className="min-h-8 rounded-lg border border-border bg-[color:var(--bg)] px-2 py-1 font-sans text-sm"
            placeholder={placeholder}
            value={valores[item.id] ?? ""}
            onChange={(e) => onChange((atual) => ({ ...atual, [item.id]: e.target.value }))}
          />
        </label>
      ))}
    </RebBoxSection>
  );
}

function EstoqueSemenDrawer({ reprodutor, tipos, estoque, setEstoque }: {
  reprodutor: ReprodutorDTO;
  tipos: TipoSemenDTO[];
  estoque: EstoqueSemenDTO[];
  setEstoque: React.Dispatch<React.SetStateAction<EstoqueSemenDTO[]>>;
}) {
  const [novoLote, setNovoLote] = useState({ tipoSemenId: "", lote: "", localizacao: "", dosesDisponiveis: "" });
  const [ajustes, setAjustes] = useState<MapaTexto>({});
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const totalDoses = estoque.reduce((total, item) => total + item.dosesDisponiveis, 0);

  async function adicionarLote(evento: React.FormEvent) {
    evento.preventDefault();
    const doses = Number(novoLote.dosesDisponiveis);
    if (!Number.isInteger(doses) || doses < 0) {
      setErro("Informe uma quantidade inteira de doses, igual ou maior que zero.");
      return;
    }
    setProcessando(true);
    setErro(null);
    try {
      const criado = await criarLoteSemen(reprodutor.id, {
        tipoSemenId: novoLote.tipoSemenId ? Number(novoLote.tipoSemenId) : null,
        lote: textoOuNull(novoLote.lote),
        localizacao: textoOuNull(novoLote.localizacao),
        dosesDisponiveis: doses,
      });
      setEstoque((atual) => [...atual, criado].sort((a, b) => b.dosesDisponiveis - a.dosesDisponiveis || a.id - b.id));
      setNovoLote({ tipoSemenId: "", lote: "", localizacao: "", dosesDisponiveis: "" });
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível cadastrar o lote de sêmen."));
    } finally {
      setProcessando(false);
    }
  }

  async function aplicarAjuste(item: EstoqueSemenDTO) {
    const delta = Number(ajustes[item.id]);
    if (!Number.isInteger(delta) || delta === 0) {
      setErro("Informe um ajuste inteiro diferente de zero, como 10 ou -1.");
      return;
    }
    setProcessando(true);
    setErro(null);
    try {
      const atualizado = await ajustarDoses(item.id, delta);
      setEstoque((atual) => atual.map((estoqueItem) => estoqueItem.id === atualizado.id ? atualizado : estoqueItem).sort((a, b) => b.dosesDisponiveis - a.dosesDisponiveis || a.id - b.id));
      setAjustes((atuais) => ({ ...atuais, [item.id]: "" }));
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível ajustar o saldo de doses."));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <RebBox role="region" aria-label="Estoque de sêmen" className="mb-0 self-start border-l-[3px] border-l-[color:var(--leite)] bg-card">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="m-0 text-sm uppercase tracking-[.06em] text-ink-3">Estoque de sêmen</h4>
        <span className="font-serif text-lg font-medium tabular-nums text-foreground">{fmt(totalDoses)} <small className="font-sans text-xs font-normal text-ink-3">doses</small></span>
      </div>

      {estoque.length === 0 ? (
        <RebEmpty className="mb-3">Nenhum lote cadastrado. Registre a primeira entrada para disponibilizar doses deste reprodutor.</RebEmpty>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {estoque.map((item) => (
            <div key={item.id} className="rounded-[8px] border border-[color:var(--rule-soft)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm text-ink-2">
                  <RebAnm>{item.lote || `Lote #${item.id}`}</RebAnm>
                  <span className="mt-0.5 block text-ink-3">{[item.tipoSemenNome, item.localizacao].filter(Boolean).join(" · ") || "Sem tipo ou localização"}</span>
                </div>
                <RebPill tone={item.dosesDisponiveis > 0 ? "ok" : "bad"}>{item.dosesDisponiveis} {item.dosesDisponiveis === 1 ? "dose" : "doses"}</RebPill>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-3">
                  Ajuste de doses em {item.lote || `lote ${item.id}`}
                  <input
                    type="number"
                    step="1"
                    className="min-h-8 rounded-lg border border-border bg-[color:var(--bg)] px-2 py-1 font-sans text-sm"
                    placeholder="Ex.: 10 ou -1"
                    value={ajustes[item.id] ?? ""}
                    onChange={(e) => setAjustes((atuais) => ({ ...atuais, [item.id]: e.target.value }))}
                  />
                </label>
                <RebButton onClick={() => void aplicarAjuste(item)} disabled={processando}>Aplicar</RebButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <div aria-live="polite">{erro && <p className="mb-3 mt-0 text-sm text-prejuizo">Erro: {erro}</p>}</div>

      <form onSubmit={adicionarLote} className="border-t border-dashed border-[color:var(--rule)] pt-3">
        <h5 className="mb-2 mt-0 font-serif text-sm font-medium italic text-ink-3">Nova entrada de doses</h5>
        <div className="grid grid-cols-2 gap-x-3 max-[460px]:grid-cols-1">
          <RebField label="Tipo de sêmen">
            <RebSelect aria-label="Tipo de sêmen" value={novoLote.tipoSemenId} onChange={(v) => setNovoLote((atual) => ({ ...atual, tipoSemenId: v }))}>
              <option value="">Não informado</option>
              {tipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.sigla} · {tipo.nome}</option>)}
            </RebSelect>
          </RebField>
          <RebField label="Doses">
            <input type="number" min="0" step="1" value={novoLote.dosesDisponiveis} onChange={(e) => setNovoLote((atual) => ({ ...atual, dosesDisponiveis: e.target.value }))} required />
          </RebField>
          <RebField label="Lote">
            <input value={novoLote.lote} onChange={(e) => setNovoLote((atual) => ({ ...atual, lote: e.target.value }))} />
          </RebField>
          <RebField label="Localização">
            <input value={novoLote.localizacao} onChange={(e) => setNovoLote((atual) => ({ ...atual, localizacao: e.target.value }))} placeholder="Botijão / caneca" />
          </RebField>
        </div>
        <RebButton variant="pri" type="submit" disabled={processando}>{processando ? "Registrando…" : "Registrar entrada"}</RebButton>
      </form>
    </RebBox>
  );
}
