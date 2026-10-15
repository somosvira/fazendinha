import { PartoCampos, camposPartoPayload, dadosPartoVazios, validarDadosParto } from "./PartoCampos";
import { CamposAvaliacao } from "./CamposAvaliacao";
import { CamposResultadoExame, type ObservacaoExame } from "../sanidade/CamposExame";
import type { TipoExame } from "../sanidade/CadastrosSanitarios";
import { AlertasSanitarios } from "./AlertasSanitarios";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import {
  listarAnimais,
  listarGenitores,
  listarLotes,
  listarMaterialGenetico,
} from "../api";
import type {
  AnimalResumo,
  GenitorDTO,
  Lote,
  MaterialGeneticoDTO,
} from "../types";
import {
  listarPartidasNutricionais,
  type PartidaNutricional,
} from "../nutricao/api";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { listarServicos, type ServicoSanitario } from "../sanidade/api";
import {
  type AvaliacaoInput,
  type CriaInput,
  type PainelReprodutivo,
  registrarAvaliacao,
  registrarParto,
  registrarTentativa,
  reqV4,
  type TentativaInput,
  type PartoInput,
} from "./api";

export type AcaoReprodutiva =
  | "tentativa"
  | "avaliacao"
  | "parto"
  | "situacao"
  | "restricao";
const TITULOS: Record<AcaoReprodutiva, string> = {
  tentativa: "Registrar tentativa",
  avaliacao: "Avaliação reprodutiva",
  parto: "Registrar parto",
  situacao: "Situação inicial",
  restricao: "Restrição reprodutiva",
};
export function FormReproducao({
  acao,
  painel,
  animalInicial,
  onFechar,
  onSalvo,
  onRegistrar,
  dataInicial,
  conteudoExtra,
  tipoExameInicial,
  finalidadeInicial,
  propriedadeId: propriedadeIdInformada,
  tentativaInicial,
}: {
  acao: AcaoReprodutiva;
  painel: PainelReprodutivo;
  animalInicial?: string;
  propriedadeId?: number;
  tentativaInicial?: { tipo: "IA" | "TE"; materialId: string; quantidade: number };
  onFechar: () => void;
  onSalvo: () => void;
  dataInicial?: string;
  conteudoExtra?: ReactNode;
  tipoExameInicial?: string;
  finalidadeInicial?: AvaliacaoInput["finalidade"];
  onRegistrar?: (
    input: TentativaInput | AvaliacaoInput | PartoInput,
  ) => Promise<void>;
}) {
  const propriedadeId = propriedadeIdInformada ?? getPropriedadeAtiva();
  const envio = useRef<{ payload: string; chave: string } | null>(null);
  const [animalId, setAnimalId] = useState(animalInicial ?? "");
  const [data, setData] = useState(dataInicial ?? hoje());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [materiais, setMateriais] = useState<MaterialGeneticoDTO[]>([]);
  const [touros, setTouros] = useState<AnimalResumo[]>([]);
  const [genitores, setGenitores] = useState<GenitorDTO[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [tipo, setTipo] = useState<string>(tentativaInicial?.tipo ?? "IA");
  const [origem, setOrigem] = useState("DOCUMENTADA");
  const [materialId, setMaterialId] = useState(tentativaInicial?.materialId ?? "");
  const [touro, setTouro] = useState("");
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [partidaId, setPartidaId] = useState("");
  const [cienciaValidade, setCienciaValidade] = useState(false);
  const [cienciaSanitaria, setCienciaSanitaria] = useState(false);
  const [cienciaVencida, setCienciaVencida] = useState(false);
  const [motivoVencida, setMotivoVencida] = useState("");
  const [motivoVinculo, setMotivoVinculo] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [quantidade, setQuantidade] = useState(String(tentativaInicial?.quantidade ?? 1));
  const [responsavel, setResponsavel] = useState("");
  const [resultado, setResultado] =
    useState<AvaliacaoInput["resultado"] | "">("");
  const [conduta, setConduta] = useState<AvaliacaoInput["conduta"] | null>(null);
  const [sexoFetal, setSexoFetal] = useState<"F" | "M" | "">("");
  const [finalidade, setFinalidade] = useState<AvaliacaoInput["finalidade"]>(finalidadeInicial ?? "DIAGNOSTICO");
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  const [tipoExameId, setTipoExameId] = useState(tipoExameInicial ?? "");
  const [resultados, setResultados] = useState<ObservacaoExame[]>([]);
  useEffect(() => {
    if (acao !== "avaliacao") return;
    let ativo = true;
    reqV4<TipoExame[]>("/reproducao/tipos-exame?incluirInativos=true", undefined, "GET", propriedadeId ?? undefined).then(tipos => { if (ativo) { setTiposExame(tipos); setTipoExameId(tipoExameInicial ?? tipos.find(t => t.ativo && t.padraoReprodutivo)?.id ?? tipos.find(t => t.ativo)?.id ?? ""); } }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [acao, tipoExameInicial, propriedadeId]);
  const tipoExame = tiposExame.find(t => t.id === tipoExameId);
  const [tentativaId, setTentativaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [retorno, setRetorno] = useState("");
  const [previsao, setPrevisao] = useState("");
  useEffect(() => setCienciaSanitaria(false), [animalId, data, tipo, conduta]);
  const [dadosParto, setDadosParto] = useState(dadosPartoVazios);
  const [crias, setCrias] = useState<CriaInput[]>([
    { viva: true, sexo: "F", aptidao: "LEITE" },
  ]);
  const [lactacao, setLactacao] = useState(false);
  const [situacao, setSituacao] = useState("VAZIA");
  const [aptaDesde, setAptaDesde] = useState("");
  const [restricaoAte, setRestricaoAte] = useState("");
  const [acoesRestritas, setAcoesRestritas] = useState([
    "IA",
    "TE",
    "COBERTURA",
    "IATF",
  ]);
  const [restricao, setRestricao] = useState("TEMPORARIA");
  const animal = painel.animais.find((a) => a.animalId === animalId);
  const gestacoesClinicas = [...(painel.gestacoes ?? []), ...(animal?.gestacao ? [{...animal.gestacao, animalId}] : [])];
  const tentativasClinicas = [...painel.tentativas, ...(animal?.ultimaTentativa && !painel.tentativas.some(t => t.id === animal.ultimaTentativa!.id) ? [{...animal.ultimaTentativa, animalId}] : [])];
  const gestacaoDoFato = gestacoesClinicas.find(g => g.animalId === animalId && g.status === "VALIDO" && (!g.confirmadaEm || g.confirmadaEm.slice(0,10) <= data) && (!g.encerradaEm || (acao === "avaliacao" && resultado === "NEGATIVO" ? g.encerradaEm.slice(0,10) > data : g.encerradaEm.slice(0,10) >= data)));
  const negativoBloqueado =
    acao === "avaliacao" && resultado === "NEGATIVO" && !!gestacaoDoFato;
  const exigeMotivo =
    acao === "restricao" ||
    (acao === "tentativa" && origem === "DOCUMENTADA") ||
    conduta === "DESCARTE" ||
    (acao === "avaliacao" && resultado === "NEGATIVO" && !!gestacaoDoFato);
  useEffect(() => {
    let ativo = true;
    Promise.all([
      listarMaterialGenetico({}, propriedadeId ?? undefined),
      listarGenitores({ sexo: "M" }, propriedadeId ?? undefined),
      listarLotes(undefined, propriedadeId ?? undefined),
      listarServicos(propriedadeId ?? undefined),
      listarAnimais({ sexo: "M", pageSize: 200 }, propriedadeId ?? undefined),
    ])
      .then(([m, g, l, s, t]) => {
        if (ativo) {
          setTouros(t.itens);
          setMateriais(m);
          setGenitores(g);
          setLotes(l);
          setServicos(s);
        }
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ativo = false;
    };
  }, [propriedadeId]);
  useEffect(() => {
    const produto = materiais.find((m) => m.id === materialId)?.produto.id;
    setPartidaId("");
    setPartidas([]);
    if (!produto || origem !== "ESTOQUE") return;
    let ativo = true;
    listarPartidasNutricionais(produto, propriedadeId)
      .then((p) => {
        if (ativo) setPartidas(p);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [materialId, materiais, origem, propriedadeId]);
  const campo = (
    id: string,
    rotulo: string,
    valor: string,
    setter: (s: string) => void,
    required = false,
    inputType = "text",
  ) => (
    <CampoFormulario id={`rep-${id}`} rotulo={rotulo} obrigatorio={required}>
      {(p) => (
        <input
          {...p}
          className={classeInput}
          value={valor}
          onChange={(e) => setter(e.target.value)}
          required={required}
          type={inputType}
          step={inputType === "number" ? "any" : undefined}
        />
      )}
    </CampoFormulario>
  );
  const seletor = (
    id: string,
    rotulo: string,
    valor: string,
    setter: (s: string) => void,
    opcoes: [string, string][],
    required = true,
  ) => (
    <CampoFormulario id={`rep-${id}`} rotulo={rotulo} obrigatorio={required}>
      {(p) => (
        <select
          {...p}
          className={classeInput}
          value={valor}
          onChange={(e) => setter(e.target.value)}
          required={required}
        >
          <option value="">Selecione</option>
          {opcoes.map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      )}
    </CampoFormulario>
  );
  async function salvar() {
    if (!propriedadeId) {
      setErro("Selecione um sítio para registrar o fato.");
      return;
    }
    if (negativoBloqueado) {
      setErro(
        "Registre a perda gestacional ou corrija o diagnóstico anterior antes do resultado negativo.",
      );
      return;
    }
    if (exigeMotivo && motivo.trim().length < 5) {
      setErro("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    if (acao === "avaliacao" && (!resultado || !tipoExameId || (finalidade === "SEXAGEM" && !sexoFetal))) { setErro("Informe o tipo de exame, a conclusão e o sexo fetal quando houver sexagem."); return; }
    if (acao === "parto") { const erroParto = validarDadosParto(dadosParto); if (erroParto) { setErro(erroParto); return; } }
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    const payload = JSON.stringify({acao, propriedadeId, animalId, data, tipo, origem, materialId, touro, partidaId, cienciaValidade, cienciaSanitaria, cienciaVencida, motivoVencida, servicoId, quantidade, responsavel, resultado, conduta, sexoFetal, finalidade, tipoExameId, resultados, tentativaId, motivo, anotacao, retorno, previsao, motivoVinculo, dadosParto, crias, lactacao, situacao, aptaDesde, restricaoAte, acoesRestritas, restricao});
    if (envio.current?.payload !== payload) envio.current = { payload, chave: crypto.randomUUID() };
    const base = { chave: envio.current.chave, propriedadeId, animalId, data };
    try {
      if (acao === "tentativa")
        await (onRegistrar ?? registrarTentativa)({
          ...base,
          tipo: tipo as "IA" | "TE" | "COBERTURA",
          origem: origem as "ESTOQUE" | "SERVICO" | "DOCUMENTADA",
          ...(materialId && tipo !== "COBERTURA" ? { materialId } : {}),
          ...(touro
            ? touro.startsWith("externo:")
              ? { touroExternoId: touro.slice(8) }
              : { touroId: touro }
            : {}),
          ...(origem === "ESTOQUE"
            ? {
                quantidade: Number(quantidade),
                partidaId: partidaId || undefined,
                cienciaValidadeDesconhecida: cienciaValidade,
                documentacaoExcepcional: cienciaVencida,
                motivoDocumentacaoExcepcional: motivoVencida || undefined,
              }
            : {}),
          cienciaSanitaria,
          ...(servicoId ? { operacaoServicoId: servicoId } : {}),
          ...(responsavel ? { responsavel } : {}),
          ...(motivo
            ? { justificativaSemOrigem: motivo, observacao: motivo }
            : {}),
        });
      if (acao === "avaliacao" && resultado)
        await (onRegistrar ?? registrarAvaliacao)({
          ...base,
          resultado, finalidade, tipoExameId, resultados, formatoExameHash: tipoExame?.formatoExameHash,
          cienciaSanitaria,
          conduta: conduta ?? undefined,
          ...(tentativaId ? { tentativaId } : {}),
          ...(gestacaoDoFato ? { gestacaoId: gestacaoDoFato.id } : {}),
          ...(sexoFetal && resultado !== "NAO_AVALIADO" ? { sexoFetal } : {}),
          ...(motivo ? { motivo } : {}),
          ...(anotacao ? { anotacaoOriginal: anotacao } : {}),
          ...(retorno ? { retornoEm: retorno } : {}),
          ...(previsao ? { previsaoParto: previsao } : {}),
          ...(resultado === "POSITIVO" && !tentativaId && !gestacaoDoFato
            ? { motivoVinculoDesconhecido: motivoVinculo }
            : {}),
        });
      if (acao === "parto")
        await (onRegistrar ?? registrarParto)({
          ...base,
          ...camposPartoPayload(dadosParto, data),
          ...(gestacaoDoFato ? { gestacaoId: gestacaoDoFato.id } : {}),
          crias: dadosParto.desfecho === "ABORTO" ? [] : crias,
          iniciarLactacao: lactacao,
        });
      if (acao === "situacao")
        await reqV4("/reproducao/situacoes-iniciais", {
          ...base,
          situacao,
          observacao: motivo || undefined,
          aptaDesde: aptaDesde || undefined,
        }, "POST", propriedadeId);
      if (acao === "restricao")
        await reqV4("/reproducao/restricoes", {
          ...base,
          tipo: restricao,
          motivo,
          acoes: acoesRestritas,
          ate: restricaoAte || undefined,
        }, "POST", propriedadeId);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <PainelCadastro
      aberto
      titulo={TITULOS[acao]}
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <>
          <Button secondary disabled={ocupado} onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-reproducao"
            disabled={ocupado || negativoBloqueado}
          >
            {ocupado ? "Salvando…" : "Confirmar registro"}
          </Button>
        </>
      }
    >
      <form
        id="form-reproducao"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        {conteudoExtra}
        <ErrorBox erro={erro} />
        {seletor(
          "animal",
          "Animal",
          animalId,
          setAnimalId,
          painel.animais.map((a) => [
            a.animalId,
            `${a.brinco} ${a.nome ?? ""}`,
          ]),
        )}
        {campo("data", "Data do fato", data, setData, true, "date")}
        {acao === "tentativa" && (
          <>
            {seletor(
              "tipo",
              "Procedimento",
              tipo,
              (v) => {
                setTipo(v);
                setMaterialId("");
              },
              [
                ["IA", "Inseminação artificial"],
                ["TE", "Transferência de embrião"],
                ["COBERTURA", "Cobertura"],
              ],
            )}
            {seletor("origem", "Origem", origem, setOrigem, [
              ["DOCUMENTADA", "Origem documentada"],
              ["ESTOQUE", "Estoque do sítio"],
              ["SERVICO", "Serviço associado"],
            ])}
            {tipo !== "COBERTURA" &&
              seletor(
                "material",
                "Material genético",
                materialId,
                setMaterialId,
                materiais
                  .filter(
                    (m) => m.tipo === (tipo === "TE" ? "EMBRIAO" : "SEMEN"),
                  )
                  .map((m) => [
                    m.id,
                    `${m.produto.nome} · saldo ${m.saldo ?? "não informado"}`,
                  ]),
                origem === "ESTOQUE",
              )}
            {tipo === "TE" && (
              <p className="text-sm text-ink-3">
                O animal selecionado é a receptora. A doadora do material mantém
                a filiação genética da cria.
              </p>
            )}
            {seletor(
              "touro",
              "Touro",
              touro,
              setTouro,
              [
                ...touros.map((a) => [a.id, a.brinco] as [string, string]),
                ...genitores.map(
                  (g) =>
                    [`externo:${g.id}`, `${g.nome} · externo`] as [
                      string,
                      string,
                    ],
                ),
              ],
              tipo === "COBERTURA",
            )}
            {origem === "ESTOQUE" && (
              <>
                {campo(
                  "quantidade",
                  "Quantidade consumida",
                  quantidade,
                  setQuantidade,
                  true,
                  "number",
                )}
                {partidas.length > 0 &&
                  seletor(
                    "partida",
                    "Lote do produto",
                    partidaId,
                    setPartidaId,
                    partidas.map((p) => [
                      p.id,
                      `${p.nome ?? p.codigo} · saldo ${p.saldo} · validade ${p.validade?.slice(0, 10) ?? "desconhecida"}`,
                    ]),
                    false,
                  )}
                {partidas.some((p) => p.id === partidaId && !p.validade) && (
                  <ConfirmacaoCiencia
                    id="rep-validade"
                    checked={cienciaValidade}
                    onChange={setCienciaValidade}
                  >
                    Estou ciente de que a validade do lote não foi informada.
                  </ConfirmacaoCiencia>
                )}
                {partidas.some(
                  (p) =>
                    p.id === partidaId &&
                    p.validade &&
                    p.validade.slice(0, 10) < data,
                ) && (
                  <>
                    <ConfirmacaoCiencia
                      id="rep-vencido"
                      checked={cienciaVencida}
                      onChange={setCienciaVencida}
                    >
                      Estou documentando um fato já ocorrido com lote vencido.
                    </ConfirmacaoCiencia>
                    {campo(
                      "motivo-vencido",
                      "Motivo do fato com lote vencido",
                      motivoVencida,
                      setMotivoVencida,
                      true,
                    )}
                  </>
                )}
              </>
            )}
            <AlertasSanitarios animalId={animalId} data={data} acao={tipo} propriedadeId={propriedadeId ?? undefined} />
            <ConfirmacaoCiencia
              id="rep-ciencia-sanitaria"
              checked={cienciaSanitaria}
              onChange={setCienciaSanitaria}
            >
              Estou ciente dos alertas sanitários configurados para esta
              intervenção.
            </ConfirmacaoCiencia>
            {origem === "SERVICO" &&
              seletor(
                "servico",
                "Serviço financeiro",
                servicoId,
                setServicoId,
                servicos.map((s) => [
                  s.id,
                  `#${s.numero} ${s.descricao ?? "Serviço"}`,
                ]),
              )}
            {campo("responsavel", "Responsável", responsavel, setResponsavel)}
          </>
        )}
        {acao === "avaliacao" && (
          <>
            {seletor("tipo-exame", "Tipo de exame", tipoExameId, v => { setTipoExameId(v); setResultados([]); }, tiposExame.filter(t => t.ativo || t.id === tipoExameId).map(t => [t.id, `${t.nome} · v${t.versaoFormato ?? 1}${t.ativo ? "" : " (inativo)"}`]))}
            {!tiposExame.length && <p role="status">Nenhum tipo de exame disponível. Confira os cadastros de Reprodução.</p>}
            <CamposAvaliacao dados={{ resultado, finalidade, sexoFetal, conduta }} onChange={mudanca => {
              if (mudanca.resultado !== undefined) setResultado(mudanca.resultado as AvaliacaoInput["resultado"] | "");
              if (mudanca.finalidade !== undefined) setFinalidade(mudanca.finalidade as AvaliacaoInput["finalidade"]);
              if (mudanca.sexoFetal !== undefined) setSexoFetal((mudanca.sexoFetal ?? "") as "F" | "M" | "");
              if (mudanca.conduta !== undefined) setConduta(mudanca.conduta as AvaliacaoInput["conduta"]);
            }} />
            {tipoExame?.campos?.some(c => !["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo)) && resultado !== "NAO_AVALIADO" && <CamposResultadoExame campos={tipoExame.campos.filter(c => !["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))} valores={resultados} onChange={setResultados} />}
            {seletor(
              "tentativa",
              "Tentativa relacionada",
              tentativaId,
              setTentativaId,
              tentativasClinicas
                .filter((t) => t.animalId === animalId)
                .map((t) => [t.id, `${t.data.slice(0, 10)} · ${t.tipo}`]),
              false,
            )}
            {resultado === "POSITIVO" &&
              !tentativaId &&
              !gestacaoDoFato &&
              campo(
                "vinculo-desconhecido",
                "Motivo da tentativa não comprovada",
                motivoVinculo,
                setMotivoVinculo,
                true,
              )}
            {conduta === "IATF" && (
              <p className="text-sm text-ink-3">
                Esta indicação não inicia protocolo nem confirma aplicação ou
                inseminação.
              </p>
            )}
            {conduta === "DESCARTE" && (
              <p className="text-sm text-ink-3">
                Restringe a reprodução. A vaca permanece cadastrada; não há
                baixa ou secagem automática.
              </p>
            )}
            {exigeMotivo && (
              <p className="text-sm text-ink-3">
                O negativo após diagnóstico positivo exige registrar a perda
                gestacional ou corrigir o diagnóstico anterior antes de
                confirmar.
              </p>
            )}
            {campo("anotacao", "Anotação original", anotacao, setAnotacao)}
            {campo(
              "retorno",
              "Retorno previsto",
              retorno,
              setRetorno,
              false,
              "date",
            )}
            {campo(
              "previsao",
              "Previsão de parto informada",
              previsao,
              setPrevisao,
              false,
              "date",
            )}
          </>
        )}
        {acao === "avaliacao" && conduta === "IATF" && (
          <>
          <AlertasSanitarios animalId={animalId} data={data} acao="IATF" propriedadeId={propriedadeId ?? undefined} />
          <ConfirmacaoCiencia id="rep-ciencia-indicacao" checked={cienciaSanitaria} onChange={setCienciaSanitaria}>
            Revisei os alertas sanitários configurados para indicar IATF.
          </ConfirmacaoCiencia>
          </>
        )}
        {acao === "parto" && <PartoCampos valor={dadosParto} onChange={setDadosParto} crias={crias} setCrias={setCrias} lotes={lotes} lactacao={lactacao} setLactacao={setLactacao} animalId={animalId} propriedadeId={propriedadeId ?? undefined} />}
        {acao === "situacao" &&
          seletor("situacao", "Situação inicial", situacao, setSituacao, [
            ["VAZIA", "Vazia"],
            ["DESCONHECIDA", "Desconhecida"],
            ["APTA", "Apta"],
          ])}
        {acao === "situacao" &&
          situacao === "APTA" &&
          campo(
            "apta-desde",
            "Apta desde",
            aptaDesde,
            setAptaDesde,
            false,
            "date",
          )}
        {acao === "restricao" && (
          <>
            {" "}
            {campo(
              "restricao-ate",
              "Até (opcional)",
              restricaoAte,
              setRestricaoAte,
              false,
              "date",
            )}
            <fieldset>
              <legend className="text-sm">Intervenções restringidas</legend>
              <div className="flex flex-wrap gap-3 mt-2">
                {["IA", "TE", "COBERTURA", "IATF"].map((a) => (
                  <label key={a} className="text-sm">
                    <input
                      type="checkbox"
                      checked={acoesRestritas.includes(a)}
                      onChange={(e) =>
                        setAcoesRestritas(
                          e.target.checked
                            ? [...acoesRestritas, a]
                            : acoesRestritas.filter((v) => v !== a),
                        )
                      }
                    />{" "}
                    {a}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {acao === "restricao" &&
          seletor("restricao", "Restrição", restricao, setRestricao, [
            ["TEMPORARIA", "Temporária"],
            ["PERMANENTE", "Permanente"],
            ["DESCARTE", "Descarte reprodutivo"],
          ])}
        {acao !== "parto" && campo("motivo", "Motivo / observação", motivo, setMotivo, exigeMotivo)}
      </form>
    </PainelCadastro>
  );
}
