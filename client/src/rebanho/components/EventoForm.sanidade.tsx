import { useProdutos, useRegistrarEventoSanitario, useEditarEventoSanitario, type EventoSanidadePayload } from "../api";
import { RebField } from "@/components/rb/RebField";
import { useToast } from "@/components/Toast";
import { useSalvarOffline } from "@/lib/offline/useSalvarOffline";

export const TIPOS_SAN: { v: EventoSanidadePayload["tipo"]; label: string }[] = [
  { v: "OCORRENCIA", label: "Ocorrência" }, { v: "APLICACAO", label: "Aplicação" }, { v: "EXAME", label: "Exame" }, { v: "MASTITE", label: "Mastite" }, { v: "VACINA", label: "Vacina" },
];

export const QUARTOS_UBERE = ["AD", "AE", "PD", "PE"]; // anterior/posterior · direito/esquerdo
export const SEVERIDADES_MASTITE = ["Subclínica", "Clínica leve", "Clínica moderada", "Clínica grave"];

const num = (v: string) => (v.trim() !== "" ? Number(v) : undefined);

export function montarPayloadSanidade(tipoSan: EventoSanidadePayload["tipo"], f: any): EventoSanidadePayload {
  const p: EventoSanidadePayload = { tipo: tipoSan, data: f.data, observacao: f.observacao || undefined };
  if (tipoSan === "EXAME") { p.ccs = num(f.ccs); p.gordura = num(f.gordura); p.proteina = num(f.proteina); }
  if (tipoSan === "APLICACAO") { p.produto = f.produto; p.dose = f.dose || undefined; p.carencia = num(f.carencia); p.loteProduto = f.loteProduto || undefined; }
  if (tipoSan === "OCORRENCIA") { p.doenca = f.doenca; p.diasTratamento = num(f.diasTratamento); }
  if (tipoSan === "MASTITE") { p.quarto = f.quarto || undefined; p.severidade = f.severidade || undefined; p.resultadoCultivo = f.resultadoCultivo || undefined; }
  if (tipoSan === "VACINA") p.produto = f.produto;
  if (tipoSan === "APLICACAO" || tipoSan === "VACINA") {
    p.produtoId = f.estoqueProdutoId ? Number(f.estoqueProdutoId) : undefined;
    p.quantidadeUsada = num(f.estoqueQtd);
  }
  return p;
}

export function useSanidadeEscrita() {
  const { data: produtosEstoque } = useProdutos({ ativo: true });
  const registrar = useRegistrarEventoSanitario();
  const editar = useEditarEventoSanitario();
  const toast = useToast();
  const { salvando, salvar: enviar } = useSalvarOffline();
  return { produtosEstoque, registrar, editar, toast, salvando, enviar };
}

export function SanidadeCampos({ tipoSan, f, set, setF, produtosEstoque }: {
  tipoSan: EventoSanidadePayload["tipo"];
  f: any;
  set: (k: string, v: string) => void;
  setF: (updater: (s: any) => any) => void;
  produtosEstoque: { id: number; nome: string; unidade: string }[];
}) {
  const escolherProduto = (id: string) => {
    setF((s: any) => ({ ...s, estoqueProdutoId: id, ...(id ? { produto: produtosEstoque.find((p) => String(p.id) === id)?.nome ?? s.produto } : {}) }));
  };
  return (
    <>
      {tipoSan === "EXAME" && <>
        <RebField label="CCS (mil)*"><input type="number" min={0} value={f.ccs} onChange={(e) => set("ccs", e.target.value)} /></RebField>
        <RebField label="Gordura (%)"><input type="number" step="0.01" value={f.gordura} onChange={(e) => set("gordura", e.target.value)} /></RebField>
        <RebField label="Proteína (%)"><input type="number" step="0.01" value={f.proteina} onChange={(e) => set("proteina", e.target.value)} /></RebField>
      </>}
      {tipoSan === "APLICACAO" && <>
        <RebField label="Produto*">
          <select className="rb-field-select" value={f.estoqueProdutoId} onChange={(e) => escolherProduto(e.target.value)}>
            <option value="">— selecione —</option>
            {produtosEstoque.map((pr) => <option key={pr.id} value={pr.id}>{pr.nome} ({pr.unidade})</option>)}
          </select>
        </RebField>
        <RebField label="Qtd. usada*"><input type="number" min={0.01} step="0.01" value={f.estoqueQtd} onChange={(e) => set("estoqueQtd", e.target.value)} placeholder="1" /></RebField>
        <RebField label="Dose"><input value={f.dose} onChange={(e) => set("dose", e.target.value)} placeholder="1 bisnaga" /></RebField>
        <RebField label="Carência (h)"><input type="number" min={0} value={f.carencia} onChange={(e) => set("carencia", e.target.value)} /></RebField>
        <RebField label="Lote do produto"><input value={f.loteProduto} onChange={(e) => set("loteProduto", e.target.value)} placeholder="MAST-2231" /></RebField>
      </>}
      {tipoSan === "OCORRENCIA" && <>
        <RebField label="Doença*"><input value={f.doenca} onChange={(e) => set("doenca", e.target.value)} placeholder="Mastite clínica" /></RebField>
        <RebField label="Dias de tratamento"><input type="number" min={0} value={f.diasTratamento} onChange={(e) => set("diasTratamento", e.target.value)} /></RebField>
      </>}
      {tipoSan === "MASTITE" && <>
        <RebField label="Quarto">
          <select className="rb-field-select" value={f.quarto} onChange={(e) => set("quarto", e.target.value)}>
            {QUARTOS_UBERE.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </RebField>
        <RebField label="Severidade">
          <select className="rb-field-select" value={f.severidade} onChange={(e) => set("severidade", e.target.value)}>
            {SEVERIDADES_MASTITE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </RebField>
        <RebField label="Resultado do cultivo"><input value={f.resultadoCultivo} onChange={(e) => set("resultadoCultivo", e.target.value)} placeholder="ex.: Staphylococcus aureus" /></RebField>
      </>}
      {tipoSan === "VACINA" && <>
        <RebField label="Produto*">
          <select className="rb-field-select" value={f.estoqueProdutoId} onChange={(e) => escolherProduto(e.target.value)}>
            <option value="">— selecione —</option>
            {produtosEstoque.map((pr) => <option key={pr.id} value={pr.id}>{pr.nome} ({pr.unidade})</option>)}
          </select>
        </RebField>
        <RebField label="Qtd. usada*"><input type="number" min={0.01} step="0.01" value={f.estoqueQtd} onChange={(e) => set("estoqueQtd", e.target.value)} placeholder="1" /></RebField>
      </>}
    </>
  );
}
