import { ConfiguracoesProducaoLeite } from "../pecuaria/rebanho/leite/ConfiguracoesProducaoLeite";
import { ProgramacaoRetirada } from "../pecuaria/rebanho/leite/UIProgramacaoRetirada";
import "../pecuaria/rebanho/leite/operacoes.css";
import { executarComGuardaNavegacao } from "../navegacaoGuardada";
import { PaginaCadastroProtocolo } from "../pecuaria/rebanho/protocolos/PaginaCadastroProtocolo";
import { ConfiguracaoReprodutiva } from "../pecuaria/rebanho/reproducao/ConfiguracaoReprodutiva";
import { ConsultaPorSitio } from "../pecuaria/rebanho/reproducao/ConsultaPorSitio";
import { Iatf } from "../pecuaria/rebanho/reproducao/Iatf";
import { RegrasSanitarias } from "../pecuaria/rebanho/reproducao/RegrasSanitarias";
import { useEffect, useRef, useState } from "react";
import { Beef, Dna, HeartPulse, Leaf, ChevronRight, Milk } from "lucide-react";
import { navegarPara } from "../router";
import { Cadastros, type AbaCadastroRebanho } from "../pecuaria/rebanho/telas/Cadastros";
import { CadastrosSanitarios, type AbaCadastroSanitario } from "../pecuaria/rebanho/sanidade/CadastrosSanitarios";
import { BuscaLista } from "./BuscaLista";


const GRUPOS = [
  { id: "producao", nome: "Produção de leite", icon: Milk, itens: [{ id: "leite", nome: "Ordenhas, controle individual e tanques", href: "/configuracoes/pecuaria/producao/leite" }, { id: "coleta", nome: "Rotina de coleta", href: "/configuracoes/pecuaria/producao/coleta" }] },
  { id: "rebanho", nome: "Rebanho", icon: Beef, itens: [{ id: "categorias", nome: "Categorias de animais", rebanho: "categorias" }, { id: "motivos", nome: "Motivos de baixa", rebanho: "motivos" }] },
  { id: "genetica", nome: "Genética", icon: Dna, itens: [{ id: "racas", nome: "Raças", rebanho: "racas" }, { id: "genitores", nome: "Genitores externos", rebanho: "genitores" }, { id: "material-genetico", nome: "Materiais genéticos", rebanho: "material-genetico" }] },
  { id: "sanidade", nome: "Sanidade", icon: HeartPulse, itens: [{ id: "protocolos", nome: "Protocolos sanitários", sanitario: "protocolos" }, { id: "doencas", nome: "Doenças", sanitario: "doenca" }, { id: "tipos-aplicacao", nome: "Tipos de aplicação", sanitario: "aplicacao" }, { id: "tipos-exame", nome: "Tipos de exame", sanitario: "exame" }] },
  { id: "reproducao", nome: "Reprodução", icon: Dna, itens: [{ id: "politica", nome: "Política reprodutiva", reproducao: "politica" }, { id: "protocolos", nome: "Protocolos reprodutivos", reproducao: "protocolos" }, { id: "tipos-exame", nome: "Tipos de exame reprodutivo", reproducao: "exames" }, { id: "regras-sanitarias", nome: "Regras sanitárias por doença", reproducao: "regras" }, { id: "materiais", nome: "Materiais genéticos", href: "/configuracoes/pecuaria/genetica/material-genetico" }, { id: "genitores", nome: "Genitores externos", href: "/configuracoes/pecuaria/genetica/genitores" }, { id: "produtos", nome: "Produtos", href: "/financeiro/configuracoes?aba=produtos" }] },
] satisfies { id: string; nome: string; icon: typeof Beef; itens: { id: string; nome: string; rebanho?: AbaCadastroRebanho; sanitario?: AbaCadastroSanitario; reproducao?: string; href?: string }[] }[];

function LinkCadastro({ href, children }: { href: string; children: React.ReactNode }) {
 return <a href={href} onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara(href); } }}>{children}</a>;
}

/** Agrupa os cadastros existentes sem recriar seus formulários nem contratos. */
export function ConfiguracoesPecuaria({ podeLancar }: { podeLancar: boolean }) {
 const [localizacao, setLocalizacao] = useState(() => window.location.pathname + window.location.search);
 const path = localizacao.split("?")[0];
 const [busca, setBusca] = useState("");
 const localizacaoAtual = useRef(localizacao);
 useEffect(() => {
   const sync = () => {
     const seguinte = window.location.pathname + window.location.search;
     const anterior = localizacaoAtual.current;
     if (seguinte === anterior) return;
     const resultado = executarComGuardaNavegacao(() => { localizacaoAtual.current = seguinte; setLocalizacao(seguinte); });
     if (resultado) void resultado.then(ok => { if (!ok) window.history.replaceState(window.history.state, "", anterior); });
   };
   window.addEventListener("popstate", sync);
   return () => window.removeEventListener("popstate", sync);
 }, []);
 if (path === "/configuracoes/pecuaria/producao/leite" || path === "/configuracoes/pecuaria/producao/coleta") return <div className="leite-modulo pec-config-producao"><nav className="pec-config-caminho" aria-label="Configurações da produção"><LinkCadastro href="/configuracoes/pecuaria">Configurações da Pecuária</LinkCadastro><ChevronRight size={14} aria-hidden /><span>Produção de leite</span></nav>{path.endsWith("/coleta") ? <ProgramacaoRetirada tituloPagina podeLancar={podeLancar} /> : <ConfiguracoesProducaoLeite tituloPagina podeLancar={podeLancar} />}</div>;
 const partes = path.split("/").filter(Boolean);
 const grupo = GRUPOS.find(g => g.id === partes[2]);
 const item = grupo?.itens.find(i => i.id === partes[3]);
 if (item?.id === "protocolos" && (grupo?.id === "sanidade" || grupo?.id === "reproducao") && partes[4] === "novo") return <PaginaCadastroProtocolo key={localizacao} tipo={grupo.id === "sanidade" ? "SANITARIO" : "REPRODUTIVO"} podeLancar={podeLancar} />;
 if (item && grupo && !("href" in item)) return <>
   <nav className="pec-config-caminho" aria-label="Cadastros da Pecuária"><LinkCadastro href="/configuracoes/pecuaria">Configurações da Pecuária</LinkCadastro><ChevronRight size={14} aria-hidden="true" /><span>{grupo.nome}</span></nav>
   {"rebanho" in item ? <Cadastros key={item.id} cadastro={item.rebanho} embutido podeLancar={podeLancar} /> : "sanitario" in item ? <CadastrosSanitarios key={item.id} cadastro={item.sanitario} embutido podeLancar={podeLancar} /> : "reproducao" in item ? item.reproducao === "politica" ? <><h1 className="mb-5 text-2xl font-semibold">Política reprodutiva</h1><ConsultaPorSitio>{id => <ConfiguracaoReprodutiva key={id} propriedadeId={id} podeLancar={podeLancar}/>}</ConsultaPorSitio></> : item.reproducao === "protocolos" ? <Iatf modo="cadastros" podeLancar={podeLancar} /> : item.reproducao === "regras" ? <RegrasSanitarias podeEditar={podeLancar} /> : <CadastrosSanitarios cadastro="exame" contextoExames="REPRODUTIVO" embutido podeLancar={podeLancar} /> : null}
 </>;
 const termo = busca.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
 const corresponde = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(termo);
 const grupos = GRUPOS.map(g => ({ ...g, itens: g.itens.filter(i => corresponde(`${g.nome} ${i.nome}`)) })).filter(g => g.itens.length);
 const mostrarNutricao = corresponde("Nutrição Receitas de dieta");
 return <><div className="pec-config-busca"><BuscaLista rotulo="Buscar configuração" placeholder="Buscar categoria, raça, protocolo…" valor={busca} onChange={setBusca} /></div><div className="pec-config-grid">
  {grupos.map(({ icon: Icon, ...g }) => <section key={g.id} className="pec-config-grupo"><h2><span className="fin-section-icon"><Icon size={20} aria-hidden /></span>{g.nome}</h2>{g.itens.map(i => <LinkCadastro key={i.id} href={"href" in i && i.href ? i.href : "/configuracoes/pecuaria/"+g.id+"/"+i.id}><span>{i.nome}</span><ChevronRight size={16} aria-hidden /></LinkCadastro>)}</section>)}
  {mostrarNutricao && <section className="pec-config-grupo"><h2><span className="fin-section-icon"><Leaf size={20} aria-hidden /></span>Nutrição</h2><LinkCadastro href="/pecuaria/nutricao?aba=receitas"><span>Receitas de dieta</span><ChevronRight size={16} aria-hidden /></LinkCadastro></section>}
  {!grupos.length && !mostrarNutricao && <p className="p-5 text-sm text-ink-3">Nenhuma configuração corresponde à busca.</p>}
 </div></>;
}
