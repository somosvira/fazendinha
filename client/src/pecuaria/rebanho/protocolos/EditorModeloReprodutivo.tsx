import { useEffect, useId, useState, type Dispatch, type SetStateAction } from "react";
import { SeletorProdutoCatalogo, type ProdutoEscolhido } from "../../../estoque/SeletorProdutoCatalogo";
import { SelectBuscavel } from "../../../components/SelectBuscavel";
import { opcoesProtocolo } from "./opcoesProtocolo";
import { Button } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { listarCategorias } from "../../../estoque/api";
import type { Categoria } from "../../../financeiro/novo-api";
import { rotuloUnidade, type UnidadeMedida } from "../../../lib/unidades";
import { getUsuario } from "../../../lib/auth";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { BuilderEtapasProtocolo } from "./BuilderEtapasProtocolo";
import { CamposReferenciasCusto } from "./CamposReferenciasCusto";
import { momentoParaCadastro } from "./CamposMomentoAcao";
import type { CadastroProtocoloMeta } from "./cadastros-api";
import { etapaParaCadastro, PlanoEtapa, OrientacaoTemporalEtapa, type EtapaIatf } from "../reproducao/Iatf";
import { SelectCampo } from "@/financeiro/SelectCampo";
export function EditorModeloReprodutivo({ origemCadastro, etapas, setEtapas, setAcoesCompletas, acoesCompletas, indiceErroCadastro, erroCampo, sitioEfetivo, contratoNovo = true }: {
  origemCadastro: CadastroProtocoloMeta | null; etapas: EtapaIatf[]; setEtapas: Dispatch<SetStateAction<EtapaIatf[]>>;
  setAcoesCompletas: (valor: boolean) => void; acoesCompletas: boolean; indiceErroCadastro: number | null; erroCampo: { indice: number; campo: string; mensagem: string } | null; sitioEfetivo?: number | null; contratoNovo?: boolean;
}) {
  const idCampos = useId();
  const usuario = getUsuario();
  const podeVerValores = !usuario || usuario.dono || (usuario.areas.includes("financeiro") && usuario.flags.includes("verValores"));
  const [referencias, setReferencias] = useState<number | null>(null);
  const [catalogo, setCatalogo] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erroCategorias, setErroCategorias] = useState("");
  useEffect(() => { if (!etapas.some(e => e.planoAplicacao?.produtoCatalogoId)) return; let ativo = true; listarCategorias().then(v => { if (ativo) setCategorias(v.filter(c => c.ativo)); }).catch(() => { if (ativo) setErroCategorias("Não foi possível carregar as categorias."); }); return () => { ativo = false; }; }, [etapas.some(e => !!e.planoAplicacao?.produtoCatalogoId)]);
  function camposAplicacao(t: EtapaIatf, indice: number, compacto = false) {
    const plano = t.planoAplicacao;
    const erro = erroCampo?.indice === indice ? erroCampo : null;
    const erroProduto = erro && ["produtoId", "produtoCatalogoId"].includes(erro.campo) ? erro.mensagem : undefined;
    const erroCategoria = erro?.campo === "categoriaId" ? erro.mensagem : undefined;
    const erroDose = erro && ["dose", "unidadeDose"].includes(erro.campo) ? erro.mensagem : undefined;
    const erroGeral = erro && !erroProduto && !erroCategoria && !erroDose ? erro.mensagem : undefined;
    const rotuloDose = compacto ? "Quantidade por animal" : "Dose planejada";
    const larguraDose = `${Math.max(1.5, String(plano?.dose ?? "").length + 0.25)}ch`;
    const idDose = `${idCampos}-dose-${indice}`;
    const idCategoria = `${idCampos}-categoria-${indice}`;
    function alterarPlano(alterar: (atual: EtapaIatf["planoAplicacao"]) => EtapaIatf["planoAplicacao"]) {
      setEtapas(es => es.map((acao, i) => i === indice ? { ...acao, planoAplicacao: alterar(acao.planoAplicacao) } : acao));
    }
    return <>
      <div className={compacto ? "quadro-produto" : "quadro-produto quadro-produto-manutencao"}>
        <SelectBuscavel
          buscar={opcoesProtocolo({ opcao: "PRODUTO", origem: "SANITARIO", propriedadeId: sitioEfetivo ?? undefined })}
          rotulo="Produto planejado" valor={plano?.produtoId ?? ""} erroCampo={erroProduto}
          limpavel={!compacto} chevronSimples={compacto}
          onChange={(produtoId, produto) => alterarPlano(atual => !produtoId ? undefined : produtoId === atual?.produtoId ? atual : {
            produtoId, dose: "", unidadeDose: (produto?.unidade ?? "ML") as UnidadeMedida,
            via: produto?.perfilSanitario?.viaPadrao ?? null, tipoAplicacaoId: produto?.perfilSanitario?.tipoAplicacaoId ?? null,
          })}
        />
        <Button secondary type="button" onClick={() => setCatalogo(indice)}>Ver catálogo</Button>
      </div>
      {plano?.produtoCatalogoId && <>
        <p>{plano.nomeProduto} · será adotado ao salvar</p>
        <div>
          <label htmlFor={idCategoria}>Categoria do produto</label>
          <SelectCampo id={idCategoria} value={plano.categoriaId ?? ""} aria-invalid={!!erroCategoria}
            aria-describedby={erroCategoria ? `${idCategoria}-erro` : undefined}
            onValueChange={categoriaId => alterarPlano(atual => atual && { ...atual, categoriaId: categoriaId || undefined })}>
            <option value="">Categoria sugerida automaticamente</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </SelectCampo>
          {erroCategoria && <p id={`${idCategoria}-erro`} role="alert" className="text-sm text-destructive">{erroCategoria}</p>}
          {erroCategorias && <p role="alert">{erroCategorias}</p>}
        </div>
      </>}
      <div>
        <label htmlFor={idDose}>
          {rotuloDose}
          <span className="quadro-quantidade">
            <input id={idDose} aria-label={rotuloDose} type="number" min="0.001" step="0.001" value={plano?.dose ?? ""}
              aria-invalid={!!erroDose}
              aria-describedby={[plano && `${idDose}-unidade`, erroDose && `${idDose}-erro`].filter(Boolean).join(" ") || undefined}
              style={{ width: larguraDose, minInlineSize: larguraDose, flex: `0 0 ${larguraDose}` }}
              onChange={e => { const dose = e.target.value; alterarPlano(atual => atual && { ...atual, dose }); }} />
            {plano && <span id={`${idDose}-unidade`} aria-hidden>{rotuloUnidade(plano.unidadeDose)}</span>}
          </span>
        </label>
        {erroDose && <p id={`${idDose}-erro`} role="alert" className="text-sm text-destructive">{erroDose}</p>}
      </div>
      {erroGeral && <p role="alert" className="text-sm text-destructive" tabIndex={-1}>{erroGeral}</p>}
    </>;
  }
  return <><BuilderEtapasProtocolo<EtapaIatf> permitirAutomacao editorEmModal
                  quadro={item => ({ procedimento: item.nome, produto: item.tipo === "APLICACAO" && item.planoAplicacao?.produtoId ? <SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "PRODUTO", origem: "SANITARIO" })} rotulo="Produto planejado" valor={item.planoAplicacao.produtoId} onChange={() => {}} /> : item.planoAplicacao?.nomeProduto ?? (item.tipo === "EXAME" && item.planoExame?.tipoExameId ? <SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "TIPO_EXAME", origem: "SANITARIO" })} rotulo="Modelo de exame" valor={item.planoExame.tipoExameId} onChange={() => {}} /> : item.tipo === "AVALIACAO" && item.planoAvaliacao?.tipoExameId ? <SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "TIPO_EXAME", origem: "REPRODUTIVO" })} rotulo="Modelo de exame" valor={item.planoAvaliacao.tipoExameId} onChange={() => {}} /> : item.tipo === "TENTATIVA" ? "Material genético" : item.tipo === "RETIRADA" ? "Não informado" : "Pendente"), quantidade: item.tipo === "RETIRADA" ? "Não se aplica" : item.tipo === "APLICACAO" && item.planoAplicacao?.dose ? `${item.planoAplicacao.dose} ${rotuloUnidade(item.planoAplicacao.unidadeDose)}` : "Pendente" })}
                  resumoEtapa={itens => ({ referencia: `${itens[0]?.unidade === "HORAS" ? "H" : "D"}${itens[0]?.intervalo ?? 0}`, procedimentos: itens.map(item => item.nome).join(" · ") })}
                  origem={origemCadastro} itens={etapas} onChange={setEtapas} onCompletoChange={setAcoesCompletas}
                  indiceErro={indiceErroCadastro}
                  criarAcao={(momento, referencia) => ({ chaveEdicao: crypto.randomUUID(), nome: "Aplicação de produto", tipo: "APLICACAO", intervalo: referencia?.intervalo ?? 0, unidade: referencia?.unidade ?? "DIAS", orientacaoTemporal: referencia?.orientacaoTemporal, momento: { ...momento } })}
                  converter={e => ({ ...etapaParaCadastro(e), chaveEdicao: crypto.randomUUID(), tentativaTipo: e.tentativaTipo, ordem: e.ordem, ...(e.momento ? { momento: etapas.find(atual => atual.momento?.ordem === e.momento?.ordem)?.momento ?? momentoParaCadastro(e.momento) } : {}) })}
                  renderizarCalendario={(t, indices) => <fieldset disabled={!acoesCompletas} className="grid gap-3 sm:grid-cols-2">
                    {indices.some(i => etapas[i].intervalo !== t.intervalo || etapas[i].unidade !== t.unidade) && <p role="status" className="text-sm sm:col-span-2">Esta etapa tem intervalos individuais diferentes. Alterar o calendário abaixo atualiza explicitamente todos os seus procedimentos.</p>}
                    <label>Intervalo desde o início<input className={classeInput} required type="number" min={0} max={10000} step="any" value={t.intervalo} onChange={e => { const intervalo = Number(e.target.value); setEtapas(es => es.map((acao, i) => indices.includes(i) ? { ...acao, intervalo } : acao)); }} /></label>
                    <label>Unidade do intervalo<SelectCampo className={classeInput} value={t.unidade} onValueChange={(valor) => { const unidade = valor as "DIAS" | "HORAS"; setEtapas(es => es.map((acao, i) => indices.includes(i) ? { ...acao, unidade } : acao)); }}><option value="DIAS">Dias</option><option value="HORAS">Horas</option></SelectCampo></label>
                    <div className="sm:col-span-2"><OrientacaoTemporalEtapa etapa={t} onChange={novo => setEtapas(es => es.map((acao, i) => indices.includes(i) ? { ...acao, orientacaoTemporal: novo.orientacaoTemporal } : acao))} /></div>
                  </fieldset>}
                  renderizarDetalhes={(t, i) => <div className="grid gap-3"><label>Tipo de procedimento<SelectCampo className={classeInput} value={t.tipo === "APLICACAO" ? t.subtipo === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" : t.tipo === "TENTATIVA" ? t.tentativaTipo ?? t.planoTentativa?.tipo ?? "IA" : t.tipo === "AVALIACAO" ? "EXAME" : t.tipo} onValueChange={valor => { const tipo: EtapaIatf["tipo"] = valor === "INSERCAO_DISPOSITIVO" ? "APLICACAO" : valor === "IA" || valor === "TE" ? "TENTATIVA" : valor === "EXAME" ? "AVALIACAO" : valor as EtapaIatf["tipo"]; const nomes: Record<string,string> = { APLICACAO: "Aplicação de produto", INSERCAO_DISPOSITIVO: "Inserção de dispositivo", RETIRADA: "Retirada de dispositivo", IA: "Inseminação", TE: "Transferência de embrião", EXAME: "Exame / diagnóstico" }; setEtapas(es => es.map((acao,j) => j === i ? { chaveEdicao: acao.chaveEdicao, ordem: acao.ordem, momento: acao.momento, nome: nomes[valor] ?? acao.nome, intervalo: acao.intervalo, unidade: acao.unidade, orientacaoTemporal: acao.orientacaoTemporal, tipo, ...(valor === "IA" || valor === "TE" ? { tentativaTipo: valor } : {}), ...(tipo === "APLICACAO" ? { subtipo: valor === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" } : {}), referenciasCusto: acao.referenciasCusto ? { servico: acao.referenciasCusto.servico } : undefined } : acao)); }}><option value="APLICACAO">Aplicação de produto</option><option value="INSERCAO_DISPOSITIVO">Inserção de dispositivo</option><option value="RETIRADA">Retirada de dispositivo</option><option value="IA">Inseminação</option><option value="TE">Transferência de embrião</option><option value="EXAME">Exame / diagnóstico</option>{t.tipo === "MANEJO" && <option value="MANEJO">Manejo legado</option>}</SelectCampo></label>
                    {t.tipo === "APLICACAO" ? camposAplicacao(t, i, true) : <PlanoEtapa propriedadeId={sitioEfetivo ?? undefined} etapa={t} contratoNovo={contratoNovo} tipoDefinido onChange={novo => setEtapas(es => es.map((acao,j) => j === i ? novo : acao))} />}</div>}
                  renderizarAcao={(t, i) => <div className="grid gap-3">
                    <label>Tipo de procedimento<SelectCampo className={classeInput} value={t.tipo === "APLICACAO" ? t.subtipo === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" : t.tipo === "TENTATIVA" ? t.tentativaTipo ?? t.planoTentativa?.tipo ?? "IA" : t.tipo === "AVALIACAO" ? "EXAME" : t.tipo} onValueChange={(escolha) => {
                      const valor = escolha;
                      const tipo: EtapaIatf["tipo"] = valor === "INSERCAO_DISPOSITIVO" ? "APLICACAO" : valor === "IA" || valor === "TE" ? "TENTATIVA" : valor === "EXAME" ? "AVALIACAO" : valor as EtapaIatf["tipo"];
                      const nomes: Record<string, string> = { APLICACAO: "Aplicação de produto", INSERCAO_DISPOSITIVO: "Inserção de dispositivo", RETIRADA: "Retirada de dispositivo", IA: "Inseminação", TE: "Transferência de embrião", EXAME: "Exame / diagnóstico" };
                      setEtapas(es => es.map((acao, j) => j === i ? { chaveEdicao: acao.chaveEdicao, ordem: acao.ordem, momento: acao.momento, nome: nomes[valor] ?? acao.nome, intervalo: acao.intervalo, unidade: acao.unidade, orientacaoTemporal: acao.orientacaoTemporal, tipo, ...(valor === "IA" || valor === "TE" ? { tentativaTipo: valor } : {}), ...(tipo === "APLICACAO" ? { subtipo: valor === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" } : {}), referenciasCusto: acao.referenciasCusto ? { servico: acao.referenciasCusto.servico } : undefined } : acao));
                    }}><option value="APLICACAO">Aplicação de produto</option><option value="INSERCAO_DISPOSITIVO">Inserção de dispositivo</option><option value="RETIRADA">Retirada de dispositivo</option><option value="IA">Inseminação</option><option value="TE">Transferência de embrião</option><option value="EXAME">Exame / diagnóstico</option>{t.tipo === "MANEJO" && <option value="MANEJO">Manejo legado (compatibilidade)</option>}</SelectCampo></label>
                    <label>Nome do procedimento<input className={classeInput} required maxLength={120} value={t.nome} onChange={e => { const nome = e.target.value; setEtapas(es => es.map((acao, j) => j === i ? { ...acao, nome } : acao)); }} /></label>
                    {(t.tipo === "AVALIACAO" || t.tipo === "EXAME") && <label>Contexto do modelo de exame<SelectCampo className={classeInput} value={t.tipo === "AVALIACAO" ? "REPRODUTIVO" : "SANITARIO"} onValueChange={(valor) => setEtapas(es => es.map((acao, j) => j === i ? { ...acao, tipo: valor === "REPRODUTIVO" ? "AVALIACAO" : "EXAME", planoAvaliacao: undefined, planoExame: undefined } : acao))}><option value="REPRODUTIVO">Reprodutivo</option><option value="SANITARIO">Sanitário</option></SelectCampo></label>}
                    {t.tipo === "APLICACAO" ? camposAplicacao(t, i) : <PlanoEtapa propriedadeId={sitioEfetivo ?? undefined} etapa={t} contratoNovo={contratoNovo} tipoDefinido onChange={novo => setEtapas(es => es.map((acao, j) => j === i ? novo : acao))} />}
                    {podeVerValores && <Button secondary type="button" onClick={() => setReferencias(i)}>Editar referência de serviço</Button>}
                  </div>}
                />{referencias !== null && etapas[referencias] && <PainelCadastro aberto titulo="Referência de serviço" camada="sobreDetalhe" rascunhoPersistido onFechar={() => setReferencias(null)} rodape={<Button type="button" onClick={() => setReferencias(null)}>Concluir</Button>}><CamposReferenciasCusto direto valor={etapas[referencias].referenciasCusto} material={false} onChange={referenciasCusto => setEtapas(es => es.map((acao,j) => j === referencias ? { ...acao, referenciasCusto } : acao))} /></PainelCadastro>}{catalogo !== null && <PainelCadastro aberto titulo="Catálogo de produtos" camada="sobreDetalhe" rascunhoPersistido onFechar={() => setCatalogo(null)} rodape={<Button type="button" onClick={() => setCatalogo(null)}>Concluir</Button>}><p>O produto do catálogo será adotado ao salvar o protocolo.</p><SeletorProdutoCatalogo rotulo="Produto planejado" uso="sanitario" value={null} onChange={(escolha: ProdutoEscolhido | null) => { if (!escolha) return; setEtapas(es => es.map((acao, i) => i !== catalogo || (escolha.tipo === "catalogo" ? escolha.produtoCatalogoId === acao.planoAplicacao?.produtoCatalogoId : escolha.produtoId === acao.planoAplicacao?.produtoId) ? acao : { ...acao, planoAplicacao: { produtoId: escolha.tipo === "produto" ? escolha.produtoId : "", ...(escolha.tipo === "catalogo" ? { produtoCatalogoId: escolha.produtoCatalogoId, categoriaId: escolha.categoriaSugeridaId ?? undefined, nomeProduto: escolha.nomeCompleto } : { nomeProduto: escolha.nome }), dose: (escolha.tipo === "catalogo" ? escolha.produtoCatalogoId === acao.planoAplicacao?.produtoCatalogoId : escolha.produtoId === acao.planoAplicacao?.produtoId) ? acao.planoAplicacao?.dose ?? "" : "", unidadeDose: (escolha.tipo === "catalogo" ? escolha.produtoCatalogoId === acao.planoAplicacao?.produtoCatalogoId : escolha.produtoId === acao.planoAplicacao?.produtoId) ? acao.planoAplicacao?.unidadeDose ?? "ML" : escolha.tipo === "catalogo" ? escolha.unidadeSugerida : escolha.produto?.unidade ?? "ML" } })); setCatalogo(null); }} /></PainelCadastro>}</>;
}
