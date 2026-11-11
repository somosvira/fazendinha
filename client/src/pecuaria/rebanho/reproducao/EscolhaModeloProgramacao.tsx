import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { reqProtocolo, consultaProtocolo } from "../protocolos/api";
import { Paginacao } from "../ui";

type Modelo = { id: string; nome: string; versao: number };

export function EscolhaModeloProgramacao({ valor, onChange, propriedadeId, onEscolhido, modeloAtual }: {
  valor: string;
  modeloAtual?: Pick<Modelo, "nome" | "versao"> | null;
  onChange: (id: string) => void;
  propriedadeId?: number;
  onEscolhido?: (modelo: Modelo | null) => void;
}) {
  const idRotulo = useId();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ itens: Modelo[]; total: number } | null>(null);
  const [escolhido, setEscolhido] = useState<Modelo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const selecionado = valor ? modeloAtual ?? (escolhido?.id === valor ? escolhido : null) : null;

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    const timer = window.setTimeout(() => {
      const consulta = consultaProtocolo({ tipo: "REPRODUTIVO", busca, pagina });
      void reqProtocolo<{ itens: Modelo[]; total: number }>(`/versoes${consulta}`, propriedadeId)
        .then(dados => { if (vivo) setResultado(dados); })
        .catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    }, 200);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [aberto, busca, pagina, propriedadeId, tentativa]);

  function mudarAberto(novo: boolean) {
    setAberto(novo);
    setBusca("");
    setPagina(1);
    setResultado(null);
    setErro(null);
  }

  return <div className="grid min-w-0 gap-1.5">
    <span id={idRotulo} className="text-sm font-medium">Modelo do protocolo</span>
    <Popover open={aberto} onOpenChange={mudarAberto}>
      <PopoverTrigger asChild>
        <button type="button" aria-labelledby={idRotulo}
          className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm">
          <span className="truncate">{selecionado ? `${selecionado.nome} · v${selecionado.versao}` : "Selecionar modelo"}</span>
          <ChevronDown size={16} className="shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-labelledby={idRotulo} align="start"
        className="grid max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] gap-2 overflow-y-auto rounded-lg p-2">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
          <Input type="search" className="pl-8" aria-label="Pesquisar modelo publicado" placeholder="Pesquisar modelo"
            value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); setResultado(null); setErro(null); }}
            onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} />
        </div>
        <ErrorBox erro={erro} />
        {erro && <Button type="button" variant="outline" size="sm" onClick={() => {
          setErro(null);
          setTentativa(atual => atual + 1);
        }}>Tentar novamente</Button>}
        {!resultado && !erro && <p role="status" className="px-2 py-1 text-sm">Carregando modelos…</p>}
        {resultado?.itens.map(modelo => <button key={modelo.id} type="button" aria-pressed={modelo.id === valor}
          className="rounded-md px-2 py-2 text-left text-sm hover:bg-muted aria-pressed:bg-accent"
          onClick={() => {
            setEscolhido(modelo);
            onEscolhido?.(modelo);
            onChange(modelo.id);
            mudarAberto(false);
          }}>{modelo.nome} · versão {modelo.versao}</button>)}
        {resultado && !resultado.itens.length && <p className="px-2 py-1 text-sm">Nenhum modelo publicado encontrado.</p>}
        {resultado && resultado.total > 10 && <Paginacao paginaAtual={pagina} totalPaginas={Math.ceil(resultado.total / 10)}
          totalItens={resultado.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="modelos" idSelect="pagina-modelos-programacao" />}
      </PopoverContent>
    </Popover>
  </div>;
}
