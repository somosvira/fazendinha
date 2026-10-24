import type { Dispatch, SetStateAction } from "react";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { BuilderEtapasProtocolo } from "./BuilderEtapasProtocolo";
import { SeletorCatalogoProtocolo } from "./SeletorCatalogoProtocolo";
import { CamposReferenciasCusto, type ReferenciasCustoCadastro } from "./CamposReferenciasCusto";
import { momentoParaCadastro, type MomentoCadastro, type SubtipoAplicacaoCadastro } from "./CamposMomentoAcao";
import type { CadastroProtocoloMeta } from "./cadastros-api";
export type Etapa = {
  chaveEdicao?: string;
  referenciasCusto?: ReferenciasCustoCadastro;
  ordem?: number;
  momento?: MomentoCadastro | null;
  subtipo?: SubtipoAplicacaoCadastro;
  diaRelativo: number;
  tipo: "APLICACAO" | "EXAME" | "MANEJO" | "RETIRADA";
  produtoId: string;
  tipoExameId: string;
  tipoAplicacaoId: string;
  dose: string;
  unidade: string;
};
export type EtapaPersistida = Omit<Etapa, "produtoId" | "tipoExameId" | "tipoAplicacaoId" | "dose" | "unidade"> & {
  produtoId: string | null; tipoExameId: string | null; tipoAplicacaoId: string | null;
  dose: string | null; unidade: string | null; tipoAplicacaoNomeSnapshot: string | null;
  configuracao?: { subtipo?: SubtipoAplicacaoCadastro; referenciasCusto?:ReferenciasCustoCadastro } | null;
};
export function etapaEditavel(e: EtapaPersistida): Etapa {
  return { ...e, chaveEdicao: crypto.randomUUID(), referenciasCusto:e.configuracao?.referenciasCusto, momento: e.momento ? momentoParaCadastro(e.momento) : undefined,
    subtipo: e.tipo === "APLICACAO" ? e.configuracao?.subtipo : undefined,
    produtoId: e.produtoId ?? "", tipoExameId: e.tipoExameId ?? "", tipoAplicacaoId: e.tipoAplicacaoId ?? "", dose: e.dose ?? "", unidade: e.unidade ?? "ML" };
}
export const nova = (momento: MomentoCadastro = { nome: "D0", ordem: 1, modoAtendimento: "MANUAL" }): Etapa => ({
  chaveEdicao: crypto.randomUUID(),
  momento: { ...momento },
  diaRelativo: 0,
  tipo: "APLICACAO",
  produtoId: "",
  tipoExameId: "",
  tipoAplicacaoId: "",
  dose: "",
  unidade: "",
});
export function EditorModeloSanitario({ origemCadastro, etapas, setEtapas, setAcoesCompletas, acoesCompletas, indiceErroCadastro }: {
  origemCadastro: CadastroProtocoloMeta | null; etapas: Etapa[]; setEtapas: Dispatch<SetStateAction<Etapa[]>>;
  setAcoesCompletas: (valor: boolean) => void; acoesCompletas: boolean; indiceErroCadastro: number | null;
}) {
  const mudar = (i: number, patch: Partial<Etapa>) => setEtapas(es => es.map((e, j) => i === j ? { ...e, ...patch } : e));
  return <BuilderEtapasProtocolo<Etapa>
              origem={origemCadastro} itens={etapas} onChange={setEtapas} onCompletoChange={setAcoesCompletas}
              indiceErro={indiceErroCadastro} criarAcao={(momento, referencia) => ({ ...nova(momento), diaRelativo: referencia?.diaRelativo ?? 0 })}
              converter={e => ({ ...etapaEditavel(e as EtapaPersistida), ...(e.momento ? { momento: etapas.find(atual => atual.momento?.ordem === e.momento?.ordem)?.momento ?? momentoParaCadastro(e.momento) } : {}) })}
              renderizarCalendario={(et, indices) => <fieldset disabled={!acoesCompletas} className="grid gap-3">
                {indices.some(i => etapas[i].diaRelativo !== et.diaRelativo) && <p role="status" className="text-sm">Esta etapa tem intervalos individuais diferentes. Alterar o intervalo abaixo atualiza explicitamente todos os seus procedimentos.</p>}
                <label>Dia relativo ao início<input required type="number" min="0" max="10000" step="1" value={et.diaRelativo} className={classeInput} onChange={e => { const diaRelativo = Number(e.target.value); setEtapas(es => es.map((acao, i) => indices.includes(i) ? { ...acao, diaRelativo } : acao)); }} /></label>
              </fieldset>}
              renderizarAcao={(et, i) => <div className="grid gap-3">
                <label>Tipo de procedimento<select value={et.tipo === "APLICACAO" && et.subtipo === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : et.tipo} className={classeInput} onChange={e => {
                  const tipo = e.target.value === "INSERCAO_DISPOSITIVO" ? "APLICACAO" : e.target.value as Etapa["tipo"];
                  mudar(i, { tipo, subtipo: tipo === "APLICACAO" ? e.target.value === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" : undefined, produtoId: "", tipoExameId: "", tipoAplicacaoId: "", dose: "", unidade: "", referenciasCusto: et.referenciasCusto ? { servico: et.referenciasCusto.servico } : undefined });
                }}><option value="APLICACAO">Aplicação de produto</option><option value="INSERCAO_DISPOSITIVO">Inserção de dispositivo</option><option value="RETIRADA">Retirada de dispositivo</option><option value="EXAME">Exame / diagnóstico</option>{et.tipo === "MANEJO" && <option value="MANEJO">Manejo legado (compatibilidade)</option>}</select></label>
                {et.tipo === "APLICACAO" ? <>
                  <SeletorCatalogoProtocolo origem="SANITARIO" opcao="PRODUTO" rotulo="Produto" valor={et.produtoId} onChange={(produtoId, produto) => mudar(i, { produtoId, dose: produtoId === et.produtoId ? et.dose : "", unidade: produtoId === et.produtoId ? et.unidade : produto?.unidade ?? "", tipoAplicacaoId: produtoId === et.produtoId ? et.tipoAplicacaoId : produto?.perfilSanitario?.tipoAplicacaoId ?? "" })} />
                  <div className="grid gap-3 sm:grid-cols-2"><label>Quantidade prevista ({et.unidade || "selecione o produto"})<input required type="number" min="0.001" step="0.001" value={et.dose} className={classeInput} onChange={e => mudar(i, { dose: e.target.value })} /></label><label>Unidade do produto<input className={classeInput} readOnly value={et.produtoId ? et.unidade : ""} /></label></div>
                  {et.momento?.modoAtendimento === "AUTOMATIZADA" && !et.tipoAplicacaoId && <p role="alert" className="text-sm">Configure o tipo padrão no produto ou utilize modo manual.</p>}
                  {et.tipoAplicacaoId && <SeletorCatalogoProtocolo somenteLeitura origem="SANITARIO" opcao="TIPO_APLICACAO" rotulo="Classificação da aplicação" valor={et.tipoAplicacaoId} onChange={() => {}} />}
                  {!et.momento?.modoAtendimento && <SeletorCatalogoProtocolo origem="SANITARIO" opcao="TIPO_APLICACAO" rotulo="Tipo de aplicação" valor={et.tipoAplicacaoId} onChange={tipoAplicacaoId => mudar(i, { tipoAplicacaoId })} />}
                </> : et.tipo === "EXAME" ? <SeletorCatalogoProtocolo origem="SANITARIO" opcao="TIPO_EXAME" rotulo="Tipo de exame" valor={et.tipoExameId} onChange={tipoExameId => mudar(i, { tipoExameId })} /> : <p className="text-sm">{et.tipo === "RETIRADA" ? "Sem produto previsto. A inserção válida deste animal será conferida no atendimento, sem devolução ao estoque." : "Registro legado preservado. Escolha um procedimento suportado para uma nova configuração."}</p>}
                <details><summary className="cursor-pointer text-sm">Referências de custo (opcional)</summary><CamposReferenciasCusto valor={et.referenciasCusto} material={et.tipo === "APLICACAO"} onChange={referenciasCusto => mudar(i, { referenciasCusto })} /></details>
              </div>}
            />;
}
