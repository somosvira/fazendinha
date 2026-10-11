import { useEffect, useState } from "react";
import { Beef, Dna, HeartPulse, Leaf, ChevronRight } from "lucide-react";
import { navegarPara } from "../router";
import { Cadastros, type AbaCadastroRebanho } from "../pecuaria/rebanho/telas/Cadastros";
import { CadastrosSanitarios, type AbaCadastroSanitario } from "../pecuaria/rebanho/sanidade/CadastrosSanitarios";

const GRUPOS = [
  { id: "rebanho", nome: "Rebanho", icon: Beef, itens: [{ id: "categorias", nome: "Categorias de animais", rebanho: "categorias" }, { id: "motivos", nome: "Motivos de baixa", rebanho: "motivos" }] },
  { id: "genetica", nome: "Genética", icon: Dna, itens: [{ id: "racas", nome: "Raças", rebanho: "racas" }, { id: "genitores", nome: "Genitores externos", rebanho: "genitores" }, { id: "material-genetico", nome: "Materiais genéticos", rebanho: "material-genetico" }] },
  { id: "sanidade", nome: "Sanidade", icon: HeartPulse, itens: [{ id: "protocolos", nome: "Protocolos sanitários", sanitario: "protocolos" }, { id: "doencas", nome: "Doenças", sanitario: "doenca" }, { id: "tipos-aplicacao", nome: "Tipos de aplicação", sanitario: "aplicacao" }, { id: "tipos-exame", nome: "Tipos de exame", sanitario: "exame" }] },
] satisfies { id: string; nome: string; icon: typeof Beef; itens: { id: string; nome: string; rebanho?: AbaCadastroRebanho; sanitario?: AbaCadastroSanitario }[] }[];

function LinkCadastro({ href, children }: { href: string; children: React.ReactNode }) {
 return <a href={href} onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara(href); } }}>{children}</a>;
}

/** Agrupa os cadastros existentes sem recriar seus formulários nem contratos. */
export function ConfiguracoesPecuaria({ podeLancar }: { podeLancar: boolean }) {
 const [path, setPath] = useState(window.location.pathname);
 useEffect(() => { const sync = () => setPath(window.location.pathname); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
 const partes = path.split("/").filter(Boolean);
 const grupo = GRUPOS.find(g => g.id === partes[2]);
 const item = grupo?.itens.find(i => i.id === partes[3]);
 if (item && grupo) return <>
   <nav aria-label="Caminho do cadastro" className="pec-breadcrumb"><LinkCadastro href="/configuracoes/pecuaria">Pecuária</LinkCadastro><ChevronRight size={14} aria-hidden /><span>{grupo.nome}</span><ChevronRight size={14} aria-hidden /><span aria-current="page">{item.nome}</span></nav>
   {"rebanho" in item ? <Cadastros key={item.id} cadastro={item.rebanho} embutido podeLancar={podeLancar} /> : "sanitario" in item ? <CadastrosSanitarios key={item.id} cadastro={item.sanitario} embutido podeLancar={podeLancar} /> : null}
 </>;
 return <div className="pec-config-grid">
  {GRUPOS.map(({ icon: Icon, ...g }) => <section key={g.id} className="pec-config-grupo"><h2><span className="fin-section-icon"><Icon size={20} aria-hidden /></span>{g.nome}</h2>{g.itens.map(i => <LinkCadastro key={i.id} href={"/configuracoes/pecuaria/"+g.id+"/"+i.id}><span>{i.nome}</span><ChevronRight size={16} aria-hidden /></LinkCadastro>)}</section>)}
  <section className="pec-config-grupo"><h2><span className="fin-section-icon"><Leaf size={20} aria-hidden /></span>Nutrição</h2><LinkCadastro href="/pecuaria/nutricao?aba=receitas"><span>Receitas de dieta</span><ChevronRight size={16} aria-hidden /></LinkCadastro><p className="text-sm leading-6 text-ink-3">Rascunhos, ingredientes e versões publicadas na rotina de Nutrição.</p></section>
 </div>;
}
