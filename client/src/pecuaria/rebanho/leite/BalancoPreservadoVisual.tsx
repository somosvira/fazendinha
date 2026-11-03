import { Card } from '@/components/ui/card';
import { AjudaCampo } from '@/components/Dica';
import { formatarLitros } from './modelo';
interface Balanco {
 produtoId:string;produtoNome:string;abertura:string|null;producaoConfirmada:string|null;vendas:string|null;interno:string|null;descarte:string|null;outrosMovimentos:string|null;encerramentoRazao:string|null;
 medicaoCampo?:{litrosObservados:string}|null;divergenciaLitros?:string|null;confiavel:boolean;
}
export function BalancoPreservadoVisual({itens}:{itens:Balanco[]}) {
 const litros=(v:string|null|undefined)=>formatarLitros(v==null?null:Number(v));
 return <div className="leite-balancos-visuais">{itens.map(b=><Card key={b.produtoId} className="leite-balanco-visual"><header><h3>{b.produtoNome}</h3><AjudaCampo rotulo={`Sobre o balanço de ${b.produtoNome}`} texto="Dados preservados na emissão: abertura e movimentos até o encerramento calculado. Saldo do razão não comprova capacidade, localização em tanque ou medição física."/></header><dl className="leite-balanco-fluxo">{[
 {nome:'Abertura',valor:b.abertura},{nome:'Produção confirmada',valor:b.producaoConfirmada},{nome:'Retirado para venda',valor:b.vendas},{nome:'Consumo interno',valor:b.interno},{nome:'Descarte físico',valor:b.descarte},{nome:'Outros movimentos',valor:b.outrosMovimentos},
 ].map(v=><div key={v.nome}><dt>{v.nome}</dt><dd>{litros(v.valor)}</dd></div>)}</dl><dl className="leite-balanco-fechamento"><div><dt>Encerramento calculado</dt><dd>{litros(b.encerramentoRazao)}</dd></div><div><dt>Medição física</dt><dd>{b.medicaoCampo?litros(b.medicaoCampo.litrosObservados):'Não informada'}</dd></div><div><dt>Diferença observada</dt><dd>{litros(b.divergenciaLitros)}</dd></div></dl>{!b.confiavel&&<span role="status">Conferir pendências no lastro<AjudaCampo rotulo="Sobre pendências do lastro" texto="As origens não estão conciliadas para todos os movimentos; valores não conhecidos permanecem não informados."/></span>}</Card>)}</div>;
}
