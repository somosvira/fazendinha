import { useEffect, useId, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { SeletorProdutoCatalogo, type ProdutoEscolhido } from "../../../estoque/SeletorProdutoCatalogo";
import { SelectBuscavel } from "../../../components/SelectBuscavel";
import { opcoesProtocolo } from "./opcoesProtocolo";
import { Button } from "../../../financeiro/financeiro-ui";
import { listarCategorias } from "../../../estoque/api";
import type { Categoria } from "../../../financeiro/novo-api";
import { rotuloUnidade, type UnidadeMedida } from "../../../lib/unidades";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { BuilderEtapasProtocolo, type CargaAcoesCadastro } from "./BuilderEtapasProtocolo";
import { momentoParaCadastro } from "./CamposMomentoAcao";
import type { CadastroProtocoloMeta } from "./cadastros-api";
import { etapaParaCadastro, PlanoEtapa, type EtapaIatf } from "../reproducao/Iatf";
import { SelectCampo } from "@/financeiro/SelectCampo";

const nomesDeProcedimento = {
  APLICACAO: "Aplicação de produto",
  INSERCAO_DISPOSITIVO: "Inserção de dispositivo",
  RETIRADA: "Retirada de dispositivo",
  IA: "Inseminação",
  TE: "Transferência de embrião",
  COBERTURA: "Cobertura observada",
  EXAME: "Exame / diagnóstico",
  MANEJO: "Manejo legado",
};

function tipoDoProcedimento(acao: EtapaIatf): keyof typeof nomesDeProcedimento {
  if (acao.tipo === "TENTATIVA") return acao.tentativaTipo ?? acao.planoTentativa?.tipo ?? "IA";
  if (acao.tipo === "APLICACAO" && acao.subtipo === "INSERCAO_DISPOSITIVO") return "INSERCAO_DISPOSITIVO";
  return acao.tipo === "AVALIACAO" ? "EXAME" : acao.tipo;
}

export function nomeProcedimentoReprodutivo(acao: EtapaIatf) {
  return acao.nome.trim() || nomesDeProcedimento[tipoDoProcedimento(acao)];
}

const prazoDefinidoNaIdentificacao = (acao: EtapaIatf) => acao.referenciaPrazoDiagnostico || acao.referenciaPrazoReconfirmacao;

function primeiraHoraNoCalendario(acoes: EtapaIatf[]) {
  const horas = acoes
    .filter(acao => !acao.intervaloPendente && !prazoDefinidoNaIdentificacao(acao))
    .map(acao => acao.intervalo * (acao.unidade === "HORAS" ? 1 : 24));
  return Math.min(...horas);
}

export function EditorModeloReprodutivo({ origemCadastro, cargaPersistida, etapas, setEtapas, setAcoesCompletas, acoesCompletas, indiceErroCadastro, erroNoCalendario = false, onEncerrarEdicao, erroCampo, sitioEfetivo, contratoNovo = true, podeRemover, prazoDg, prazoReconfirmacao, tituloQuadro, somenteLeitura }: {
  origemCadastro: CadastroProtocoloMeta | null; cargaPersistida?: MutableRefObject<CargaAcoesCadastro | null>; etapas: EtapaIatf[]; setEtapas: Dispatch<SetStateAction<EtapaIatf[]>>;
  onEncerrarEdicao?: () => void;
  setAcoesCompletas: (valor: boolean) => void; acoesCompletas: boolean; indiceErroCadastro: number | null; erroNoCalendario?: boolean; erroCampo: { indice: number; campo: string; mensagem: string } | null; sitioEfetivo?: number | null; contratoNovo?: boolean; podeRemover?: (indices: number[]) => boolean; prazoDg?: string; prazoReconfirmacao?: string; tituloQuadro?: string; somenteLeitura?: boolean;
}) {
  const idCampos = useId();
  const [containerPopover, setContainerPopover] = useState<HTMLElement | null>(null);
  const [catalogo, setCatalogo] = useState<number | null>(null);
  const gatilhoCatalogo = useRef<HTMLButtonElement | null>(null);
  const gatilhosCatalogo = useRef(new Map<number, HTMLButtonElement>());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erroCategorias, setErroCategorias] = useState("");
  const [produtoLocalResolvido, setProdutoLocalResolvido] = useState<{ id: string; nome: string } | null>(null);
  const planoCatalogo = catalogo == null ? undefined : etapas[catalogo]?.planoAplicacao;
  const idProdutoLocal = planoCatalogo?.produtoId;
  const nomeProdutoNoPlano = planoCatalogo?.nomeProduto;
  useEffect(() => {
    if (!idProdutoLocal || nomeProdutoNoPlano) return;
    let ativo = true;
    opcoesProtocolo({ opcao: "PRODUTO", origem: "SANITARIO", propriedadeId: sitioEfetivo ?? undefined })({ busca: "", selecionadoId: idProdutoLocal })
      .then(({ itens }) => {
        if (ativo) setProdutoLocalResolvido(itens.find(item => item.id === idProdutoLocal) ?? null);
      })
      .catch(() => { if (ativo) setProdutoLocalResolvido(null); });
    return () => { ativo = false; };
  }, [idProdutoLocal, nomeProdutoNoPlano, sitioEfetivo]);
  const escolhaCatalogo: ProdutoEscolhido | null = planoCatalogo?.produtoCatalogoId ? {
    tipo: "catalogo", produtoCatalogoId: planoCatalogo.produtoCatalogoId,
    nomeCompleto: planoCatalogo.nomeProduto || "Produto do catálogo", unidadeSugerida: planoCatalogo.unidadeDose,
    categoriaSugeridaId: planoCatalogo.categoriaId ?? null,
  } : idProdutoLocal ? {
    tipo: "produto", produtoId: idProdutoLocal,
    nome: nomeProdutoNoPlano || (produtoLocalResolvido?.id === idProdutoLocal ? produtoLocalResolvido.nome : "Produto planejado"),
  } : null;
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
          containerPopover={containerPopover}
          contentClassName={containerPopover ? "z-[1350]" : undefined}
          buscar={opcoesProtocolo({ opcao: "PRODUTO", origem: "SANITARIO", propriedadeId: sitioEfetivo ?? undefined })}
          rotulo="Produto planejado" valor={plano?.produtoId ?? ""} erroCampo={erroProduto}
          opcaoExterna={plano?.produtoCatalogoId ? { nome: plano.nomeProduto || "Produto do catálogo" } : undefined}
          limpavel={!compacto || !!plano?.produtoCatalogoId} chevronSimples={compacto}
          onChange={(produtoId, produto) => alterarPlano(atual => !produtoId ? undefined : produtoId === atual?.produtoId ? atual : {
            produtoId, nomeProduto: produto?.nome, dose: "", unidadeDose: (produto?.unidade ?? "ML") as UnidadeMedida,
            via: produto?.perfilSanitario?.viaPadrao ?? null, tipoAplicacaoId: produto?.perfilSanitario?.tipoAplicacaoId ?? null,
          })}
        />
        <Button ref={el => { if (el) gatilhosCatalogo.current.set(indice, el); else gatilhosCatalogo.current.delete(indice); }} secondary type="button" onClick={() => { gatilhoCatalogo.current = gatilhosCatalogo.current.get(indice) ?? null; setCatalogo(indice); }}>Ver catálogo</Button>
      </div>
      {plano?.produtoCatalogoId && <>
        <p>Produto do catálogo · será adotado ao salvar</p>
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
  function escolherNoCatalogo(escolha: ProdutoEscolhido | null) {
    if (!escolha) return;
    setEtapas(itens => itens.map((acao, indice) => {
      if (indice !== catalogo) return acao;
      const atual = acao.planoAplicacao;
      if (escolha.tipo === "produto") {
        if (escolha.produtoId === atual?.produtoId) return acao;
        return { ...acao, planoAplicacao: {
          produtoId: escolha.produtoId, nomeProduto: escolha.nome,
          dose: "", unidadeDose: escolha.produto?.unidade ?? "ML",
        } };
      }
      if (escolha.produtoCatalogoId === atual?.produtoCatalogoId) return acao;
      return { ...acao, planoAplicacao: {
        produtoId: "", produtoCatalogoId: escolha.produtoCatalogoId, nomeProduto: escolha.nomeCompleto,
        categoriaId: escolha.categoriaSugeridaId ?? undefined, dose: "", unidadeDose: escolha.unidadeSugerida,
      } };
    }));
    setCatalogo(null);
  }
  function campoNome(acao: EtapaIatf, indice: number) {
    return <label>Nome do procedimento<input
      className={classeInput}
      maxLength={120}
      placeholder={nomesDeProcedimento[tipoDoProcedimento(acao)]}
      value={acao.nome}
      onChange={e => {
        const nome = e.target.value;
        setEtapas(itens => itens.map((item, i) => i === indice ? { ...item, nome } : item));
      }}
    /></label>;
  }

  function alterarTipo(indice: number, valor: string) {
    const tentativaTipo = valor === "IA" || valor === "TE" || valor === "COBERTURA" ? valor : undefined;
    const tipo: EtapaIatf["tipo"] = valor === "INSERCAO_DISPOSITIVO" ? "APLICACAO" : tentativaTipo ? "TENTATIVA" : valor === "EXAME" ? "AVALIACAO" : valor as EtapaIatf["tipo"];
    setEtapas(itens => itens.map((acao, i) => i === indice ? {
      chaveEdicao: acao.chaveEdicao,
      ordem: acao.ordem,
      momento: acao.momento,
      nome: acao.nome === nomesDeProcedimento[tipoDoProcedimento(acao)] ? "" : acao.nome,
      intervalo: acao.intervalo,
      unidade: acao.unidade,
      orientacaoTemporal: acao.orientacaoTemporal,
      tipo,
      tentativaTipo,
      ...(tipo === "APLICACAO" ? { subtipo: valor === "INSERCAO_DISPOSITIVO" ? "INSERCAO_DISPOSITIVO" : "APLICACAO" } : {}),
      referenciasCusto: acao.referenciasCusto ? { servico: acao.referenciasCusto.servico } : undefined,
    } : acao));
  }

  function camposCalendario(referencia: EtapaIatf, indices: number[]) {
    if (indices.some(i => prazoDefinidoNaIdentificacao(etapas[i]))) {
      return <p>Prazo definido na identificação, a partir do registro correspondente.</p>;
    }
    const unidades = [...new Set(indices.map(i => etapas[i].unidade))];
    const intervalosDistintos = indices.some(i => etapas[i].intervalo !== referencia.intervalo || etapas[i].unidade !== referencia.unidade);
    return <fieldset disabled={!acoesCompletas} className="grid gap-3">
      {intervalosDistintos && <p role="status" className="text-sm">Esta etapa tem intervalos individuais diferentes. Alterar um campo atualiza os procedimentos que usam essa unidade.</p>}
      {unidades.map(unidade => {
        const indicesDaUnidade = indices.filter(i => etapas[i].unidade === unidade);
        const etapa = etapas[indicesDaUnidade[0]];
        const rotulo = unidade === "HORAS" ? "Intervalo em horas" : "Dia da etapa";
        return <label key={unidade}>
          <span>{rotulo} <span aria-hidden="true">*</span></span>
          <span className="quadro-dia-campo">
            <span aria-hidden>{unidade === "HORAS" ? "H+" : "D+"}</span>
            <input
              data-calendario-protocolo
              aria-label={rotulo}
              className={classeInput}
              required type="number" min={0} max={10000} step="any"
              value={etapa.intervaloPendente ? "" : etapa.intervalo}
              onChange={e => {
                const valor = e.target.value;
                setEtapas(itens => itens.map((acao, i) => indicesDaUnidade.includes(i) ? {
                  ...acao, intervalo: valor === "" ? 0 : Number(valor), intervaloPendente: valor === "",
                } : acao));
              }}
            />
          </span>
        </label>;
      })}
    </fieldset>;
  }

  return <><BuilderEtapasProtocolo<EtapaIatf> permitirAutomacao editorEmModal podeRemover={podeRemover} tituloQuadro={tituloQuadro} quadroSomenteLeitura={somenteLeitura}
                  ordemExibicaoEtapa={primeiraHoraNoCalendario}
                  abrirPeloCalendario={item => item.intervaloPendente === true || erroNoCalendario && indiceErroCadastro !== null && etapas[indiceErroCadastro] === item}
                  onEncerrarEdicao={onEncerrarEdicao}
                  motivoEdicaoBloqueada={item => prazoDefinidoNaIdentificacao(item) ? "Para alterar este acompanhamento, volte à Identificação." : undefined}
                  quadro={item => ({ procedimento: nomeProcedimentoReprodutivo(item), produto: item.tipo === "APLICACAO" && item.planoAplicacao?.produtoId ? <SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "PRODUTO", origem: "SANITARIO" })} rotulo="Produto planejado" valor={item.planoAplicacao.produtoId} onChange={() => {}} /> : item.planoAplicacao?.nomeProduto ?? (item.tipo === "EXAME" && item.planoExame?.tipoExameId ? <SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "TIPO_EXAME", origem: "SANITARIO" })} rotulo="Modelo de exame" valor={item.planoExame.tipoExameId} onChange={() => {}} /> : item.tipo === "AVALIACAO" && item.planoAvaliacao?.tipoExameId ? <SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "TIPO_EXAME", origem: "REPRODUTIVO" })} rotulo="Modelo de exame" valor={item.planoAvaliacao.tipoExameId} onChange={() => {}} /> : item.referenciaPrazoDiagnostico || item.referenciaPrazoReconfirmacao ? "Avaliação reprodutiva" : item.tipo === "TENTATIVA" ? item.tentativaTipo === "COBERTURA" ? "Reprodutor no atendimento" : "Material genético" : item.tipo === "RETIRADA" ? "Definido no atendimento" : "Pendente"), quantidade: prazoDefinidoNaIdentificacao(item) ? "—" : item.tipo === "RETIRADA" ? "Não se aplica" : item.tipo === "APLICACAO" && item.planoAplicacao?.dose ? `${item.planoAplicacao.dose} ${rotuloUnidade(item.planoAplicacao.unidadeDose)}` : "Pendente" })}
                  resumoEtapa={itens => ({ referencia: itens.every(item => item.referenciaPrazoReconfirmacao) ? `${prazoReconfirmacao || "Prazo pendente"}${prazoReconfirmacao ? " dias após o primeiro DG positivo" : ""}` : itens.every(item => item.referenciaPrazoDiagnostico) ? `${prazoDg || "Prazo pendente"}${prazoDg ? " dias após a tentativa" : ""}` : itens.some(prazoDefinidoNaIdentificacao) ? "Intervalos distintos" : itens.some(item => item.intervaloPendente) ? "Dia pendente" : itens.some(item => item.intervalo !== itens[0]?.intervalo || item.unidade !== itens[0]?.unidade) ? "Intervalos distintos" : `${itens[0]?.unidade === "HORAS" ? "H" : "D"}${new Intl.NumberFormat("pt-BR", { useGrouping: false, maximumFractionDigits: 20 }).format(itens[0]?.intervalo ?? 0)}`, procedimentos: itens.map(nomeProcedimentoReprodutivo).join(" · ") })}
                  origem={origemCadastro} cargaPersistida={cargaPersistida} itens={etapas} onChange={setEtapas} onCompletoChange={setAcoesCompletas}
                  indiceErro={indiceErroCadastro}
                  criarAcao={(momento, referencia) => ({ chaveEdicao: crypto.randomUUID(), nome: "", tipo: "APLICACAO", intervalo: referencia?.intervalo ?? 0, unidade: referencia?.unidade ?? "DIAS", orientacaoTemporal: referencia?.orientacaoTemporal, momento: { ...momento } })}
                  converter={e => ({ ...etapaParaCadastro(e), chaveEdicao: crypto.randomUUID(), tentativaTipo: e.tentativaTipo, ordem: e.ordem, ...(e.momento ? { momento: etapas.find(atual => atual.momento?.ordem === e.momento?.ordem)?.momento ?? momentoParaCadastro(e.momento) } : {}) })}
                  renderizarCalendario={camposCalendario}
                  renderizarDetalhes={(t, i) => prazoDefinidoNaIdentificacao(t) ? <p>{t.planoAvaliacao?.tipoExameId && t.planoAvaliacao.tipoExameId !== "b0400000-0000-4000-8000-000000000001" ? "Modelo de exame herdado · preservado nesta versão." : "Avaliação reprodutiva · prazo definido na identificação."}</p> : <div ref={setContainerPopover} className="grid gap-3">
                    {campoNome(t, i)}
                    <label>Tipo de procedimento<SelectCampo disabled={podeRemover?.([i]) === false} className={classeInput} value={tipoDoProcedimento(t)} onValueChange={valor => alterarTipo(i, valor)}><option value="APLICACAO">Aplicação de produto</option><option value="INSERCAO_DISPOSITIVO">Inserção de dispositivo</option><option value="RETIRADA">Retirada de dispositivo</option><option value="IA">Inseminação</option><option value="TE">Transferência de embrião</option><option value="COBERTURA">Cobertura observada</option><option value="EXAME">Exame / diagnóstico</option>{t.tipo === "MANEJO" && <option value="MANEJO">Manejo legado</option>}</SelectCampo></label>
                    {(t.tipo === "AVALIACAO" || t.tipo === "EXAME") && podeRemover?.([i]) !== false && <label>Contexto do modelo de exame<SelectCampo className={classeInput} value={t.tipo === "AVALIACAO" ? "REPRODUTIVO" : "SANITARIO"} onValueChange={valor => {
                      const tipo = valor === "REPRODUTIVO" ? "AVALIACAO" : "EXAME";
                      setEtapas(itens => itens.map((acao, j) => j === i && acao.tipo !== tipo ? { ...acao, tipo, planoAvaliacao: undefined, planoExame: undefined } : acao));
                    }}><option value="REPRODUTIVO">Reprodutivo</option><option value="SANITARIO">Sanitário</option></SelectCampo></label>}
                    {t.tipo === "APLICACAO" ? camposAplicacao(t, i, true) : <PlanoEtapa propriedadeId={sitioEfetivo ?? undefined} etapa={t} contratoNovo={contratoNovo} tipoDefinido bloquearTipoAvaliacao={podeRemover?.([i]) === false && t.tipo === "AVALIACAO"} containerPopover={containerPopover} onChange={novo => setEtapas(itens => itens.map((acao, j) => {
                      if (j !== i) return acao;
                      if (podeRemover?.([i]) !== false || acao.tipo !== "AVALIACAO") return novo;
                      const mudouExame = novo.planoAvaliacao?.tipoExameId !== acao.planoAvaliacao?.tipoExameId;
                      return { ...novo, planoAvaliacao: { ...novo.planoAvaliacao, tipo: acao.planoAvaliacao?.tipo ?? "DIAGNOSTICO" }, exameDgAlterado: acao.referenciaPrazoDiagnostico && (acao.exameDgAlterado || mudouExame) };
                    }))} />}
                  </div>}
                  renderizarAcao={(t, i) => <div className="grid gap-3">
                    {campoNome(t, i)}
                    <label>Tipo de procedimento<SelectCampo className={classeInput} value={tipoDoProcedimento(t)} onValueChange={valor => alterarTipo(i, valor)}><option value="APLICACAO">Aplicação de produto</option><option value="INSERCAO_DISPOSITIVO">Inserção de dispositivo</option><option value="RETIRADA">Retirada de dispositivo</option><option value="IA">Inseminação</option><option value="TE">Transferência de embrião</option><option value="COBERTURA">Cobertura observada</option><option value="EXAME">Exame / diagnóstico</option>{t.tipo === "MANEJO" && <option value="MANEJO">Manejo legado (compatibilidade)</option>}</SelectCampo></label>
                    {(t.tipo === "AVALIACAO" || t.tipo === "EXAME") && <label>Contexto do modelo de exame<SelectCampo className={classeInput} value={t.tipo === "AVALIACAO" ? "REPRODUTIVO" : "SANITARIO"} onValueChange={(valor) => setEtapas(es => es.map((acao, j) => j === i ? { ...acao, tipo: valor === "REPRODUTIVO" ? "AVALIACAO" : "EXAME", planoAvaliacao: undefined, planoExame: undefined } : acao))}><option value="REPRODUTIVO">Reprodutivo</option><option value="SANITARIO">Sanitário</option></SelectCampo></label>}
                    {t.tipo === "APLICACAO" ? camposAplicacao(t, i) : <PlanoEtapa propriedadeId={sitioEfetivo ?? undefined} etapa={t} contratoNovo={contratoNovo} tipoDefinido onChange={novo => setEtapas(es => es.map((acao, j) => j === i ? novo : acao))} />}
                  </div>}
                />{catalogo !== null && <SeletorProdutoCatalogo abertoInicial abaInicial="catalogo" retornoFoco={gatilhoCatalogo} aoFechar={() => setCatalogo(null)} propriedadeId={sitioEfetivo ?? undefined} permitirCadastro={false} limpavel={false} rotulo="Produto planejado" contexto="O produto do catálogo será adotado ao salvar o protocolo." uso="sanitario" value={escolhaCatalogo} onChange={escolherNoCatalogo} />}</>;
}
