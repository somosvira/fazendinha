import { useState } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { escreverCustos, type Classificacao, type CustosDTO } from "./api";

const inicial: Classificacao = { finalidade: null, materialNaoAplicavel: false, servicoNaoAplicavel: false, coberturaServico: "PROCEDIMENTO", valorMaterialDocumentado: null };
type Props = {
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

export function EditorClassificacaoCusto({ dados, visivel, propriedadeId, chave, ocupado, motivo, aoMudarMotivo, aoAlterar, gravar }: Props) {
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
  return <details>
    <summary className="cursor-pointer font-semibold">Classificar finalidade e composição</summary>
    <form className="mt-3 grid gap-3" onChange={aoAlterar} onSubmit={e => {
      e.preventDefault();
      if (!atual) return;
      void gravar(() => escreverCustos("/classificacao", { chave, propriedadeId, tipo: atual.tipo, fonteId: atual.id, versao: atual.versaoClassificacao, motivo, ...classificacao, valorMaterialDocumentado: undefined, materialDocumentado: valor !== "" ? { valor, referencia, evidencia } : null }, propriedadeId, "PUT"));
    }}><fieldset disabled={ocupado} className="grid gap-3">
      <label>Fato a classificar<select className={classeInput} required value={fonte} onChange={e => selecionar(e.target.value)}>
        <option value="">Selecione</option>{dados.fontes.map(f => <option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.data} · {f.descricao}</option>)}
      </select></label>
      {atual && <>
        <label>Finalidade gerencial<select className={classeInput} value={classificacao.finalidade ?? ""} onChange={e => setClassificacao({ ...classificacao, finalidade: (e.target.value || null) as Classificacao["finalidade"] })}>
          <option value="">Sem classificação</option><option value="REPRODUCAO">Reprodução</option><option value="SANIDADE">Sanidade</option><option value="ROTINA">Rotina/manutenção</option>
        </select></label>
        <p className="text-xs">A finalidade independe do protocolo ou tentativa a que o fato está vinculado.</p>
        {atual.tipo !== "NUTRICAO" && <>
          <label><input type="checkbox" checked={classificacao.materialNaoAplicavel} onChange={e => setClassificacao({ ...classificacao, materialNaoAplicavel: e.target.checked })} /> Material não aplicável</label>
          <label><input type="checkbox" checked={classificacao.servicoNaoAplicavel} onChange={e => setClassificacao({ ...classificacao, servicoNaoAplicavel: e.target.checked })} /> Serviço/procedimento não aplicável</label>
          <label>O Serviço atribuído cobre<select className={classeInput} value={classificacao.coberturaServico} onChange={e => setClassificacao({ ...classificacao, coberturaServico: e.target.value as Classificacao["coberturaServico"] })}>
            <option value="PROCEDIMENTO">Procedimento</option><option value="MATERIAL">Apenas material</option><option value="AMBOS">Material e procedimento</option>
          </select></label>
        </>}
        {atual.origemMaterial === "DOCUMENTADA" && <>
          <label>Valor comprovado do material documentado (R$)<input className={classeInput} type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} /></label>
          <p className="text-xs">Vazio mantém custo desconhecido. Zero exige a mesma comprovação.</p>
          {valor !== "" && <>
            <label>Referência da comprovação<input className={classeInput} required minLength={2} maxLength={200} value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
            <label>Evidência do valor<textarea className={classeInput} required minLength={5} maxLength={2000} value={evidencia} onChange={e => setEvidencia(e.target.value)} /></label>
          </>}
        </>}
        <label>Motivo da classificação<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={e => aoMudarMotivo(e.target.value)} /></label>
        <Button type="submit" disabled={ocupado}>Salvar classificação</Button>
      </>}
    </fieldset></form>
  </details>;
}
