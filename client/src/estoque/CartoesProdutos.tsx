import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Package, TriangleAlert } from "lucide-react";
import { Button, Pill, brl, dataBR } from "@/financeiro/financeiro-ui";
import { LinkInterno } from "@/components/LinkInterno";
import { rotuloUnidade } from "@/lib/unidades";
import { listarPartidasProduto, type LoteProdutoDTO, type SaldoDTO } from "./api";
import "./estoque-visual.css";
const numero=(v:number)=>v.toLocaleString("pt-BR",{maximumFractionDigits:6});
export function resumirValidades(partidas:LoteProdutoDTO[],hoje:string){
 const positivas=partidas.filter(p=>Number(p.saldo)>0);const limite=new Date(`${hoje}T12:00:00Z`);limite.setUTCDate(limite.getUTCDate()+30);const ate=limite.toISOString().slice(0,10);
 const futuras=positivas.filter(p=>p.validade && p.validade.slice(0,10)>=hoje).sort((a,b)=>a.validade!.localeCompare(b.validade!));
 return {total:positivas.length,vencidas:positivas.filter(p=>p.validade && p.validade.slice(0,10)<hoje).length,desconhecidas:positivas.filter(p=>!p.validade).length,proxima:futuras[0]?.validade??null,em30Dias:futuras.filter(p=>p.validade!.slice(0,10)<=ate).length};
}
function Validades({id,propriedadeId}:{id:string;propriedadeId?:number}){
 const[dados,setDados]=useState<LoteProdutoDTO[]|null>(null);const[erro,setErro]=useState(false);const[tentativa,setTentativa]=useState(0);
 useEffect(()=>{let vivo=true;setDados(null);setErro(false);listarPartidasProduto(id,propriedadeId).then(v=>{if(vivo)setDados(v);}).catch(()=>{if(vivo)setErro(true);});return()=>{vivo=false;};},[id,propriedadeId,tentativa]);
 if(erro)return <div className="produto-validade"><span>Validades indisponíveis.</span><Button secondary onClick={()=>setTentativa(v=>v+1)}>Tentar novamente</Button></div>;
 if(!dados)return <p className="consulta-cartao-meta" role="status">Consultando validades…</p>;
 const r=resumirValidades(dados,new Date().toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"}));
 return <div className="produto-validade"><span><CalendarDays size={15} aria-hidden/>{r.proxima?<>Próxima validade <strong>{dataBR(r.proxima)}</strong></>:r.total?"Sem validade futura informada":"Sem lotes com saldo positivo"}</span>{r.total>0&&<small>{r.total} {r.total===1?"lote com saldo positivo":"lotes com saldo positivo"}</small>}{r.vencidas>0&&<strong className="produto-vencido">{r.vencidas} {r.vencidas===1?"lote vencido":"lotes vencidos"}</strong>}{r.desconhecidas>0&&<small>{r.desconhecidas} com validade não informada</small>}{r.em30Dias>0&&<small>{r.em30Dias} {r.em30Dias===1?"vence":"vencem"} em até 30 dias</small>}</div>;
}
export function CartoesProdutos({itens,todos,propriedadeId,verValores,acoes,filtrarReposicao}:{itens:SaldoDTO[];todos:SaldoDTO[];propriedadeId?:number;verValores:boolean;acoes:(s:SaldoDTO)=>ReactNode;filtrarReposicao:()=>void}){
 const prioridades=todos.filter(s=>s.abaixoMinimo||s.saldo<0).sort((a,b)=>Number(b.saldo<0)-Number(a.saldo<0)||((a.minimoEstoque??0)>0?a.saldo/a.minimoEstoque!:Infinity)-((b.minimoEstoque??0)>0?b.saldo/b.minimoEstoque!:Infinity)||a.nome.localeCompare(b.nome)).slice(0,5);
 return <div className="estoque-visao-visual"><div className="consulta-cartoes">{itens.map(s=>{const minimo=s.minimoEstoque;const proporcao=minimo!=null&&minimo>0?Math.max(0,s.saldo/minimo):null;return <article key={s.produtoId} className="consulta-cartao produto-cartao"><header><span className="produto-cartao-icone"><Package size={23} aria-hidden/></span><div><h2><LinkInterno area="estoque" href={`/estoque/produtos/${s.produtoId}`}>{s.nome}</LinkInterno></h2><p className="consulta-cartao-meta">{s.categoria?.nome??"Sem categoria"}</p><p className="consulta-cartao-meta">{s.centrosCusto.map(c=>c.nome).join(" · ")||"Sem centro"}</p></div></header>
  {(s.usoGenetico || s.usoSanitario || s.usoNutricional) && <div className="produto-usos" aria-label="Usos do produto">{s.usoGenetico && <span>Genética</span>}{s.usoSanitario && <span>Sanidade</span>}{s.usoNutricional && <span>Nutrição</span>}</div>}
  <div className="produto-cartao-saldo"><div><strong className={s.saldo<0?"produto-vencido":""}>{numero(s.saldo)} <small>{rotuloUnidade(s.unidade)}</small></strong><span>disponível</span></div><div><span>Mínimo: {minimo==null?"não definido":`${numero(minimo)} ${rotuloUnidade(s.unidade)}`}</span><Pill tone={s.saldo<0?"red":s.abaixoMinimo?"amber":minimo!=null?"green":"neutral"}>{s.saldo<0?"Saldo negativo":s.abaixoMinimo?"Abaixo do mínimo":minimo!=null?"Mínimo atendido":"Mínimo não definido"}</Pill></div></div>
  {proporcao!=null&&s.saldo>=0&&s.abaixoMinimo&&<div className="produto-minimo"><span><i data-alerta={s.abaixoMinimo||undefined} style={{width:`${Math.min(1,proporcao)*100}%`}}/></span><small>{(proporcao*100).toLocaleString("pt-BR",{maximumFractionDigits:0})}% do mínimo</small></div>}
  <Validades id={s.produtoId} propriedadeId={propriedadeId}/>
  {verValores&&<p className="produto-valor">Valor em estoque <strong>{s.valor==null||s.custoMedio==null?"Indisponível":brl(s.valor)}</strong></p>}
  <footer><LinkInterno area="estoque" href={`/estoque/produtos/${s.produtoId}`}>Ver produto</LinkInterno>{acoes(s)}</footer>
 </article>;})}</div><aside className="estoque-reposicao-painel"><h2><TriangleAlert size={18} aria-hidden/>Prioridades de reposição</h2><p>Produtos do recorte filtrado</p>{prioridades.length?prioridades.map(s=><LinkInterno area="estoque" key={s.produtoId} href={`/estoque/produtos/${s.produtoId}`}><strong>{s.nome}</strong><span>{s.minimoEstoque!=null?`Faltam ${numero(Math.max(0,s.minimoEstoque-s.saldo))} ${rotuloUnidade(s.unidade)} para o mínimo`:`Saldo ${numero(s.saldo)} ${rotuloUnidade(s.unidade)} · mínimo não definido`}</span></LinkInterno>):<p>Nenhum produto abaixo do mínimo ou com saldo negativo neste recorte.</p>}{prioridades.length>0&&<Button secondary onClick={filtrarReposicao}>Ver produtos abaixo do mínimo</Button>}</aside></div>;
}
