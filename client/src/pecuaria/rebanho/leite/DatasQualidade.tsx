import { DatePicker } from "../../../components/DatePicker";
import { Input } from "@/components/ui/input";
import { formatarDataBR } from "../lib/rotulos";

export function DatasQualidade({ dataResultadoLaboratorial, dataRecebimentoLaudo, criadoEm }: {
  dataResultadoLaboratorial?: string | null;
  dataRecebimentoLaudo?: string | null;
  criadoEm?: string;
}) {
  return <div className="grid gap-1">
    <small>Resultado laboratorial: {dataResultadoLaboratorial ? formatarDataBR(dataResultadoLaboratorial) : "Não informado"}</small>
    <small>Recebimento do laudo: {dataRecebimentoLaudo ? formatarDataBR(dataRecebimentoLaudo) : "Não informado"}</small>
    {criadoEm && <small>Cadastro da amostra: {new Date(criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>}
  </div>;
}

export function CamposDatasQualidade({ resultado, recebimento, onResultado, onRecebimento }: {
  resultado: string; recebimento: string;
  onResultado: (valor: string) => void; onRecebimento: (valor: string) => void;
}) {
  return <div className="leite-form-inline">
    <label>Data do resultado laboratorial (opcional)<DatePicker value={resultado} onChange={(valor) => onResultado(valor)} /></label>
    <label>Data de recebimento do laudo (opcional)<DatePicker value={recebimento} onChange={(valor) => onRecebimento(valor)} /></label>
  </div>;
}
