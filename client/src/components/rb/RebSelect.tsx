/* RebSelect — substituto shadcn (Radix) para o <select> nativo dos formulários.
 *
 * Aceita os MESMOS filhos <option>/<optgroup> do <select> nativo, então a
 * migração é quase um find-replace:
 *   <select className="rb-field-select" value={x} onChange={(e) => set(k, e.target.value)}>…</select>
 *   →  <RebSelect value={x} onChange={(v) => set(k, v)}>…</RebSelect>
 * (o onChange passa a receber o valor — string — direto, não o evento.)
 *
 * O gatilho tem o look de campo sublinhado dos <input> do RebField (borda-inferior
 * transparente → café no foco/aberto), então cai natural dentro de <RebField>.
 * Radix proíbe SelectItem com value="" — mapeamos "" ↔ __vazio__ internamente
 * (o <option value=""> continua sendo um item selecionável, ex.: "—"). */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VAZIO = "__vazio__";
const s = (v: unknown) => (v == null ? "" : String(v));

// Gatilho sublinhado — espelha [&_select] do RebField: full-width, sem box, só a
// borda-inferior (café no aberto/foco). O chevron vem do próprio SelectTrigger.
const TRIGGER =
  "h-auto w-full justify-between rounded-none border-0 border-b border-b-border bg-transparent px-0.5 py-2 text-sm font-normal text-foreground hover:border-b-ink-2 focus-visible:border-b-[color:var(--cafe)] focus-visible:outline-none data-[state=open]:border-b-[color:var(--cafe)]";

type OptEl = React.ReactElement<{ value?: unknown; children?: React.ReactNode; disabled?: boolean }>;
type GroupEl = React.ReactElement<{ label?: string; children?: React.ReactNode }>;

const isEl = (node: React.ReactNode, type: string): boolean =>
  React.isValidElement(node) && (node.type as unknown) === type;

// Label (children) da <option> cujo value casa com `val` — procura dentro de <optgroup> também.
function acharLabel(children: React.ReactNode, val: string): React.ReactNode | undefined {
  let achou: React.ReactNode | undefined;
  const visitar = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (n) => {
      if (achou !== undefined) return;
      if (isEl(n, "option")) {
        const el = n as OptEl;
        if (s(el.props.value) === val) achou = el.props.children;
      } else if (isEl(n, "optgroup")) {
        visitar((n as GroupEl).props.children);
      }
    });
  };
  visitar(children);
  return achou;
}

function renderItem(el: OptEl, key: React.Key) {
  const val = s(el.props.value);
  return (
    <SelectItem key={key} value={val === "" ? VAZIO : val} disabled={el.props.disabled}>
      {el.props.children}
    </SelectItem>
  );
}

// Converte <option>/<optgroup> em <SelectItem>/<SelectGroup>+<SelectLabel>.
function renderOpcoes(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (n, i) => {
    if (isEl(n, "option")) return renderItem(n as OptEl, i);
    if (isEl(n, "optgroup")) {
      const g = n as GroupEl;
      return (
        <SelectGroup key={i}>
          {g.props.label != null && <SelectLabel>{g.props.label}</SelectLabel>}
          {React.Children.map(g.props.children, (o, j) =>
            isEl(o, "option") ? renderItem(o as OptEl, `${i}-${j}`) : null,
          )}
        </SelectGroup>
      );
    }
    return null; // ignora espaços/null/comentários
  });
}

export interface RebSelectProps {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  /** filhos <option>/<optgroup>, iguais aos do <select> nativo */
  children: React.ReactNode;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function RebSelect({
  value,
  onChange,
  children,
  className,
  placeholder,
  disabled,
  id,
  "aria-label": ariaLabel,
}: RebSelectProps) {
  const val = s(value);
  const label = acharLabel(children, val);
  return (
    <Select
      value={val === "" ? VAZIO : val}
      onValueChange={(v) => onChange(v === VAZIO ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn(TRIGGER, className)}>
        <SelectValue placeholder={placeholder}>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>{renderOpcoes(children)}</SelectContent>
    </Select>
  );
}
