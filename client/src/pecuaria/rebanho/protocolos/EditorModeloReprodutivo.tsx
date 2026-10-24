import type { Dispatch, SetStateAction } from "react";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { BuilderEtapasProtocolo } from "./BuilderEtapasProtocolo";
import { CamposReferenciasCusto } from "./CamposReferenciasCusto";
import { momentoParaCadastro } from "./CamposMomentoAcao";
import type { CadastroProtocoloMeta } from "./cadastros-api";
import { etapaParaCadastro, PlanoEtapa, OrientacaoTemporalEtapa, type EtapaIatf } from "../reproducao/Iatf";
export function EditorModeloReprodutivo({ origemCadastro, etapas, setEtapas, setAcoesCompletas, acoesCompletas, indiceErroCadastro, sitioEfetivo, contratoNovo = true }: {
  origemCadastro: CadastroProtocoloMeta | null; etapas: EtapaIatf[]; setEtapas: Dispatch<SetStateAction<EtapaIatf[]>>;
  setAcoesCompletas: (valor: boolean) => void; acoesCompletas: boolean; indiceErroCadastro: number | null; sitioEfetivo?: number | null; contratoNovo?: boolean;
}) {
  return <BuilderEtapasProtocolo<EtapaIatf>
                  origem={origemCadastro} itens={etapas} onChange={setEtapas} onCompletoChange={setAcoesCompletas}
                  indiceErro={indiceErroCadastro}
                  criarAcao={(momento, referencia) => ({ chaveEdicao: crypto.randomUUID(), nome: "Aplicação de produto", tipo: "APLICACAO", intervalo: referencia?.intervalo ?? 0, unidade: referencia?.unidade ?? "DIAS", orientacaoTemporal: referencia?.orientacaoTemporal, momento: { ...momento } })}
                  converter={e => ({ ...etapaParaCadastro(e), chaveEdicao: crypto.randomUUID(), tentativaTipo: e.tentativaTipo, ordem: e.ordem, ...(e.momento ? { momento: etapas.find(atual => atual.momento?.ordem === e.momento?.ordem)?.momento ?? momentoParaCadastro(e.momento) } : {}) })}
                  renderizarCalendario={(t, indices) => <fieldset disabled={!acoesCompletas} className="grid gap-3 sm:grid-cols-2">
                    {indices.some(i => etapas[i].intervalo !== t.intervalo || etapas[i].unidade !== t.unidade) && <p role="status" className="text-sm sm:col-span-2">Esta etapa tem intervalos individuais diferentes. Alterar o calendário abaixo atualiza explicitamente todos os seus procedimentos.</p>}
                    <label>Intervalo desde o início<input className={classeInput} required type="number" min={0} max={10000} step="any" value={t.intervalo} onChange={e => { const intervalo = Number(e.target.value); setEtapas(es => es.map((acao, i) => indices.includes(i) ? { ...acao, intervalo } : acao)); }} /></label>
                    <label>Unidade do intervalo<select className={classeInput} value={t.unidade} onChange={e => { const unidade = e.target.value as "DIAS" | "HORAS"; setEtapas(es => es.map((acao, i) => indices.includes(i) ? { ...acao, unidade } : acao)); }}><option value="DIAS">Dias</option><option value="HORAS">Horas</option></select></label>
                    <div className="sm:col-span-2"><OrientacaoTemporalEtapa etapa={t} onChange={novo => setEtapas(es => es.map((acao, i) => indices.includes(i) ? { ...acao, orientacaoTemporal: novo.orientacaoTemporal } : acao))} /></div>
                  </fieldset>}
                  renderizarAcao={(t, i) => <div className="grid gap-3">
                    <label>Tipo de procedimento<select className={classeInput} value={t.tipo === "APLICACAO" ? t.subtipo === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" : t.tipo === "TENTATIVA" ? t.tentativaTipo ?? t.planoTentativa?.tipo ?? "IA" : t.tipo === "AVALIACAO" ? "EXAME" : t.tipo} onChange={e => {
                      const valor = e.target.value;
                      const tipo: EtapaIatf["tipo"] = valor === "INSERCAO_DISPOSITIVO" ? "APLICACAO" : valor === "IA" || valor === "TE" ? "TENTATIVA" : valor === "EXAME" ? "AVALIACAO" : valor as EtapaIatf["tipo"];
                      const nomes: Record<string, string> = { APLICACAO: "Aplicação de produto", INSERCAO_DISPOSITIVO: "Inserção de dispositivo", RETIRADA: "Retirada de dispositivo", IA: "Inseminação", TE: "Transferência de embrião", EXAME: "Exame / diagnóstico" };
                      setEtapas(es => es.map((acao, j) => j === i ? { chaveEdicao: acao.chaveEdicao, ordem: acao.ordem, momento: acao.momento, nome: nomes[valor] ?? acao.nome, intervalo: acao.intervalo, unidade: acao.unidade, orientacaoTemporal: acao.orientacaoTemporal, tipo, ...(valor === "IA" || valor === "TE" ? { tentativaTipo: valor } : {}), ...(tipo === "APLICACAO" ? { subtipo: valor === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" } : {}), referenciasCusto: acao.referenciasCusto ? { servico: acao.referenciasCusto.servico } : undefined } : acao));
                    }}><option value="APLICACAO">Aplicação de produto</option><option value="INSERCAO_DISPOSITIVO">Inserção de dispositivo</option><option value="RETIRADA">Retirada de dispositivo</option><option value="IA">Inseminação</option><option value="TE">Transferência de embrião</option><option value="EXAME">Exame / diagnóstico</option>{t.tipo === "MANEJO" && <option value="MANEJO">Manejo legado (compatibilidade)</option>}</select></label>
                    <label>Nome do procedimento<input className={classeInput} required maxLength={120} value={t.nome} onChange={e => { const nome = e.target.value; setEtapas(es => es.map((acao, j) => j === i ? { ...acao, nome } : acao)); }} /></label>
                    {(t.tipo === "AVALIACAO" || t.tipo === "EXAME") && <label>Contexto do modelo de exame<select className={classeInput} value={t.tipo === "AVALIACAO" ? "REPRODUTIVO" : "SANITARIO"} onChange={e => setEtapas(es => es.map((acao, j) => j === i ? { ...acao, tipo: e.target.value === "REPRODUTIVO" ? "AVALIACAO" : "EXAME", planoAvaliacao: undefined, planoExame: undefined } : acao))}><option value="REPRODUTIVO">Reprodutivo</option><option value="SANITARIO">Sanitário</option></select></label>}
                    <PlanoEtapa propriedadeId={sitioEfetivo ?? undefined} etapa={t} contratoNovo={contratoNovo} tipoDefinido onChange={novo => setEtapas(es => es.map((acao, j) => j === i ? novo : acao))} />
                    <details><summary className="cursor-pointer text-sm">Referências de custo (opcional)</summary><CamposReferenciasCusto valor={t.referenciasCusto} material={["APLICACAO", "TENTATIVA"].includes(t.tipo)} onChange={referenciasCusto => setEtapas(es => es.map((acao, j) => j === i ? { ...acao, referenciasCusto } : acao))} /></details>
                  </div>}
                />;
}
