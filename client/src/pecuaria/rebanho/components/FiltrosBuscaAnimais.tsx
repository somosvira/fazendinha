import { useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { ROTULO_APTIDAO, ROTULO_PAPEL_REPRODUTIVO, ROTULO_TIPO_BAIXA } from "../lib/rotulos";
import type { Catalogos, CategoriaRef, ListarFiltros } from "../types";
import { FILTROS_AVANCADOS_VAZIOS, contarFiltrosAvancados, validarFiltrosAvancados, type FiltrosAvancadosAnimais } from "./busca-animais-filtros";

type Props = {
  aberto:boolean; onAbertoChange:(aberto:boolean)=>void; valor:FiltrosAvancadosAnimais;
  onAplicar:(valor:FiltrosAvancadosAnimais)=>void; catalogos:Catalogos|null; categorias:CategoriaRef[];
  sitioDoShell:number|null; situacao:NonNullable<ListarFiltros["situacao"]>;
};
export function FiltrosBuscaAnimais({aberto,onAbertoChange,valor,onAplicar,catalogos,categorias,sitioDoShell,situacao}:Props) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const acionador = useRef<HTMLButtonElement>(null);
  const [rascunho,setRascunho] = useState(valor);
  const [erro,setErro] = useState<string|null>(null);
  const alterar = <K extends keyof FiltrosAvancadosAnimais>(chave:K,valor:FiltrosAvancadosAnimais[K]) => {setRascunho(f=>({...f,[chave]:valor}));setErro(null)};
  const mudarAbertura = (aberto:boolean) => {if(aberto){setRascunho(valor);setErro(null)}onAbertoChange(aberto)};
  const quantidade = contarFiltrosAvancados(valor,situacao);
  const propriedades = (catalogos?.propriedades??[]).filter(p=>sitioDoShell==null||p.id===sitioDoShell);
  return <Dialog open={aberto} onOpenChange={mudarAbertura}>
    <DialogTrigger asChild><Button ref={acionador} variant="outline" className="busca-animais-mais" aria-haspopup="dialog"><SlidersHorizontal aria-hidden/>Mais filtros{quantidade>0?` (${quantidade})`:""}</Button></DialogTrigger>
    <DialogContent className="busca-animais-filtros-dialog" showCloseButton={false} aria-describedby={undefined} onOpenAutoFocus={e=>{e.preventDefault();titulo.current?.focus()}} onCloseAutoFocus={e=>{if(acionador.current?.isConnected){e.preventDefault();acionador.current.focus({preventScroll:true})}}}>
      <form className="busca-animais-filtros-form" noValidate onSubmit={e=>{e.preventDefault();const erro=validarFiltrosAvancados(rascunho,situacao);setErro(erro);if(!erro){onAplicar(rascunho);onAbertoChange(false)}}}>
        <header><DialogTitle tabIndex={-1} ref={titulo}>Mais filtros</DialogTitle><Button type="button" variant="ghost" size="icon" aria-label="Cancelar filtros" onClick={()=>onAbertoChange(false)}><X aria-hidden/></Button></header>
        <div className="busca-animais-filtros-corpo">
          <section><h3>Localização e classificação</h3><div className="busca-animais-filtros-grade">
            <label>Sítio<SelectCampo aria-label="Sítio" value={sitioDoShell??rascunho.propriedadeId} onValueChange={v=>alterar("propriedadeId",v)} disabled={sitioDoShell!=null||!catalogos}>{sitioDoShell==null&&<option value="">Todos os sítios</option>}{propriedades.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</SelectCampo></label>
            <label>Categoria<SelectCampo aria-label="Categoria" value={rascunho.categoriaId} onValueChange={v=>alterar("categoriaId",v)} disabled={!catalogos}><option value="">Todas</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}<option value="__sem_categoria__">Sem categoria</option><option value="__manual__">Categoria definida manualmente</option></SelectCampo></label>
            <label>Finalidade<SelectCampo aria-label="Finalidade" value={rascunho.aptidao} onValueChange={v=>alterar("aptidao",v as FiltrosAvancadosAnimais["aptidao"])}><option value="">Todas</option>{Object.entries(ROTULO_APTIDAO).map(([v,r])=><option key={v} value={v}>{r}</option>)}</SelectCampo></label>
            <label>Raça na composição<SelectCampo aria-label="Raça na composição" value={rascunho.racaId} onValueChange={v=>alterar("racaId",v)} disabled={!catalogos}><option value="">Todas</option>{catalogos?.racas.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}</SelectCampo></label>
            <label>Origem<SelectCampo aria-label="Origem" value={rascunho.origem} onValueChange={v=>alterar("origem",v as FiltrosAvancadosAnimais["origem"])}><option value="">Todas</option><option value="NASCIDO">Nascido na fazenda</option><option value="COMPRADO">Comprado</option></SelectCampo></label>
            <label>Papel reprodutivo<SelectCampo aria-label="Papel reprodutivo" value={rascunho.papelReprodutivo} onValueChange={v=>alterar("papelReprodutivo",v as FiltrosAvancadosAnimais["papelReprodutivo"])}><option value="">Todos</option>{Object.entries(ROTULO_PAPEL_REPRODUTIVO).map(([v,r])=><option key={v} value={v}>{v==="NENHUM"?"Nenhum":r}</option>)}</SelectCampo></label>
          </div></section>
          <section><h3>Idade</h3><div className="busca-animais-filtros-grade">
            <label>Mínima, em meses<input type="number" min="0" max="600" step="1" value={rascunho.idadeMin} onChange={e=>alterar("idadeMin",e.target.value)} placeholder="Sem mínimo"/></label>
            <label>Máxima, em meses<input type="number" min="0" max="600" step="1" value={rascunho.idadeMax} onChange={e=>alterar("idadeMax",e.target.value)} placeholder="Sem máximo"/></label>
          </div><p>Para animais baixados, considera a idade na data da baixa.</p></section>
          <details><summary>Baixa</summary><div className="busca-animais-filtros-grade">
            <label>Tipo de baixa<SelectCampo aria-label="Tipo de baixa" value={rascunho.tipoBaixa} onValueChange={v=>alterar("tipoBaixa",v as FiltrosAvancadosAnimais["tipoBaixa"])} disabled={situacao==="ATIVO"}><option value="">Todos</option>{Object.entries(ROTULO_TIPO_BAIXA).filter(([v])=>v!=="CADASTRO_INDEVIDO").map(([v,r])=><option key={v} value={v}>{r}</option>)}</SelectCampo></label>
            <span aria-hidden/>
            <label>Data inicial<input type="date" value={rascunho.baixaDe} onChange={e=>alterar("baixaDe",e.target.value)} disabled={situacao==="ATIVO"}/></label>
            <label>Data final<input type="date" value={rascunho.baixaAte} onChange={e=>alterar("baixaAte",e.target.value)} disabled={situacao==="ATIVO"}/></label>
          </div><p>Aplica-se a animais baixados. Para usar, selecione Todos ou Baixados na lista.</p></details>
          {erro&&<p className="busca-animais-filtros-erro" role="alert">{erro}</p>}
        </div>
        <footer><Button type="button" variant="link" className="busca-animais-filtros-limpar" onClick={()=>{setRascunho({...FILTROS_AVANCADOS_VAZIOS});setErro(null)}}>Limpar filtros</Button><Button type="button" variant="outline" onClick={()=>onAbertoChange(false)}>Cancelar</Button><Button type="submit">Aplicar filtros</Button></footer>
      </form>
    </DialogContent>
  </Dialog>;
}
