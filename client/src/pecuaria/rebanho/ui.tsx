// Peças compartilhadas pelas telas do Rebanho que NÃO existem no financeiro
// (as que existem — PaginaFinanceira, PageHeader, Panel, Modal, TabelaFinanceira,
// etc. — vêm de client/src/financeiro/financeiro-ui.tsx e devem ser importadas
// de lá, não recriadas aqui). Mesmo padrão visual: ver docs/design do plano
// "Pecuária v1 — interface completa no padrão do Financeiro".

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { Button, ErrorBox, Modal } from "../../financeiro/financeiro-ui";
import { classeInput } from "../../financeiro/PainelCadastro";
import { PRESETS_FRACAO, somaFracoes } from "./lib/composicao";
import type { CatalogoRaca, ComposicaoItemInput } from "./types";

/** Container da barra de busca/filtros no topo de um Panel — mesma moldura da
 *  lista de Operações financeiras (borda inferior + padding). Os filtros em si
 *  (input de busca, selects) ficam com quem chama. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">{children}</div>;
}

/** Paginação no rodapé de um Panel — mesmo texto "a–b de N" e os mesmos
 *  controles (Anterior/select de página/Próxima) da lista de Operações
 *  financeiras. */
export function Paginacao({ paginaAtual, totalPaginas, totalItens, itensPorPagina, onPaginaChange, rotulo, idSelect }: {
  paginaAtual: number;
  totalPaginas: number;
  totalItens: number;
  itensPorPagina: number;
  onPaginaChange: (pagina: number) => void;
  /** substantivo no plural para o texto de contagem, ex. "animais", "operações" */
  rotulo: string;
  idSelect: string;
}) {
  const inicio = totalItens === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1;
  const fim = Math.min(paginaAtual * itensPorPagina, totalItens);
  return <nav aria-label={`Paginação de ${rotulo}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
    <span className="text-ink-3">{totalItens === 0 ? `0 ${rotulo}` : `${inicio}–${fim} de ${totalItens} ${rotulo}`}</span>
    <div className="flex items-center gap-2">
      <Button secondary disabled={paginaAtual <= 1} onClick={() => onPaginaChange(paginaAtual - 1)}>Anterior</Button>
      <label className="sr-only" htmlFor={idSelect}>Ir para a página</label>
      <select id={idSelect} aria-label="Ir para a página" value={paginaAtual} onChange={(e) => onPaginaChange(Number(e.target.value))} className="h-10 rounded-lg border border-border bg-white px-2 text-sm">
        {Array.from({ length: Math.max(1, totalPaginas) }, (_, indice) => <option key={indice + 1} value={indice + 1}>Página {indice + 1} de {Math.max(1, totalPaginas)}</option>)}
      </select>
      <Button secondary disabled={paginaAtual >= totalPaginas} onClick={() => onPaginaChange(paginaAtual + 1)}>Próxima</Button>
    </div>
  </nav>;
}

/** Sub-abas sublinhadas genéricas — mesmo visual das abas de Configurações
 *  financeiras e da navegação principal do Rebanho (`NavRebanho`), mas
 *  parametrizadas para uso local dentro de uma tela (ex.: Lotes · Raças ·
 *  Motivos de saída · Sítios em Cadastros). */
export function SubAbas<T extends string>({ abas, ativa, onSelecionar }: {
  abas: { valor: T; rotulo: string; icon?: LucideIcon }[];
  ativa: T;
  onSelecionar: (valor: T) => void;
}) {
  return <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border">
    {abas.map(({ valor, rotulo, icon: Icon }) => <button key={valor} type="button" onClick={() => onSelecionar(valor)} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${ativa === valor ? "border-mast text-ink" : "border-transparent text-ink-3"}`}>{Icon && <Icon size={16} className="shrink-0" />}{rotulo}</button>)}
  </div>;
}

/** Editor de composição racial: raça + fração em 64 avos, com pré-sets e
 *  validação de soma <= 64 (mesma regra de lib/composicao.ts). Usado no
 *  cadastro do animal e na edição de composição. */
export function CampoComposicao({ racas, itens, onChange, erro }: {
  racas: CatalogoRaca[];
  itens: ComposicaoItemInput[];
  onChange: (itens: ComposicaoItemInput[]) => void;
  erro?: string;
}) {
  const soma = somaFracoes(itens);
  const atualizar = (indice: number, patch: Partial<ComposicaoItemInput>) =>
    onChange(itens.map((item, i) => (i === indice ? { ...item, ...patch } : item)));
  const remover = (indice: number) => onChange(itens.filter((_, i) => i !== indice));
  const adicionar = () => onChange([...itens, { racaId: "", fracao64: 0 }]);

  return <div className="space-y-3">
    {itens.map((item, indice) => <div key={indice} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
      <div className="min-w-[180px] flex-1 text-sm font-medium">
        <label htmlFor={`composicao-raca-${indice}`}>Raça</label>
        <select id={`composicao-raca-${indice}`} className={classeInput} value={item.racaId} onChange={(e) => atualizar(indice, { racaId: e.target.value })}>
          <option value="">Selecione</option>
          {racas.map((raca) => <option key={raca.id} value={raca.id}>{raca.nome} ({raca.sigla})</option>)}
        </select>
      </div>
      <div className="w-28 text-sm font-medium">
        <label htmlFor={`composicao-fracao-${indice}`}>Fração (/64)</label>
        <input id={`composicao-fracao-${indice}`} type="number" min={1} max={64} className={classeInput} value={item.fracao64 || ""} onChange={(e) => atualizar(indice, { fracao64: Number(e.target.value) })} />
      </div>
      <div className="flex flex-wrap gap-1 pb-0.5">
        {PRESETS_FRACAO.map((preset) => <button key={preset.label} type="button" onClick={() => atualizar(indice, { fracao64: preset.fracao64 })} className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-2">{preset.label}</button>)}
      </div>
      <button type="button" onClick={() => remover(indice)} aria-label="Remover raça da composição" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-red-700"><X size={16} /></button>
    </div>)}
    <button type="button" onClick={adicionar} className="text-sm font-semibold text-mast hover:underline">+ Adicionar raça</button>
    <p className={`text-xs ${soma > 64 ? "font-semibold text-red-700" : "text-ink-3"}`}>Soma atual: {soma}/64{soma > 64 ? " — reduza para no máximo 64" : ""}</p>
    {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
  </div>;
}

/** Modal de ação irreversível com motivo obrigatório (>= 5 caracteres) — mesmo
 *  padrão do estorno em OperacaoFinanceiraDetalhe.tsx: caixa de impacto (op.),
 *  textarea de motivo e botões Manter/Confirmar. Usado em saída, estorno de
 *  saída e "excluir cadastro" do animal. */
export function ModalMotivo({ titulo, eyebrow, impacto, labelMotivo = "Motivo", labelManter, labelConfirmar, confirmando, erro, onConfirmar, onFechar }: {
  titulo: string;
  eyebrow: string;
  impacto?: ReactNode;
  labelMotivo?: string;
  labelManter: string;
  labelConfirmar: string;
  confirmando: boolean;
  erro?: string | null;
  onConfirmar: (motivo: string) => void;
  onFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  return <Modal titulo={titulo} eyebrow={eyebrow} onClose={() => { if (!confirmando) onFechar(); }}>
    <div className="p-6">
      <ErrorBox erro={erro ?? null} />
      {impacto && <div className="mt-2 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-950">{impacto}</div>}
      <label className="mt-5 block text-sm font-medium">{labelMotivo} *
        <textarea aria-label={labelMotivo} maxLength={300} disabled={confirmando} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-border bg-white p-3 font-normal" />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button secondary disabled={confirmando} onClick={onFechar}>{labelManter}</Button>
        <Button danger disabled={confirmando || motivo.trim().length < 5} onClick={() => onConfirmar(motivo.trim())}>{confirmando ? "Salvando…" : labelConfirmar}</Button>
      </div>
    </div>
  </Modal>;
}
