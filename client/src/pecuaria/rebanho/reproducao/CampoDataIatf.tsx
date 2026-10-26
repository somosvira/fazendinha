import { DatePicker } from "../../../components/DatePicker";
import { Input } from "../../../components/ui/input";
import { classeInput } from "../../../financeiro/PainelCadastro";

/** O valor sem T conserva somente o dia. Hora vazia não significa meia-noite. */
export function CampoDataIatf({ valor, onChange, rotulo, disabled, onBlur }: {
  valor: string; onChange: (valor: string) => void; rotulo: string; disabled?: boolean; onBlur?: () => void;
}) {
  const [data = "", hora = ""] = valor.split("T");
  return <fieldset disabled={disabled} onBlur={onBlur} className="grid gap-2 sm:grid-cols-2">
    <label className="text-sm">{rotulo}<DatePicker aria-label={rotulo} className={classeInput}  required value={data}
      onChange={valor => onChange(valor ? `${valor}${hora ? `T${hora}` : ""}` : "")} /></label>
    <label className="text-sm">Horário (opcional)<Input aria-label={`Horário (opcional) · ${rotulo}`} className={classeInput} type="time" value={hora} disabled={!data}
      onChange={e => onChange(`${data}${e.target.value ? `T${e.target.value}` : ""}`)} /></label>
  </fieldset>;
}

export function dataHoraISO(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const d = new Date(valor);
    if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor) return valor;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) {
    const d = new Date(`${valor}:00-03:00`);
    if (Number.isFinite(d.getTime()) && inputHorarioIatf(d.toISOString()) === valor) return d.toISOString();
  }
  throw new Error("Informe uma data válida e, se conhecido, o horário.");
}

export function horarioIatf(valor: string, precisao: "DIA" | "HORA" = "HORA") {
  if (precisao === "DIA" || valor.length === 10) return `${new Intl.DateTimeFormat("pt-BR", {timeZone:"UTC", dateStyle:"short"}).format(new Date(valor.slice(0,10)))} · horário não informado`;
  return new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(new Date(valor));
}

export function inputHorarioIatf(valor: string, precisao: "DIA" | "HORA" = "HORA") {
  if (precisao === "DIA" || valor.length === 10) return valor.slice(0,10);
  const partes = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(valor));
  const p = (tipo: string) => partes.find(p => p.type === tipo)?.value;
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
