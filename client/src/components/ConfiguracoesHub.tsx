import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Link as LinkIcon } from "lucide-react";
import type { Tab } from "./Shell";
import { EmptyState } from "./EmptyState";
import { Acessos } from "./Acessos";
import { Sitios } from "./configuracoes/Sitios";
import { navegarPara } from "../router";
import { ConfiguracoesFinanceiras, type AbaFinanceira } from "../financeiro/ConfiguracoesFinanceiras";
import { Cadastros, type AbaCadastroRebanho } from "../pecuaria/rebanho/telas/Cadastros";
import { CadastrosSanitarios, type AbaCadastroSanitario } from "../pecuaria/rebanho/sanidade/CadastrosSanitarios";
import { ReceitasDieta } from "../pecuaria/rebanho/nutricao/ReceitasDieta";

type Secao = "sitios" | "acessos" | "financeiro" | "pecuaria";
const GRUPOS = [
  { id: "rebanho", nome: "Rebanho", itens: [{ id: "categorias", nome: "Categorias de animais", descricao: "Regras de classificação", rebanho: "categorias" }, { id: "motivos", nome: "Motivos de baixa", rebanho: "motivos" }] },
  { id: "genetica", nome: "Genética", itens: [{ id: "racas", nome: "Raças", rebanho: "racas" }, { id: "genitores", nome: "Genitores externos", rebanho: "genitores" }, { id: "material-genetico", nome: "Materiais genéticos", rebanho: "material-genetico" }] },
  { id: "sanidade", nome: "Sanidade", itens: [{ id: "protocolos", nome: "Protocolos sanitários", sanitario: "protocolos" }, { id: "doencas", nome: "Doenças", sanitario: "doenca" }, { id: "tipos-aplicacao", nome: "Tipos de aplicação", sanitario: "aplicacao" }, { id: "tipos-exame", nome: "Tipos de exame", sanitario: "exame" }] },
  { id: "nutricao", nome: "Nutrição", itens: [{ id: "receitas", nome: "Receitas de dieta", descricao: "Ingredientes, rascunhos e versões publicadas" }] },
] satisfies { id: string; nome: string; itens: { id: string; nome: string; descricao?: string; rebanho?: AbaCadastroRebanho; sanitario?: AbaCadastroSanitario }[] }[];
const ABAS_FINANCEIRAS: AbaFinanceira[] = ["contas", "parceiros", "produtos", "categorias", "centros"];

export function ConfiguracoesHub({ tab, onNav: _onNav, isAdmin, podeCategorias = true, podeFinanceiro = podeCategorias, podePecuaria = true, podeEditarCadastros = true, podeLancarPecuaria = true }: {
  tab: Tab; onNav: (t: Tab) => void; isAdmin: boolean; podeCategorias?: boolean;
  podeFinanceiro?: boolean; podePecuaria?: boolean; podeEditarCadastros?: boolean; podeLancarPecuaria?: boolean;
}) {
  const [caminho, setCaminho] = useState(window.location.pathname);
  useEffect(() => { const atualizar = () => setCaminho(window.location.pathname); atualizar(); window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, [tab]);
  const tabs: { id: Secao; nome: string }[] = [...(isAdmin ? [{ id: "sitios" as const, nome: "Sítios" }, { id: "acessos" as const, nome: "Acessos" }] : []), ...(podeFinanceiro ? [{ id: "financeiro" as const, nome: "Financeiro" }] : []), ...(podePecuaria ? [{ id: "pecuaria" as const, nome: "Pecuária" }] : [])];
  const partes = caminho.split("/").filter(Boolean);
  const pedida = partes[0] === "configuracoes" ? partes[1] : tab === "sitios" ? "sitios" : tab === "acessos" ? "acessos" : "financeiro";
  const atual = tabs.find((t) => t.id === pedida)?.id ?? tabs[0]?.id;
  const grupo = GRUPOS.find((g) => g.id === partes[2]);
  const item = grupo?.itens.find((i) => i.id === partes[3]);
  const abaFinanceira = ABAS_FINANCEIRAS.find((a) => a === partes[2]) ?? (tab === "plano" ? "categorias" : "contas");
  const ir = (url: string) => { navegarPara(url); setCaminho(window.location.pathname); };
  if (!atual) return <div className="shell-wide pagina-financeira"><EmptyState titulo="Nada para configurar" descricao="Seu perfil não tem configurações disponíveis." /></div>;
  return <div className="shell-wide pagina-financeira">
    <header className="mb-6"><h1 className="h1">Configurações</h1><p className="body mt-2 text-ink-3">Cadastros e ajustes da fazenda.</p></header>
    <div role="tablist" aria-label="Configurações" className="mb-7 flex overflow-x-auto border-b border-border">{tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={atual === t.id} onClick={() => ir(`/configuracoes/${t.id}`)} className={`shrink-0 border-b-2 px-5 py-4 text-sm ${atual === t.id ? "border-mast font-semibold text-mast" : "border-transparent text-ink-3"}`}>{t.nome}</button>)}</div>
    {atual === "sitios" && <Sitios />}
    {atual === "acessos" && <Acessos />}
    {atual === "financeiro" && <ConfiguracoesFinanceiras embutido abaInicial={abaFinanceira} podeEditar={podeEditarCadastros} onSelecionarAba={(a) => ir(`/configuracoes/financeiro/${a}`)} />}
    {atual === "pecuaria" && (item && grupo ? <>
      <nav aria-label="Caminho do cadastro" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-ink-3"><button type="button" className="text-mast underline" onClick={() => ir("/configuracoes/pecuaria")}>Pecuária</button><span>/</span><span>{grupo.nome}</span><span>/</span><span>{item.nome}</span></nav>
      <button type="button" className="mb-6 inline-flex items-center gap-2 text-sm text-mast underline" onClick={() => ir("/configuracoes/pecuaria")}><ArrowLeft size={16} />Voltar aos cadastros</button>
      {"rebanho" in item && <Cadastros key={item.id} embutido cadastro={item.rebanho} podeLancar={podeLancarPecuaria} />}
      {"sanitario" in item && <CadastrosSanitarios key={item.id} embutido cadastro={item.sanitario} podeLancar={podeLancarPecuaria} />}
      {grupo.id === "nutricao" && <ReceitasDieta podeLancar={podeLancarPecuaria} />}
    </> : <>
      <h2 className="h2 mb-7">Cadastros da pecuária</h2>
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">{GRUPOS.map((g) => <section key={g.id}><h3 className="h2 mb-3">{g.nome}</h3><div className="divide-y divide-border rounded border border-border">{g.itens.map((i) => <button key={i.id} type="button" onClick={() => ir(`/configuracoes/pecuaria/${g.id}/${i.id}`)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-2"><span><span className="body">{i.nome}</span>{"descricao" in i && <span className="mt-1 block text-sm text-ink-3">{i.descricao}</span>}</span><ChevronRight size={18} className="shrink-0 text-ink-3" /></button>)}</div></section>)}</div>
      {podeFinanceiro && <div className="mt-8 border-t border-border pt-6"><button type="button" onClick={() => ir("/configuracoes/financeiro/produtos")} className="flex w-full items-center gap-3 rounded border border-border px-5 py-4 text-left"><LinkIcon size={18} /><span className="flex-1">Produtos compartilhados <span className="text-ink-3">→ Financeiro / Produtos</span></span><ChevronRight size={18} /></button></div>}
    </>)}
  </div>;
}
