import { useEffect, useMemo, useState } from "react";
import { DateRangePicker, type DateRange } from "../../components/DateRangePicker";
import { getHoje } from "../../lib/hoje";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { CampoData } from "@/components/CampoData";
import { SelectBusca } from "@/components/SelectBusca";
import { RebBox, RebMain } from "@/components/rb/RebPrimitives";
import {
  useGrupos,
  useSetores,
  listarTemplatesRelatorioRebanho,
  useRelatorioRebanho,
  useFolhasCampo,
  listarCamposFormulario,
  type FiltrosRelatorioRebanho,
  type LinhaRelatorioRebanhoDTO,
  type ResultadoRelatorioRebanhoDTO,
  type TemplateRelatorioRebanhoDTO,
  type FolhaCampoDTO,
  type FiltroColunaRelatorioRebanho,
} from "../api";
import { RebHeader } from "./RebHeader";
import { RelatorioResultado } from "./RelatorioResultado";
import { baixarRelatorioCsv, exportarRelatorioPdf } from "./relatorioExport";
import { FormularioCampoModal } from "./FormularioCampoModal";
import { FolhaCampoView } from "./FolhaCampoView";
import { exportarFormularioCampoPdf } from "./formularioCampoExport";

type AcaoRelatorio = NonNullable<ResultadoRelatorioRebanhoDTO["acao"]>;

function mesPassado(): DateRange {
  const hoje = getHoje();
  return {
    start: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
    end: new Date(hoje.getFullYear(), hoje.getMonth(), 0),
  };
}
const isoLocal = (data: Date | null) => data ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}` : undefined;
const CATEGORIAS = [
  ["", "Todas as categorias"], ["BEZERRA", "Bezerra"], ["NOVILHA", "Novilha"], ["VACA", "Vaca"],
  ["BEZERRO", "Bezerro"], ["TOURO", "Touro"], ["CABRITA", "Cabrita"], ["CABRA", "Cabra"], ["CABRITO", "Cabrito"], ["BODE", "Bode"],
] as const;

export function RelatoriosTab({
  onAbrirFicha,
  onRegistrar,
  refreshToken = 0,
}: {
  onAbrirFicha: (id: string) => void;
  onRegistrar: (payload: { linha: LinhaRelatorioRebanhoDTO; acao: AcaoRelatorio }) => void;
  refreshToken?: number;
}) {
  const [templates, setTemplates] = useState<TemplateRelatorioRebanhoDTO[]>([]);
  const [templateId, setTemplateId] = useState<FiltrosRelatorioRebanho["templateId"]>("ia-periodo");
  const [range, setRange] = useState<DateRange>(mesPassado);
  const [status, setStatus] = useState<FiltrosRelatorioRebanho["status"]>("ATIVO");
  const [grupoId, setGrupoId] = useState("");
  const [setor, setSetor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [animal, setAnimal] = useState("");
  const [reprodutor, setReprodutor] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [resultado, setResultado] = useState("");
  const [filtrosColunas, setFiltrosColunas] = useState<Record<string, { minimo: string; maximo: string; valor: string }>>({});
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>([]);
  const grupos = useGrupos();
  const setores = useSetores();
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosRelatorioRebanho | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [montandoFormulario, setMontandoFormulario] = useState(false);
  const [folhaAberta, setFolhaAberta] = useState<FolhaCampoDTO | null>(null);
  const relatorio = useRelatorioRebanho(filtrosAplicados);
  const folhas = useFolhasCampo(true);

  useEffect(() => {
    listarTemplatesRelatorioRebanho().then(setTemplates).catch(() => setTemplates([]));
  }, []);
  useEffect(() => { if (filtrosAplicados) relatorio.recarregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshToken]);

  const template = templates.find((t) => t.id === templateId);
  const exigePeriodo = !["gestantes-atual", "controle-leiteiro-lote", "pesagem-corporal-lote", "vacinacao-lote"].includes(templateId);
  const fases = useMemo(() => Array.from(new Set(templates.map((t) => t.fase))), [templates]);

  function atualizarFiltro(chave: string, campo: "minimo" | "maximo" | "valor", valor: string) {
    setFiltrosColunas((atuais) => ({ ...atuais, [chave]: { ...(atuais[chave] ?? { minimo: "", maximo: "", valor: "" }), [campo]: valor } }));
  }

  function gerar() {
    setColunasVisiveis([]);
    const filtrosAtivos = (template?.colunas ?? []).reduce<FiltroColunaRelatorioRebanho[]>((ativos, coluna) => {
      const filtro = filtrosColunas[coluna.chave];
      if (coluna.tipo === "texto" && filtro?.valor.trim()) ativos.push({ chave: coluna.chave, tipo: coluna.tipo, valor: filtro.valor.trim() });
      if (coluna.tipo !== "texto" && (filtro?.minimo || filtro?.maximo)) ativos.push({ chave: coluna.chave, tipo: coluna.tipo, ...(filtro.minimo ? { minimo: filtro.minimo } : {}), ...(filtro.maximo ? { maximo: filtro.maximo } : {}) });
      return ativos;
    }, []);
    setFiltrosAplicados({
      templateId,
      ...(exigePeriodo ? { dataInicio: isoLocal(range.start), dataFim: isoLocal(range.end) } : {}),
      status,
      ...(grupoId ? { grupoId: Number(grupoId) } : {}),
      ...(setor ? { setor } : {}),
      ...(categoria ? { categoria } : {}),
      ...(animal.trim() ? { animal: animal.trim() } : {}),
      ...(reprodutor.trim() ? { reprodutor: reprodutor.trim() } : {}),
      ...(protocolo.trim() ? { protocolo: protocolo.trim() } : {}),
      ...(resultado ? { resultado: resultado as "positivo" | "negativo" } : {}),
      ...(filtrosAtivos.length ? { filtrosColunas: JSON.stringify(filtrosAtivos) } : {}),
    });
  }

  async function exportarPdf(colunas: string[]) {
    if (!relatorio.data) return;
    setExportandoPdf(true);
    try { await exportarRelatorioPdf(relatorio.data, colunas); }
    finally { setExportandoPdf(false); }
  }

  if (folhaAberta) {
    return <FolhaCampoView folhaInicial={folhaAberta} onVoltar={() => setFolhaAberta(null)} onAtualizada={(folha) => { setFolhaAberta(folha); folhas.recarregar(); }} />;
  }

  async function imprimirFolha(folha: FolhaCampoDTO) {
    setExportandoPdf(true);
    try { await exportarFormularioCampoPdf(folha, await listarCamposFormulario(folha.templateId)); }
    finally { setExportandoPdf(false); }
  }

  return (
    <RebMain>
      <RebHeader eyebrow="Rebanho · Consultas operacionais" title="Relatórios" />
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-leite">Rebanho · Consultas operacionais</p>
        <h1 className="mt-1 font-serif text-[30px] font-medium">Relatórios</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-3">Parta de um modelo, cruze os filtros e monte a lista com as colunas que fazem sentido para o manejo. A mesma composição segue para a tela, CSV e PDF.</p>
      </div>
      {folhas.data.length > 0 && <section className="mb-5" aria-labelledby="folhas-campo-titulo">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="folhas-campo-titulo" className="m-0 font-serif text-xl font-medium">Folhas em aberto</h2><p className="mb-0 mt-1 text-sm text-ink-3">Retome o lançamento dos dados que voltaram do campo.</p></div></div>
        <div className="grid gap-3 md:grid-cols-2">{folhas.data.map((folha) => <RebBox key={folha.id} className="mb-0">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-sm text-foreground">{folha.nome}</strong><p className="mb-0 mt-1 text-xs text-ink-3">{folha.linhasProntas}/{folha.totalLinhas} resolvidas · {folha.status.replaceAll("_", " ")}</p></div><div className="flex gap-2"><RebButton onClick={() => void imprimirFolha(folha)} disabled={exportandoPdf}>Imprimir</RebButton><RebButton variant="pri" onClick={() => setFolhaAberta(folha)}>Lançar dados</RebButton></div></div>
        </RebBox>)}</div>
      </section>}
      <RebBox className="p-5">
        <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2 xl:grid-cols-4">
          <RebField label="Modelo de relatório" className="md:col-span-2">
            <RebSelect aria-label="Modelo de relatório" value={templateId} onChange={(v) => { setTemplateId(v as FiltrosRelatorioRebanho["templateId"]); setFiltrosColunas({}); }}>
              {fases.map((fase) => <optgroup key={fase} label={fase}>{templates.filter((t) => t.fase === fase).map((t) => <option key={t.id} value={t.id} data-descricao={t.descricao}>{t.titulo}</option>)}</optgroup>)}
              {!templates.length && <option value="ia-periodo">Inseminações no período</option>}
            </RebSelect>
          </RebField>
          <RebField label="Situação do animal"><RebSelect aria-label="Situação do animal" value={status} onChange={(v) => setStatus(v as FiltrosRelatorioRebanho["status"])}><option value="ATIVO" data-descricao="Animais que estão no rebanho hoje.">Ativos</option><option value="BAIXADO" data-descricao="Animais que já saíram do rebanho.">Baixados</option><option value="TODOS" data-descricao="Ativos e baixados juntos.">Todos</option></RebSelect></RebField>
          <RebField label="Categoria"><RebSelect aria-label="Categoria" value={categoria} onChange={setCategoria}>{CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</RebSelect></RebField>
          <RebField label="Animal"><input aria-label="Animal" value={animal} onChange={(e) => setAnimal(e.target.value)} placeholder="Número ou nome" /></RebField>
          <RebField label="Grupo"><SelectBusca variante="sublinhado" aria-label="Grupo" value={grupoId} onValueChange={setGrupoId} opcaoVazia="Todos os grupos" buscaPlaceholder="Buscar grupo…" options={grupos.data.map((g) => ({ value: String(g.id), label: g.nome }))} /></RebField>
          <RebField label="Setor"><RebSelect aria-label="Setor" value={setor} onChange={setSetor}><option value="">Todos os setores</option>{setores.data.map((s) => <option key={s} value={s}>{s}</option>)}</RebSelect></RebField>
          {template?.filtrosEspecificos.includes("reprodutor") && <RebField label="Touro ou sêmen"><input aria-label="Touro ou sêmen" value={reprodutor} onChange={(e) => setReprodutor(e.target.value)} placeholder="Nome ou código" /></RebField>}
          {template?.filtrosEspecificos.includes("protocolo") && <RebField label="Protocolo"><input aria-label="Protocolo" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Ex.: IATF 11d" /></RebField>}
          {template?.filtrosEspecificos.includes("resultado") && <RebField label="Resultado"><RebSelect aria-label="Resultado" value={resultado} onChange={setResultado}><option value="">Todos</option><option value="positivo">Positivo</option><option value="negativo">Negativo</option></RebSelect></RebField>}
        </div>
        {!!template?.colunas?.length && <fieldset className="mb-4 border-t border-line pt-4">
          <legend className="pr-3 font-serif text-sm font-medium italic text-ink-3">Delimitar por parâmetros</legend>
          <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2 xl:grid-cols-4">
            {(template.colunas ?? []).map((coluna) => coluna.tipo === "texto" ? <RebField key={coluna.chave} label={coluna.rotulo}>
              <input aria-label={`Filtrar ${coluna.rotulo}`} value={filtrosColunas[coluna.chave]?.valor ?? ""} onChange={(e) => atualizarFiltro(coluna.chave, "valor", e.target.value)} placeholder="Contém..." />
            </RebField> : <div key={coluna.chave} className="grid grid-cols-2 gap-2">
              <RebField label={`${coluna.rotulo} — mínimo`}>{coluna.tipo === "data"
                ? <CampoData variante="sublinhado" aria-label={`${coluna.rotulo} mínimo`} value={filtrosColunas[coluna.chave]?.minimo ?? ""} onChange={(v) => atualizarFiltro(coluna.chave, "minimo", v)} />
                : <input type="number" aria-label={`${coluna.rotulo} mínimo`} value={filtrosColunas[coluna.chave]?.minimo ?? ""} onChange={(e) => atualizarFiltro(coluna.chave, "minimo", e.target.value)} />}</RebField>
              <RebField label={`${coluna.rotulo} — máximo`}>{coluna.tipo === "data"
                ? <CampoData variante="sublinhado" aria-label={`${coluna.rotulo} máximo`} value={filtrosColunas[coluna.chave]?.maximo ?? ""} onChange={(v) => atualizarFiltro(coluna.chave, "maximo", v)} />
                : <input type="number" aria-label={`${coluna.rotulo} máximo`} value={filtrosColunas[coluna.chave]?.maximo ?? ""} onChange={(e) => atualizarFiltro(coluna.chave, "maximo", e.target.value)} />}</RebField>
            </div>)}
          </div>
        </fieldset>}
        {exigePeriodo && <div className="mb-4"><span className="mb-1.5 block font-serif text-sm font-medium italic text-ink-3">Período</span><DateRangePicker value={range} onChange={setRange} /></div>}
        {template && <p className="mb-4 text-sm text-ink-3">{template.descricao}</p>}
        <RebButton variant="pri" aria-label="Gerar relatório" onClick={gerar}>Gerar relatório</RebButton>
      </RebBox>
      <RelatorioResultado
        data={relatorio.data} loading={relatorio.loading} erro={relatorio.erro}
        onAbrirFicha={onAbrirFicha} onRegistrar={onRegistrar}
        onExportarCsv={(colunas) => { if (relatorio.data) baixarRelatorioCsv(relatorio.data, colunas); }}
        onExportarPdf={exportarPdf} onMontarFormulario={() => setMontandoFormulario(true)} exportandoPdf={exportandoPdf}
        colunasVisiveis={colunasVisiveis} onColunasVisiveis={setColunasVisiveis}
      />
      {montandoFormulario && relatorio.data && filtrosAplicados && <FormularioCampoModal
        relatorio={relatorio.data}
        filtros={filtrosAplicados}
        onClose={() => setMontandoFormulario(false)}
        onCriada={(folha) => { folhas.recarregar(); setFolhaAberta(folha); }}
      />}
    </RebMain>
  );
}
