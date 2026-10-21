import { ContextoFiltroColuna } from "@/components/ContextoFiltroColuna";
import { useState, type ReactNode } from "react";
import { Settings2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import "./operacoes-consulta.css";
import "./painel-filtros.css";

export type EdicaoConsulta = { iniciar: () => void; aplicar: () => void; limpar: () => void };
export type CampoConsulta = {
  chave: string;
  /** Critério já exposto na barra: permanece no modal, sem repetir no cabeçalho. */
  naBarra?: boolean;
  /** Colunas que consultam este mesmo critério, sem estado ou filtro duplicado. */
  colunas?: string[];
  ativo: boolean;
  conteudo: ReactNode;
  limpar: () => void;
};
export type FiltrosColunas = Record<string, Omit<Parameters<typeof FiltroColunaConsulta>[0], "titulo">>;

/** O modal e os cabeçalhos recebem os mesmos campos e o mesmo rascunho do domínio. */
export function filtrosDasColunas(campos: CampoConsulta[], edicao: EdicaoConsulta, erro: string | null = null): FiltrosColunas {
  return Object.fromEntries(campos.filter(c => !c.naBarra).flatMap(c => (c.colunas ?? [c.chave]).map(chave => [chave, {
    ativo: c.ativo, children: c.conteudo, iniciar: edicao.iniciar, aplicar: edicao.aplicar, limpar: c.limpar, erro,
  }])));
}

export function FiltroColunaConsulta({ titulo, ativo, children, iniciar, aplicar, limpar, erro }: {
  titulo: string; ativo: boolean; children: React.ReactNode; iniciar: () => void; aplicar: () => void; limpar: () => void; erro: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  return <Popover open={aberto} onOpenChange={valor => { if (valor) iniciar(); setAberto(valor); }}>
    <PopoverTrigger asChild><button type="button" className="operacoes-cabecalho-filtro h-auto" data-ativo={ativo} aria-label={`Filtrar por ${titulo.toLocaleLowerCase("pt-BR")}${ativo ? ", filtro ativo" : ""}`}>{titulo}<span className="operacoes-cabecalho-icone"><Settings2 size={15} aria-hidden />{ativo && <span className="operacoes-cabecalho-indicador" aria-hidden />}</span></button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={10} className="financeiro-colorido operacoes-filtro-popover" aria-label={`Filtro de ${titulo.toLocaleLowerCase("pt-BR")}`} onCloseAutoFocus={evento => { if (document.querySelector('.operacoes-contexto-popover[data-state="open"], .operacoes-filtro-popover[data-state="open"]')) evento.preventDefault(); }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <form onSubmit={e => { e.preventDefault(); if (!erro) { aplicar(); setAberto(false); } }}>
        <div className="operacoes-popover-cabecalho"><h2>Filtrar por {titulo.toLocaleLowerCase("pt-BR")}</h2><Button type="button" size="icon" variant="ghost" aria-label="Fechar filtro da coluna" onClick={() => setAberto(false)}><X size={16} /></Button></div>
        <div className="operacoes-filtro-corpo"><ContextoFiltroColuna.Provider value={true}>{children}</ContextoFiltroColuna.Provider>{erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}</div>
        <div className="operacoes-popover-rodape"><Button type="button" variant="ghost" onClick={limpar}>Limpar</Button><Button type="submit" disabled={!!erro}>Aplicar</Button></div>
      </form>
    </PopoverContent>
  </Popover>;
}
