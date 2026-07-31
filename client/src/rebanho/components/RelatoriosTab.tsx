import { useEffect, useMemo, useRef, useState } from "react";
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
  type FiltrosRelatorioRebanho,
  type LinhaRelatorioRebanhoDTO,
  type ResultadoRelatorioRebanhoDTO,
  type TemplateRelatorioRebanhoDTO,
} from "../api";
import { RebHeader } from "./RebHeader";
import { RelatorioResultado } from "./RelatorioResultado";
import { baixarRelatorioCsv, exportarRelatorioPdf } from "./relatorioExport";

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
  const grupos = useGrupos();
  const setores = useSetores();
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosRelatorioRebanho | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const relatorio = useRelatorioRebanho(filtrosAplicados);

  useEffect(() => {
    listarTemplatesRelatorioRebanho().then(setTemplates).catch(() => setTemplates([]));
  }, []);
  useEffect(() => { if (filtrosAplicados) relatorio.recarregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshToken]);

  const template = templates.find((t) => t.id === templateId);
  const exigePeriodo = templateId !== "gestantes-atual";
  const fases = useMemo(() => Array.from(new Set(templates.map((t) => t.fase))), [templates]);

  function gerar() {
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

  async function exportarPdf() {
    if (!printRef.current || !relatorio.data) return;
    setExportandoPdf(true);
    try { await exportarRelatorioPdf(printRef.current, relatorio.data); }
    finally { setExportandoPdf(false); }
  }

  return (
    <RebMain>
      <RebHeader eyebrow="Rebanho · Consultas operacionais" title="Relatórios" />
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-leite">Rebanho · Consultas operacionais</p>
        <h1 className="mt-1 font-serif text-[30px] font-medium">Relatórios</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-3">Escolha um formulário pronto, ajuste os filtros e gere a lista. Os modelos desta primeira etapa acompanham reprodução, gestação, parto e secagem.</p>
      </div>
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
        data={relatorio.data} loading={relatorio.loading} erro={relatorio.erro} printRef={printRef}
        onAbrirFicha={onAbrirFicha} onRegistrar={onRegistrar}
        onExportarCsv={() => { if (relatorio.data) baixarRelatorioCsv(relatorio.data); }}
        onExportarPdf={exportarPdf} exportandoPdf={exportandoPdf}
      />
    </RebMain>
  );
}
