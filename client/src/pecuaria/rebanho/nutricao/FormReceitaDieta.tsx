import { BookOpen, Leaf, Plus, Trash2 } from "lucide-react";
import { AjudaCampo } from "@/components/Dica";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { useCallback, useId, useRef, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { criarDieta, editarDieta, listarProdutosNutricionais, type Dieta } from "./api";
import { EstadoConsulta } from "./componentes";
import { useConsulta } from "./consulta";

export function FormReceitaDieta({ dieta, editar, onVoltar, onSalvo }: { dieta?: Dieta; editar: boolean; onVoltar: () => void; onSalvo: () => void }) {
  const formId = useId();
  const produtos = useConsulta(useCallback(listarProdutosNutricionais, []));
  const [nome, setNome] = useState(dieta?.nome ?? "");
  const [itens, setItens] = useState(dieta?.itens.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: i.quantidadeCabecaDia })) ?? [{ produtoId: "", quantidadeCabecaDia: "" }]);
  const [alterado, setAlterado] = useState(false);
  const alterarItens: typeof setItens = (atualizacao) => { setAlterado(true); setItens(atualizacao); };
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  async function salvar() {
    if (enviando.current || produtos.carregando || produtos.erro) return;
    if (nome.trim().length < 2 || itens.some((i) => !i.produtoId || !i.quantidadeCabecaDia.trim() || !Number.isFinite(Number(i.quantidadeCabecaDia)) || Number(i.quantidadeCabecaDia) <= 0)) { setErro("Informe o nome, os ingredientes e a quantidade por cabeça/dia."); return; }
    if (new Set(itens.map((i) => i.produtoId)).size !== itens.length) { setErro("Informe cada ingrediente uma única vez."); return; }
    enviando.current = true; setOcupado(true); setErro(null);
    try { const body = { nome: nome.trim(), itens: itens.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: Number(i.quantidadeCabecaDia) })) };
      if (editar && dieta) await editarDieta(dieta.id, body); else await criarDieta(body);
      onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { enviando.current = false; setOcupado(false); }
  }
  return <PainelCadastro aberto titulo={editar ? "Editar rascunho de dieta" : dieta ? "Nova versão de dieta" : "Nova receita"} icon={BookOpen} onFechar={onVoltar} bloqueado={ocupado} alteracoesExternas={alterado} largura="sm:max-w-5xl" rodape={fechar => <><Button secondary onClick={fechar} disabled={ocupado}>Cancelar</Button><Button type="submit" form={formId} disabled={ocupado || produtos.carregando || !!produtos.erro}>{ocupado ? "Salvando…" : editar ? "Salvar rascunho" : "Criar rascunho"}</Button></>}><div className="nutricao-formulario">
    <p className="nutricao-nota">Salve o rascunho e publique a versão para usá-la nos lotes. <AjudaCampo rotulo="Sobre as versões da receita" texto="Versões publicadas são preservadas; alterações geram uma nova versão." /></p>
    <form id={formId} onSubmit={(e) => { e.preventDefault(); void salvar(); }}><fieldset disabled={ocupado} className="nutricao-card-corpo grid gap-5">
      <ErrorBox erro={erro} /><EstadoConsulta erro={produtos.erro} carregando={produtos.carregando} recarregar={produtos.carregar} />
      <section className="receita-form-identidade"><h3>Identificação da receita</h3><label>Nome da dieta<input className={classeInput} required minLength={2} maxLength={160} value={nome} onChange={(e) => { setAlterado(true); setNome(e.target.value); }} /></label></section>
      <section className="receita-form-composicao"><div className="receita-form-composicao-titulo"><Leaf size={21} aria-hidden="true" /><h3 className="font-semibold">Ingredientes por cabeça/dia <AjudaCampo rotulo="Sobre as unidades e matéria seca" texto={"A unidade e a matéria seca vêm do cadastro do produto."} /></h3></div>
      {itens.map((i, indice) => {
        const produto = produtos.dados?.find((p) => p.id === i.produtoId);
        return <div key={indice} className="nutricao-ingrediente-form">
          <label>Ingrediente {indice + 1}<SelectCampo className={classeInput} value={i.produtoId} required onValueChange={(valorSelecionado) => alterarItens((xs) => xs.map((x, j) => j === indice ? { ...x, produtoId: valorSelecionado } : x))}><option value="">Selecione o produto</option>{i.produtoId && !produto && <option value={i.produtoId}>{dieta?.itens.find((x) => x.produtoId === i.produtoId)?.produto?.nome ?? "Produto indisponível"} · indisponível</option>}{produtos.dados?.map((p) => <option value={p.id} key={p.id}>{p.nome} ({p.unidade})</option>)}</SelectCampo></label>
          <label>Quantidade por cabeça/dia · {produto?.nome ?? dieta?.itens.find((x) => x.produtoId === i.produtoId)?.produto?.nome ?? `ingrediente ${indice + 1}`}<div className="flex items-center gap-2"><input className={classeInput} required type="number" min="0.001" max="999999999.999" step="0.001" value={i.quantidadeCabecaDia} onChange={(e) => alterarItens((xs) => xs.map((x, j) => j === indice ? { ...x, quantidadeCabecaDia: e.target.value } : x))} /><span>{produto?.unidade ?? dieta?.itens.find((x) => x.produtoId === i.produtoId)?.unidade ?? "—"}</span></div></label>
          <Button secondary disabled={itens.length === 1} onClick={() => alterarItens((xs) => xs.filter((_, j) => indice !== j))}><Trash2 size={16} aria-hidden="true" />Remover</Button>
        </div>;
      })}
      <div><Button secondary onClick={() => alterarItens((xs) => [...xs, { produtoId: "", quantidadeCabecaDia: "" }])}><Plus size={17} aria-hidden="true" />Adicionar ingrediente</Button></div></section>
    </fieldset></form>
  </div></PainelCadastro>;
}
