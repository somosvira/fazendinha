import { AjudaCampo } from "../../../components/Dica";
import { Paginacao } from "../ui";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { escreverCustos, type Classificacao, type CustosDTO } from "./api";

const inicial: Classificacao = { finalidade: null, materialNaoAplicavel: false, servicoNaoAplicavel: false, coberturaServico: "PROCEDIMENTO", valorMaterialDocumentado: null };
type Props = {
  aoMudarPagina?:(pagina:number)=>void;
  dados: CustosDTO | null;
  visivel: boolean;
  propriedadeId: number;
  chave: string;
  ocupado: boolean;
  motivo: string;
  aoMudarMotivo: (motivo: string) => void;
  aoAlterar: () => void;
  gravar: (acao: () => Promise<unknown>) => Promise<void>;
};

export function EditorClassificacaoCusto({ dados, aoMudarPagina,visivel, propriedadeId, chave, ocupado, motivo, aoMudarMotivo, aoAlterar, gravar }: Props) {
  const [fonte, setFonte] = useState("");
  const [classificacao, setClassificacao] = useState<Classificacao>(inicial);
  const [valor, setValor] = useState("");
  const [referencia, setReferencia] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const atual = dados?.fontes.find(f => `${f.tipo}:${f.id}` === fonte);

  function selecionar(v: string) {
    setFonte(v);
    aoAlterar();
    const f = dados?.fontes.find(f => `${f.tipo}:${f.id}` === v);
    setClassificacao(f?.classificacao ?? inicial);
    setValor(f?.classificacao?.valorMaterialDocumentado ?? "");
    setReferencia(f?.documentoMaterial?.referencia ?? "");
    setEvidencia(f?.documentoMaterial?.evidencia ?? "");
  }

  if (!visivel || !dados || !dados.fontes.length) return null;
  return <section className="custos-classificacao" aria-label="Classificação dos registros">
    <header><h4>Classificação dos registros</h4><span>{dados.fontesPaginadas?.total ?? dados.fontes.length} {(dados.fontesPaginadas?.total ?? dados.fontes.length) === 1 ? "registro" : "registros"}</span></header>
    <form className="mt-3 grid gap-3" onChange={aoAlterar} onSubmit={e => {
      e.preventDefault();
      if (!atual) return;
      void gravar(() => escreverCustos("/classificacao", { chave, propriedadeId, tipo: atual.tipo, fonteId: atual.id, versao: atual.versaoClassificacao, motivo, ...classificacao, valorMaterialDocumentado: undefined, materialDocumentado: valor !== "" ? { valor, referencia, evidencia } : null }, propriedadeId, "PUT"));
    }}><fieldset disabled={ocupado} className="custos-classificacao-campos">
      <label>Fato a classificar<SelectCampo className={classeInput} required value={fonte} onValueChange={selecionar}>
        <option value="">Selecione</option>{dados.fontes.map(f => <option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.data} · {f.descricao}</option>)}
      </SelectCampo></label>
      {dados.fontesPaginadas&&dados.fontesPaginadas.total>10&&aoMudarPagina&&<Paginacao paginaAtual={dados.fontesPaginadas.pagina} totalPaginas={Math.max(1,Math.ceil(dados.fontesPaginadas.total/10))} totalItens={dados.fontesPaginadas.total} itensPorPagina={10} onPaginaChange={aoMudarPagina} rotulo="fatos" idSelect="custos-fontes-pagina"/>}
      {atual && <>
        <label className="relative">Finalidade gerencial<SelectCampo className={classeInput} value={classificacao.finalidade ?? ""} onValueChange={valorSelecionado => { aoAlterar(); setClassificacao({ ...classificacao, finalidade: (valorSelecionado || null) as Classificacao["finalidade"] }); }}>
          <option value="">Sem classificação</option><option value="REPRODUCAO">Reprodução</option><option value="SANIDADE">Sanidade</option><option value="ROTINA">Rotina/manutenção</option>
        </SelectCampo><span className="absolute right-0 top-0"> <AjudaCampo rotulo="Ajuda sobre finalidade gerencial" texto="Finalidade gerencial independente do vínculo à tentativa ou ao protocolo."/></span></label>

        {atual.tipo !== "NUTRICAO" && <>
          <label><Checkbox checked={classificacao.materialNaoAplicavel} onCheckedChange={checked => { aoAlterar(); setClassificacao({ ...classificacao, materialNaoAplicavel: checked === true }); }} /> Material não aplicável</label>
          <label><Checkbox checked={classificacao.servicoNaoAplicavel} onCheckedChange={checked => { aoAlterar(); setClassificacao({ ...classificacao, servicoNaoAplicavel: checked === true }); }} /> Serviço/procedimento não aplicável</label>
          <label>O Serviço atribuído cobre<SelectCampo className={classeInput} value={classificacao.coberturaServico} onValueChange={valorSelecionado => { aoAlterar(); setClassificacao({ ...classificacao, coberturaServico: valorSelecionado as Classificacao["coberturaServico"] }); }}>
            <option value="PROCEDIMENTO">Procedimento</option><option value="MATERIAL">Apenas material</option><option value="AMBOS">Material e procedimento</option>
          </SelectCampo></label>
        </>}
        {atual.origemMaterial === "DOCUMENTADA" && <>
          <label className="relative">Valor comprovado do material documentado (R$)<Input className={classeInput} type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} /><span className="absolute right-0 top-0"> <AjudaCampo rotulo="Ajuda sobre comprovação do material" texto="Sem valor: custo desconhecido. Zero também exige comprovação."/></span></label>

          {valor !== "" && <>
            <label>Referência da comprovação<Input className={classeInput} required minLength={2} maxLength={200} value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
            <label>Evidência do valor<Textarea className={classeInput} required minLength={5} maxLength={2000} value={evidencia} onChange={e => setEvidencia(e.target.value)} /></label>
          </>}
        </>}
        <label>Motivo da classificação<Textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={e => aoMudarMotivo(e.target.value)} /></label>
        <Button type="submit" disabled={ocupado}>Salvar classificação</Button>
      </>}
    </fieldset></form>
  </section>;
}
