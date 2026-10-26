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
    <label>Data do resultado laboratorial (opcional)<input type="date" value={resultado} onChange={e => onResultado(e.target.value)} /></label>
    <label>Data de recebimento do laudo (opcional)<input type="date" value={recebimento} onChange={e => onRecebimento(e.target.value)} /></label>
  </div>;
}
