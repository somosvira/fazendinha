import { useCallback, useState } from "react";
import { Button, ErrorBox, Panel } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { criarDieta, editarDieta, listarProdutosNutricionais, type Dieta } from "./api";
import { EstadoConsulta } from "./componentes";
import { useConsulta } from "./consulta";

export function FormReceitaDieta({ dieta, editar, onVoltar, onSalvo }: { dieta?: Dieta; editar: boolean; onVoltar: () => void; onSalvo: () => void }) {
  const produtos = useConsulta(useCallback(listarProdutosNutricionais, []));
  const [nome, setNome] = useState(dieta?.nome ?? "");
  const [itens, setItens] = useState(dieta?.itens.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: i.quantidadeCabecaDia })) ?? [{ produtoId: "", quantidadeCabecaDia: "" }]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function salvar() {
    if (ocupado) return;
    if (nome.trim().length < 2 || itens.some((i) => !i.produtoId || !i.quantidadeCabecaDia.trim() || !Number.isFinite(Number(i.quantidadeCabecaDia)) || Number(i.quantidadeCabecaDia) <= 0)) { setErro("Informe o nome, os ingredientes e a quantidade por cabeça/dia."); return; }
    if (new Set(itens.map((i) => i.produtoId)).size !== itens.length) { setErro("Informe cada ingrediente uma única vez."); return; }
    setOcupado(true); setErro(null);
    try { const body = { nome: nome.trim(), itens: itens.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: Number(i.quantidadeCabecaDia) })) };
      if (editar && dieta) await editarDieta(dieta.id, body); else await criarDieta(body);
      onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <div className="nutricao-formulario"><Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">{editar ? "Editar rascunho de dieta" : dieta ? "Nova versão de dieta" : "Nova receita"}</h2><p>Defina a composição por cabeça e por dia.</p></div></div>
    <form onSubmit={(e) => { e.preventDefault(); void salvar(); }}><fieldset disabled={ocupado} className="nutricao-card-corpo grid gap-5">
      <ErrorBox erro={erro} /><EstadoConsulta erro={produtos.erro} carregando={produtos.carregando} recarregar={produtos.carregar} />
      <label>Nome da dieta<input className={classeInput} required minLength={2} maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <div><h3 className="font-semibold">Ingredientes por cabeça/dia</h3><p className="nutricao-nota">A unidade e a matéria seca vêm do cadastro do produto.</p></div>
      {itens.map((i, indice) => {
        const produto = produtos.dados?.find((p) => p.id === i.produtoId);
        return <div key={indice} className="nutricao-ingrediente-form">
          <label>Ingrediente {indice + 1}<select className={classeInput} value={i.produtoId} required onChange={(e) => setItens((xs) => xs.map((x, j) => j === indice ? { ...x, produtoId: e.target.value } : x))}><option value="">Selecione o produto</option>{i.produtoId && !produto && <option value={i.produtoId}>{dieta?.itens.find((x) => x.produtoId === i.produtoId)?.produto?.nome ?? "Produto indisponível"} · indisponível</option>}{produtos.dados?.map((p) => <option value={p.id} key={p.id}>{p.nome} ({p.unidade})</option>)}</select></label>
          <label>Quantidade por cabeça/dia {indice + 1}<div className="flex items-center gap-2"><input className={classeInput} required type="number" min="0.001" max="999999999.999" step="0.001" value={i.quantidadeCabecaDia} onChange={(e) => setItens((xs) => xs.map((x, j) => j === indice ? { ...x, quantidadeCabecaDia: e.target.value } : x))} /><span>{produto?.unidade ?? dieta?.itens.find((x) => x.produtoId === i.produtoId)?.unidade ?? "—"}</span></div></label>
          <Button secondary disabled={itens.length === 1} onClick={() => setItens((xs) => xs.filter((_, j) => indice !== j))}>Remover</Button>
        </div>;
      })}
      <div><Button secondary onClick={() => setItens((xs) => [...xs, { produtoId: "", quantidadeCabecaDia: "" }])}>Adicionar ingrediente</Button></div>
    </fieldset><div className="nutricao-form-rodape"><Button secondary onClick={onVoltar} disabled={ocupado}>Cancelar</Button><Button type="submit" disabled={ocupado || produtos.carregando || !!produtos.erro}>{ocupado ? "Salvando…" : editar ? "Salvar rascunho" : "Criar rascunho"}</Button></div></form>
  </Panel><Panel className="nutricao-ajuda"><h3 className="h3">Rascunho → Publicação → Uso</h3><p>Salve a composição como rascunho. Depois de revisar, publique a versão para atribuí-la a um lote.</p><p>Versões publicadas são preservadas. Alterações geram uma nova versão.</p></Panel></div>;
}
