import { useEffect, useState } from "react";
import { DialogFinanceiro } from "../../../financeiro/DialogFinanceiro";
import { Button } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { listarAnimais, listarGenitores } from "../api";
import type { AnimalResumo, GenitorDTO, Sexo } from "../types";
import type { ValorGenitor } from "./CampoGenitor";

const TAMANHO = 6;
type Fonte = "ANIMAL" | "EXTERNO";

export function SeletorGenitor({ rotulo, sexo, valor, propriedadeId, retornoFoco, onConfirmar, onFechar }: {
  rotulo: string; sexo: Sexo; valor: ValorGenitor; propriedadeId?: number; retornoFoco?: HTMLElement | null;
  onConfirmar: (valor: ValorGenitor) => void; onFechar: () => void;
}) {
  const [fonte, setFonte] = useState<Fonte>(valor.tipo === "EXTERNO" ? "EXTERNO" : "ANIMAL");
  const [selecionado, setSelecionado] = useState<ValorGenitor | null>(valor.tipo === "NENHUM" ? null : valor);
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [externos, setExternos] = useState<GenitorDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);

  useEffect(() => {
    if (fonte !== "ANIMAL") return;
    let vigente = true;
    setCarregando(true); setErro("");
    const timer = setTimeout(() => {
      listarAnimais({ sexo, situacao: "TODOS", busca: texto.trim() || undefined, page: pagina, pageSize: TAMANHO }, propriedadeId)
        .then(r => { if (vigente) { setAnimais(r.itens); setTotal(r.total); } })
        .catch(() => { if (vigente) setErro("Não foi possível carregar os genitores."); })
        .finally(() => { if (vigente) setCarregando(false); });
    }, 250);
    return () => { vigente = false; clearTimeout(timer); };
  }, [fonte, texto, pagina, sexo, propriedadeId, revisao]);
  useEffect(() => {
    if (fonte !== "EXTERNO") return;
    let vigente = true;
    setCarregando(true); setErro("");
    const timer = setTimeout(() => {
      listarGenitores({ sexo, q: texto.trim() || undefined }, propriedadeId)
        .then(r => { if (vigente) { setExternos(r); setTotal(r.length); } })
        .catch(() => { if (vigente) setErro("Não foi possível carregar os genitores."); })
        .finally(() => { if (vigente) setCarregando(false); });
    }, 250);
    return () => { vigente = false; clearTimeout(timer); };
  }, [fonte, texto, sexo, propriedadeId, revisao]);

  const itens = fonte === "ANIMAL" ? animais.map(a => ({ id: a.id, nome: a.nome || "Sem nome", detalhe: a.brinco, origem: `${a.propriedade?.nome ?? "Sítio não informado"}${a.situacao === "BAIXADO" ? " · Baixado" : ""}`, valor: { tipo: "ANIMAL", id: a.id, nome: a.nome, brinco: a.brinco } as ValorGenitor }))
    : externos.slice((pagina - 1) * TAMANHO, pagina * TAMANHO).map(g => ({ id: g.id, nome: g.nome, detalhe: g.codigo || "—", origem: g.fornecedor || "Genitor externo", valor: { tipo: "EXTERNO", id: g.id, nome: g.nome, fornecedor: g.fornecedor } as ValorGenitor }));
  const trocarFonte = (nova: Fonte) => { setFonte(nova); setTexto(""); setPagina(1); };
  return <DialogFinanceiro titulo={`Selecionar ${rotulo.toLowerCase()}`} eyebrow="Novo animal · Genética" onClose={onFechar} className="z-[1220] max-w-3xl" elevado retornoFoco={retornoFoco} rodape={<div className="flex flex-wrap items-center justify-end gap-3">
    <button type="button" className="mr-auto min-h-11 text-sm font-semibold text-mast" onClick={() => onConfirmar({ tipo: "NENHUM" })}>Deixar sem informação</button>
    <Button type="button" secondary onClick={onFechar}>Cancelar</Button><Button type="button" disabled={!selecionado || selecionado.tipo !== fonte} onClick={() => { if (selecionado) onConfirmar(selecionado); }}>Usar como {rotulo.toLowerCase()}</Button>
  </div>}>
    <div className="space-y-4 p-5 sm:p-6">
      <div role="group" aria-label="Fonte do genitor" className="flex border-b border-border">
        {([['ANIMAL', 'Animais da fazenda'], ['EXTERNO', 'Genitores externos']] as const).map(([chave, nome]) => <button key={chave} type="button" aria-pressed={fonte === chave} onClick={() => trocarFonte(chave)} className={`min-h-11 px-4 text-sm font-semibold ${fonte === chave ? "border-b-2 border-mast text-mast" : "text-ink-2"}`}>{nome}</button>)}
      </div>
      <label className="block text-sm font-medium">{fonte === "ANIMAL" ? "Buscar por brinco ou nome" : "Buscar por nome"}<input className={classeInput} value={texto} onChange={e => { setTexto(e.target.value); setPagina(1); }} /></label>
      {carregando ? <p role="status">Carregando…</p> : erro ? <div role="alert">{erro} <button type="button" className="text-mast underline" onClick={() => setRevisao(n => n + 1)}>Tentar novamente</button></div> : itens.length ? <div role="radiogroup" aria-label={`Selecionar ${rotulo.toLowerCase()}`} className="max-h-72 overflow-y-auto">
        <div aria-hidden="true" className="hidden grid-cols-[1.2fr_0.8fr_1fr] gap-3 px-12 py-2 text-sm font-semibold sm:grid"><span>{fonte === "ANIMAL" ? "Animal" : "Genitor"}</span><span>{fonte === "ANIMAL" ? "Brinco" : "Código"}</span><span>{fonte === "ANIMAL" ? "Sítio" : "Fornecedor"}</span></div>
        {itens.map(item => <label key={item.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm ${selecionado?.tipo === fonte && selecionado.id === item.id ? "bg-teal-50" : "hover:bg-muted"}`}><input type="radio" name={`seletor-${sexo}`} checked={selecionado?.tipo === fonte && selecionado.id === item.id} onChange={() => setSelecionado(item.valor)} /><span className="grid flex-1 gap-1 sm:grid-cols-[1.2fr_0.8fr_1fr] sm:gap-3"><strong className="break-words">{item.nome}</strong><span>{fonte === "ANIMAL" ? `Brinco ${item.detalhe}` : `Código ${item.detalhe}`}</span><span>{item.origem}</span></span></label>)}
      </div> : <p>Nenhum resultado encontrado.</p>}
      {!carregando && !erro && total > 0 && <div className="flex items-center justify-between gap-3 text-sm"><span>{(pagina - 1) * TAMANHO + 1}–{Math.min(pagina * TAMANHO, total)} de {total}</span><div className="flex gap-2"><Button type="button" secondary disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button><Button type="button" secondary disabled={pagina * TAMANHO >= total} onClick={() => setPagina(p => p + 1)}>Próxima</Button></div></div>}
    </div>
  </DialogFinanceiro>;
}
