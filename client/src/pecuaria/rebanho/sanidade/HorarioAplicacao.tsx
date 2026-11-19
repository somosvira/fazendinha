import { useEffect, useId, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function erroHorarioAplicacao(valor: string, max?: string) {
  if (!valor) return "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return "Informe uma hora válida no formato HH:mm.";
  return max && valor > max ? `Informe uma hora até ${max}.` : "";
}

export function HorarioAplicacao({ valor, max, onChange }: { valor: string; max?: string; onChange: (valor: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const idErro = useId();
  const erro = erroHorarioAplicacao(valor, max);
  const [hora = "", minuto = ""] = valor.split(":");
  useEffect(() => { input.current?.setCustomValidity(erro); }, [erro]);
  return <div className="tablet-horario">
    <div className="tablet-horario-campo">
      <input ref={input} className="tablet-aplicacao-input" type="text" inputMode="numeric" autoComplete="off" enterKeyHint="done" onFocus={e => e.currentTarget.select()} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (e.currentTarget.reportValidity()) e.currentTarget.blur(); } }} required
        aria-label="Hora da aplicação" aria-invalid={!!erro} aria-describedby={erro ? idErro : undefined}
        placeholder="HH:mm" value={valor} onChange={e => {
          const digitos = e.target.value.replace(/\D/g, "").slice(0, 4);
          onChange(digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos);
        }} />
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild><button type="button" aria-label="Selecionar horário" className="tablet-horario-abrir"><Clock size={18} aria-hidden /></button></PopoverTrigger>
        <PopoverContent align="end" className="tablet-horario-popup" aria-label="Selecionar horário" onOpenAutoFocus={evento => {
          const painel = evento.target;
          if (!(painel instanceof HTMLElement)) return;
          const marcados = painel.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]');
          marcados.forEach(botao => botao.scrollIntoView({ block: "nearest" }));
          if (marcados[0]) { evento.preventDefault(); marcados[0].focus({ preventScroll: true }); }
        }}>
          <div className="tablet-horario-colunas">
            <div><h3>Hora</h3><div role="group" aria-label="Horas" className="tablet-horario-opcoes">
              {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => <button type="button" key={h}
                disabled={!!max && h > max.slice(0, 2)} aria-pressed={hora === h} onClick={() => onChange(`${h}:${minuto || "00"}`)}>{h}</button>)}
            </div></div>
            <div><h3>Minuto</h3><div role="group" aria-label="Minutos" className="tablet-horario-opcoes">
              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(m => <button type="button" key={m}
                disabled={!!max && hora === max.slice(0, 2) && m > max.slice(3, 5)} aria-pressed={minuto === m} onClick={() => onChange(`${hora || "00"}:${m}`)}>{m}</button>)}
            </div></div>
          </div>
          <button type="button" className="tablet-horario-concluir" onClick={() => setAberto(false)}>Concluir</button>
        </PopoverContent>
      </Popover>
    </div>
    {erro && <p className="tablet-horario-erro" id={idErro} role="status">{erro}</p>}
  </div>;
}
