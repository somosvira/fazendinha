import { useEffect, useState, type ReactNode } from "react";
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
}: {
  acao: AcaoReprodutiva;
  painel: PainelReprodutivo;
  animalInicial?: string;
  onFechar: () => void;
  onSalvo: () => void;
  dataInicial?: string;
  conteudoExtra?: ReactNode;
  onRegistrar?: (
    input: TentativaInput | AvaliacaoInput | PartoInput,
  ) => Promise<void>;
}) {
  const [chave] = useState(() => crypto.randomUUID());
  const [animalId, setAnimalId] = useState(animalInicial ?? "");
  const [data, setData] = useState(dataInicial ?? hoje());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [materiais, setMateriais] = useState<MaterialGeneticoDTO[]>([]);
  const [touros, setTouros] = useState<AnimalResumo[]>([]);
  const [genitores, setGenitores] = useState<GenitorDTO[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [tipo, setTipo] = useState("IA");
  const [origem, setOrigem] = useState("DOCUMENTADA");
  const [materialId, setMaterialId] = useState("");
  const [touro, setTouro] = useState("");
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [partidaId, setPartidaId] = useState("");
  const [cienciaValidade, setCienciaValidade] = useState(false);
  const [cienciaSanitaria, setCienciaSanitaria] = useState(false);
  const [cienciaVencida, setCienciaVencida] = useState(false);
  const [motivoVencida, setMotivoVencida] = useState("");
  const [motivoVinculo, setMotivoVinculo] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [responsavel, setResponsavel] = useState("");
  const [resultado, setResultado] =
    useState<AvaliacaoInput["resultado"]>("NAO_AVALIADO");
  const [conduta, setConduta] = useState<AvaliacaoInput["conduta"]>("AGUARDAR");
  const [sexoFetal, setSexoFetal] = useState<"F" | "M">("F");
  const [tentativaId, setTentativaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [retorno, setRetorno] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [tipoParto, setTipoParto] = useState<
    "NORMAL" | "DISTOCICO" | "ABORTO" | "NATIMORTO"
  >("NORMAL");
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
  const gestacaoDoFato = painel.gestacoes
    ? painel.gestacoes.find(
        (g) =>
          g.animalId === animalId &&
          g.status === "VALIDO" &&
          (!g.confirmadaEm || g.confirmadaEm.slice(0, 10) <= data) &&
          (!g.encerradaEm || g.encerradaEm.slice(0, 10) >= data),
      )
    : animal?.gestacao;
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
      listarMaterialGenetico(),
      listarGenitores({ sexo: "M" }),
      listarLotes(),
      listarServicos(getPropriedadeAtiva() ?? undefined),
      listarAnimais({ sexo: "M", pageSize: 200 }),
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
  }, []);
  useEffect(() => {
    const produto = materiais.find((m) => m.id === materialId)?.produto.id;
    setPartidaId("");
    setPartidas([]);
    if (!produto || origem !== "ESTOQUE") return;
    let ativo = true;
    listarPartidasNutricionais(produto, getPropriedadeAtiva())
      .then((p) => {
        if (ativo) setPartidas(p);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [materialId, materiais, origem]);
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
    const propriedadeId = getPropriedadeAtiva();
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
    setOcupado(true);
    setErro(null);
    const base = { chave, propriedadeId, animalId, data };
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
      if (acao === "avaliacao")
        await (onRegistrar ?? registrarAvaliacao)({
          ...base,
          resultado,
          conduta,
          ...(tentativaId ? { tentativaId } : {}),
          ...(gestacaoDoFato ? { gestacaoId: gestacaoDoFato.id } : {}),
          ...(resultado === "SEXAGEM" ? { sexoFetal } : {}),
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
          tipo: tipoParto,
          ...(gestacaoDoFato ? { gestacaoId: gestacaoDoFato.id } : {}),
          crias:
            tipoParto === "ABORTO"
              ? []
              : crias.map((c) => ({
                  ...c,
                  viva: tipoParto === "NATIMORTO" ? false : c.viva,
                })),
          iniciarLactacao: lactacao,
        });
      if (acao === "situacao")
        await reqV4("/reproducao/situacoes-iniciais", {
          ...base,
          situacao,
          observacao: motivo || undefined,
          aptaDesde: aptaDesde || undefined,
        });
      if (acao === "restricao")
        await reqV4("/reproducao/restricoes", {
          ...base,
          tipo: restricao,
          motivo,
          acoes: acoesRestritas,
          ate: restricaoAte || undefined,
        });
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
            {seletor(
              "resultado",
              "Resultado",
              resultado,
              (v) => setResultado(v as AvaliacaoInput["resultado"]),
              [
                ["NAO_AVALIADO", "Não avaliado"],
                ["POSITIVO", "P+ · confirmação de gestação"],
                ["RECONFIRMACAO", "OK · reconfirmação da mesma gestação"],
                ["SEXAGEM", "Sexagem fetal"],
                ["NEGATIVO", "Negativo"],
                ["INCONCLUSIVO", "Inconclusivo"],
              ],
            )}
            {seletor(
              "tentativa",
              "Tentativa relacionada",
              tentativaId,
              setTentativaId,
              painel.tentativas
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
            {resultado === "SEXAGEM" &&
              seletor(
                "sexo",
                "Sexo fetal",
                sexoFetal,
                (v) => setSexoFetal(v as "F" | "M"),
                [
                  ["F", "Fêmea"],
                  ["M", "Macho"],
                ],
              )}
            {seletor(
              "conduta",
              "Conduta",
              conduta ?? "AGUARDAR",
              (v) => setConduta(v as AvaliacaoInput["conduta"]),
              [
                ["AGUARDAR", "Aguardar"],
                ["IATF", "Indicar IATF"],
                ["DESCARTE", "Descarte reprodutivo"],
              ],
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
        {acao === "parto" && (
          <>
            {seletor(
              "tipo-parto",
              "Tipo de parto",
              tipoParto,
              (v) => setTipoParto(v as typeof tipoParto),
              [
                ["NORMAL", "Normal"],
                ["DISTOCICO", "Distócico"],
                ["ABORTO", "Aborto"],
                ["NATIMORTO", "Natimorto"],
              ],
            )}
            {tipoParto === "ABORTO" ? (
              <p className="text-sm">
                O aborto conta como parto, encerra a gestação e reinicia o ciclo
                reprodutivo.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-3">
                  Cada cria viva recebe um cadastro provisório utilizável.
                  Brinco e peso podem ser completados depois.
                </p>
                {crias.map((c, i) => (
                  <fieldset
                    className="rounded-lg border border-border p-4 grid gap-3"
                    key={i}
                  >
                    <legend>Cria {i + 1}</legend>
                    <label className="text-sm">
                      <input
                        type="checkbox"
                        checked={c.viva && tipoParto !== "NATIMORTO"}
                        disabled={tipoParto === "NATIMORTO"}
                        onChange={(e) =>
                          setCrias(
                            crias.map((v, j) =>
                              j === i ? { ...v, viva: e.target.checked } : v,
                            ),
                          )
                        }
                      />{" "}
                      Nascida viva
                    </label>
                    {seletor(
                      `cria-sexo-${i}`,
                      "Sexo da cria",
                      c.sexo,
                      (v) =>
                        setCrias(
                          crias.map((x, j) =>
                            j === i ? { ...x, sexo: v as "F" | "M" } : x,
                          ),
                        ),
                      [
                        ["F", "Fêmea"],
                        ["M", "Macho"],
                      ],
                    )}
                    {seletor(
                      `cria-aptidao-${i}`,
                      "Aptidão",
                      c.aptidao,
                      (v) =>
                        setCrias(
                          crias.map((x, j) =>
                            j === i
                              ? { ...x, aptidao: v as CriaInput["aptidao"] }
                              : x,
                          ),
                        ),
                      [
                        ["LEITE", "Leite"],
                        ["CORTE", "Corte"],
                      ],
                    )}
                    {campo(
                      `cria-brinco-${i}`,
                      "Brinco (pode ficar pendente)",
                      c.brinco ?? "",
                      (v) =>
                        setCrias(
                          crias.map((x, j) =>
                            j === i ? { ...x, brinco: v || undefined } : x,
                          ),
                        ),
                    )}
                    {seletor(
                      `cria-lote-${i}`,
                      "Lote da cria",
                      c.loteId ?? "",
                      (v) =>
                        setCrias(
                          crias.map((x, j) =>
                            j === i ? { ...x, loteId: v || undefined } : x,
                          ),
                        ),
                      lotes.map((l) => [l.id, l.nome]),
                      false,
                    )}
                    {crias.length > 1 && (
                      <Button
                        secondary
                        type="button"
                        onClick={() =>
                          setCrias(crias.filter((_, j) => j !== i))
                        }
                      >
                        Remover cria {i + 1}
                      </Button>
                    )}
                  </fieldset>
                ))}
                <Button
                  secondary
                  type="button"
                  onClick={() =>
                    setCrias([
                      ...crias,
                      { viva: true, sexo: "F", aptidao: "LEITE" },
                    ])
                  }
                >
                  + Adicionar cria
                </Button>
              </>
            )}
            <label className="text-sm">
              <input
                type="checkbox"
                checked={lactacao}
                onChange={(e) => setLactacao(e.target.checked)}
              />{" "}
              Registrar início de lactação
            </label>
          </>
        )}
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
        {campo("motivo", "Motivo / observação", motivo, setMotivo, exigeMotivo)}
      </form>
    </PainelCadastro>
  );
}
