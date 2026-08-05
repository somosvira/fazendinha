import { useEffect, useMemo, useState } from "react";
import { DateRangePicker, type DateRange } from "../../components/DateRangePicker";
import { getHoje } from "../../lib/hoje";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
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
  const [reprodutor, setReprodutor] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [resultado, setResultado] = useState("");
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
  const exigePeriodo = templateId !== "gestantes-atual";
  const fases = useMemo(() => Array.from(new Set(templates.map((t) => t.fase))), [templates]);

  function gerar() {
    setColunasVisiveis([]);
    setFiltrosAplicados({
      templateId,
      ...(exigePeriodo ? { dataInicio: isoLocal(range.start), dataFim: isoLocal(range.end) } : {}),
      status,
      ...(grupoId ? { grupoId: Number(grupoId) } : {}),
      ...(setor ? { setor } : {}),
      ...(categoria ? { categoria } : {}),
      ...(reprodutor.trim() ? { reprodutor: reprodutor.trim() } : {}),
      ...(protocolo.trim() ? { protocolo: protocolo.trim() } : {}),
      ...(resultado ? { resultado: resultado as "positivo" | "negativo" } : {}),
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
            <select aria-label="Modelo de relatório" value={templateId} onChange={(e) => setTemplateId(e.target.value as FiltrosRelatorioRebanho["templateId"])}>
              {fases.map((fase) => <optgroup key={fase} label={fase}>{templates.filter((t) => t.fase === fase).map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}</optgroup>)}
              {!templates.length && <option value="ia-periodo">Inseminações no período</option>}
            </select>
          </RebField>
          <RebField label="Situação do animal"><select value={status} onChange={(e) => setStatus(e.target.value as FiltrosRelatorioRebanho["status"])}><option value="ATIVO">Ativos</option><option value="BAIXADO">Baixados</option><option value="TODOS">Todos</option></select></RebField>
          <RebField label="Categoria"><select value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></RebField>
          <RebField label="Grupo"><select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}><option value="">Todos os grupos</option>{grupos.data.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></RebField>
          <RebField label="Setor"><select value={setor} onChange={(e) => setSetor(e.target.value)}><option value="">Todos os setores</option>{setores.data.map((s) => <option key={s} value={s}>{s}</option>)}</select></RebField>
          {template?.filtrosEspecificos.includes("reprodutor") && <RebField label="Touro ou sêmen"><input aria-label="Touro ou sêmen" value={reprodutor} onChange={(e) => setReprodutor(e.target.value)} placeholder="Nome ou código" /></RebField>}
          {template?.filtrosEspecificos.includes("protocolo") && <RebField label="Protocolo"><input aria-label="Protocolo" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Ex.: IATF 11d" /></RebField>}
          {template?.filtrosEspecificos.includes("resultado") && <RebField label="Resultado"><select value={resultado} onChange={(e) => setResultado(e.target.value)}><option value="">Todos</option><option value="positivo">Positivo</option><option value="negativo">Negativo</option></select></RebField>}
        </div>
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
