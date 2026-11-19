import { useEffect, useId, useRef, useState } from "react";

export const numeroDigitadoTablet = (valor: string) => Number(valor.trim().replace(",", "."));
export function erroNumeroTablet(valor: string, inteiro = false, min = 0.001, max = 999999999) {
  if (!valor.trim()) return "";
  if (!/^(?:\d+(?:[.,]\d{0,3})?|[.,]\d{1,3})$/.test(valor.trim())) return "Informe um número com até três casas decimais.";
  const n = numeroDigitadoTablet(valor);
  if (inteiro && !Number.isInteger(n)) return "Informe uma quantidade inteira.";
  if (n < min || n > max) return `Informe um valor entre ${min.toLocaleString("pt-BR")} e ${max.toLocaleString("pt-BR")}.`;
  return "";
}

export function CampoNumericoTablet({ valor, onChange, rotulo, className, inteiro = false, min = 0.001, max = 999999999, required = false, placeholder, enterKeyHint = "next" }: {
  valor: string; onChange: (valor: string) => void; rotulo: string; className?: string; inteiro?: boolean; min?: number; max?: number;
  required?: boolean; placeholder?: string; enterKeyHint?: "next" | "done";
}) {
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  const [conferido, setConferido] = useState(false);
  const erro = erroNumeroTablet(valor, inteiro, min, max);
  useEffect(() => { campo.current?.setCustomValidity(erro); }, [erro]);
  return <><input ref={campo} data-tablet-numerico className={className} type="text" inputMode={inteiro ? "numeric" : "decimal"}
    autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint={enterKeyHint}
    aria-label={rotulo} required={required} placeholder={placeholder} value={valor} maxLength={24}
    aria-invalid={conferido && !!erro} aria-describedby={conferido && erro ? id : undefined}
    onChange={e => onChange(e.target.value)} onFocus={e => { e.currentTarget.select(); }} onBlur={() => setConferido(true)}
    onInvalid={() => setConferido(true)} onKeyDown={e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!e.currentTarget.reportValidity()) return;
      const campos = [...(e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[data-tablet-numerico]:not(:disabled)') ?? [])];
      const seguinte = campos[campos.indexOf(e.currentTarget) + 1];
      if (seguinte) seguinte.focus(); else e.currentTarget.blur();
    }} />{conferido && erro && <span id={id} role="alert" className="tablet-numero-erro">{erro}</span>}</>;
}
