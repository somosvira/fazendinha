import { SelecaoPartidas, type DistribuicaoPartida } from "../../estoque/SelecaoPartidas";
import { useEffect, useMemo, useState } from "react";
import type { Talhao, TipoOperacao, PragaDoenca } from "../types";
import { registrarOperacao, type OperacaoInput } from "../api";
import { useToast } from "@/components/Toast";
import { useProdutosEstoque, listarCentrosCusto, type RefDTO } from "../../estoque/api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { UNIDADES_ORDENADAS, converterQuantidade, rotuloUnidade, type UnidadeMedida } from "../../lib/unidades";

const DOMINIOS: { v: "fenologia" | "fitossanidade" | "nutricao" | "colheita"; label: string }[] = [
  { v: "fitossanidade", label: "Fitossanidade" },
  { v: "nutricao", label: "Nutrição / Solo" },
  { v: "fenologia", label: "Fenologia" },
  { v: "colheita", label: "Colheita" },
];

const OP_FITO: { v: TipoOperacao; label: string }[] = [
  { v: "APLICACAO_FUNGICIDA", label: "Aplicação de fungicida" },
  { v: "APLICACAO_INSETICIDA", label: "Aplicação de inseticida" },
  { v: "APLICACAO_HERBICIDA", label: "Aplicação de herbicida" },
  { v: "ROCAGEM_MECANICA", label: "Roçagem mecânica" },
  { v: "CAPINA_MANUAL", label: "Capina manual" },
  { v: "MONITORAMENTO_MIP", label: "Inspeção MIP" },
];

const OP_NUT: { v: TipoOperacao; label: string }[] = [
  { v: "ADUBACAO_SOLO", label: "Adubação de solo (parcelada)" },
  { v: "ADUBACAO_FOLIAR", label: "Adubação foliar" },
  { v: "CALAGEM", label: "Calagem" },
  { v: "GESSAGEM", label: "Gessagem" },
  { v: "AMOSTRAGEM_SOLO", label: "Amostragem de solo" },
  { v: "AMOSTRAGEM_FOLIAR", label: "Amostragem foliar" },
];

const OP_FEN: { v: TipoOperacao; label: string }[] = [
  { v: "PODA_RECEPA", label: "Poda — Recepa (baixa, 30-40 cm)" },
  { v: "PODA_DECOTE", label: "Poda — Decote (1,80-2,40 m)" },
  { v: "PODA_ESQUELETAMENTO", label: "Poda — Esqueletamento" },
  { v: "PODA_DESPONTE", label: "Poda — Desponte" },
  { v: "DESBROTA", label: "Desbrota" },
  { v: "IRRIGACAO", label: "Irrigação" },
  { v: "REPLANTIO", label: "Replantio (falhas)" },
];

const PRAGAS: { v: PragaDoenca; label: string }[] = [
  { v: "FERRUGEM", label: "Ferrugem (Hemileia vastatrix)" },
  { v: "CERCOSPORIOSE", label: "Cercosporiose" },
  { v: "BICHO_MINEIRO", label: "Bicho-mineiro" },
  { v: "BROCA_DO_CAFE", label: "Broca do café" },
  { v: "ACARO_VERMELHO", label: "Ácaro vermelho" },
  { v: "NEMATOIDES", label: "Nematoides" },
  { v: "ANTRACNOSE", label: "Antracnose" },
  { v: "MANCHA_AUREOLADA", label: "Mancha aureolada" },
  { v: "FUMAGINA", label: "Fumagina" },
  { v: "COCHONILHAS", label: "Cochonilhas" },
  { v: "ROSELINIA", label: "Roselínia" },
  { v: "OUTRA", label: "Outra" },
];

export function OperacaoForm({ talhaoId, talhao, dominioFixo, onFechar, onSalvo }: {
  talhaoId: string;
  talhao?: Talhao;
  dominioFixo?: "fenologia" | "fitossanidade" | "nutricao" | "colheita";
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [dominio, setDominio] = useState<"fenologia" | "fitossanidade" | "nutricao" | "colheita">(dominioFixo ?? "fitossanidade");
  const [tipo, setTipo] = useState<TipoOperacao>(OP_FITO[0].v);
  const [data, setData] = useState(HOJE);
  const [praga, setPraga] = useState<PragaDoenca>("FERRUGEM");
  const [produto, setProduto] = useState("");
  const [partidas, setPartidas] = useState<DistribuicaoPartida[]>([]);
  const [produtoId, setProdutoId] = useState<string>("");
  const [quantidadeTotal, setQuantidadeTotal] = useState("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [doseValor, setDoseValor] = useState("");
  const [doseUnidadeMedida, setDoseUnidadeMedida] = useState<UnidadeMedida>("ML");
  // Enquanto o usuário não mexe na unidade da dose, ela segue a unidade do
  // produto do estoque escolhido (ver `selecionarProduto`) — evita começar
  // sempre em mL para produtos que não são líquidos (ex.: kg, sc, un).
  const [doseUnidadeTocada, setDoseUnidadeTocada] = useState(false);
  const [dosePorHectare, setDosePorHectare] = useState(true);
  const [volumeCalda, setVolumeCalda] = useState("");
  const [incidencia, setIncidencia] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const [erro, setErro] = useState<string | null>(null);

  // Litros de cereja (colheita)
  const [litrosCereja, setLitrosCereja] = useState("");
  const [rendimentoLsc, setRendimentoLsc] = useState("480");
  const [metodoColheita, setMetodoColheita] = useState<"DERRIÇA_PANO" | "DERRIÇA_MECANIZADA" | "SELETIVA" | "VARRIÇÃO">("DERRIÇA_PANO");

  // NPK (adubação)
  const [nKg, setNKg] = useState("");
  const [pKg, setPKg] = useState("");
  const [kKg, setKKg] = useState("");

  // Baixa de estoque — produto do estoque opcional, com estimativa dose × área.
  const { data: produtos } = useProdutosEstoque({ ativo: true, uso: "agricola" });
  // Produtos de uso agrícola (categoria). A baixa só acontece se o produto tiver
  // estoque no sítio do talhão — decisão do servidor, não do cadastro.
  const produtosAgricolas = useMemo(
    () => produtos.filter((p) => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [produtos],
  );
  const [centrosCusto, setCentrosCusto] = useState<RefDTO[]>([]);
  const [erroCentrosCusto, setErroCentrosCusto] = useState<string | null>(null);
  useEffect(() => { listarCentrosCusto().then((cs) => { setCentrosCusto(cs); setErroCentrosCusto(null); }).catch((e) => setErroCentrosCusto(e instanceof Error ? e.message : String(e))); }, []);
  const produtoSelecionado = produtosAgricolas.find((p) => String(p.id) === produtoId);

  const baixaEstimada = (() => {
    if (!produtoSelecionado) return null;
    const valorNumerico = Number(doseValor.replace(",", "."));
    if (!doseValor.trim() || !Number.isFinite(valorNumerico)) return null;
    const bruta = dosePorHectare ? valorNumerico * (talhao?.areaHa ?? 0) : valorNumerico;
    try {
      const valor = converterQuantidade(bruta, doseUnidadeMedida, produtoSelecionado.unidade);
      return { valor, unidade: rotuloUnidade(produtoSelecionado.unidade), erro: null as string | null };
    } catch {
      return {
        valor: null as number | null,
        unidade: rotuloUnidade(produtoSelecionado.unidade),
        erro: `A dose em ${rotuloUnidade(doseUnidadeMedida)} não pode ser convertida para ${rotuloUnidade(produtoSelecionado.unidade)} — escolha a unidade do produto ou informe a quantidade total`,
      };
    }
  })();

  function selecionarProduto(id: string) {
    setProdutoId(id);
    const p = produtosAgricolas.find((x) => String(x.id) === id);
    if (p) {
      if (!produto.trim()) setProduto(p.nome);
      setCentroCustoId((p.centroCustoIds ?? []).length === 1 ? String((p.centroCustoIds ?? [])[0]) : "");
      if (!doseUnidadeTocada) setDoseUnidadeMedida(p.unidade);
    } else {
      setCentroCustoId("");
    }
  }

  const opcoesTipo = dominio === "fitossanidade" ? OP_FITO
    : dominio === "nutricao" ? OP_NUT
    : dominio === "fenologia" ? OP_FEN
    : ([{ v: "ADUBACAO_SOLO" as TipoOperacao, label: "Colheita registrada na aba dedicada" }]);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      // Detalhes específicos do domínio que não cabem no body canônico do backend
      // (NPK, calda, incidência, colheita) viram notas no campo observação, pra não
      // se perder até existir endpoint dedicado.
      const extras: string[] = [];
      if (dominio === "fitossanidade") {
        if (volumeCalda) extras.push(`Calda ${volumeCalda} L/ha`);
        if (incidencia) extras.push(`Incidência ${incidencia}%`);
      }
      if (dominio === "nutricao" && (tipo === "ADUBACAO_SOLO" || tipo === "ADUBACAO_FOLIAR")) {
        const npk = [nKg && `N ${nKg}`, pKg && `P₂O₅ ${pKg}`, kKg && `K₂O ${kKg}`].filter(Boolean);
        if (npk.length) extras.push(`${npk.join(" · ")} (kg/ha)`);
      }
      if (dominio === "colheita") {
        if (litrosCereja) extras.push(`${litrosCereja} L de cereja (${metodoColheita.replace("_", " ").toLowerCase()})`);
        if (litrosCereja && rendimentoLsc) extras.push(`≈ ${(Number(litrosCereja) / Number(rendimentoLsc)).toFixed(1)} sc · rend. ${rendimentoLsc} L/sc`);
      }
      const obs = [observacao.trim(), ...extras].filter(Boolean).join(" — ") || undefined;

      const doseValorNumerico = doseValor.trim() ? Number(doseValor.replace(",", ".")) : undefined;
      const salvo = await registrarOperacao(talhaoId, {
        // backend espera o enum em maiúsculas (FENOLOGIA/FITOSSANIDADE/NUTRICAO/COLHEITA)
        dominio: dominio.toUpperCase() as OperacaoInput["dominio"], tipo, data,
        responsavel: responsavel.trim() || undefined,
        produto: produto.trim() || undefined,
        observacao: obs,
        doseValor: doseValorNumerico != null && Number.isFinite(doseValorNumerico) ? doseValorNumerico : undefined,
        doseUnidadeMedida: doseValorNumerico != null ? doseUnidadeMedida : undefined,
        dosePorHectare: doseValorNumerico != null ? dosePorHectare : undefined,
        pragaAlvo: dominio === "fitossanidade" ? praga : undefined,
        produtoId: produtoId || null,
        ...(produtoSelecionado?.rastrearPartidas ? { partidas: partidas.map((p) => ({ partidaId: p.partidaId!, quantidade: Number(p.quantidade) })) } : {}),
        quantidadeTotal: quantidadeTotal.trim() ? Number(quantidadeTotal.replace(",", ".")) : null,
        centroCustoId: centroCustoId || null,
      });
      if (salvo?.aviso) toast.warn("Aplicação registrada sem baixa de estoque", salvo.aviso);
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar.");
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title={`Registrar operação${talhao ? ` — ${talhao.codigo}` : ""}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <>
          {/* Segmented domain selector — espelha o do EventoForm do rebanho. */}
          {!dominioFixo && (
            <div className="mb-[18px] flex gap-1.5">
              {DOMINIOS.map((d) => (
                <RebButton key={d.v} aria-pressed={dominio === d.v} onClick={() => { setDominio(d.v); setTipo((d.v === "fitossanidade" ? OP_FITO : d.v === "nutricao" ? OP_NUT : OP_FEN)[0].v); }}>
                  {d.label}
                </RebButton>
              ))}
            </div>
          )}

          <RebField label="Tipo de operação">
            <select className="rb-field-select" value={tipo} onChange={(e) => setTipo(e.target.value as TipoOperacao)}>
              {opcoesTipo.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </RebField>

          <RebField label="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </RebField>

          {/* Fitossanidade — praga + produto + calda + incidência observada */}
          {dominio === "fitossanidade" && (
            <>
              <RebField label="Praga/doença alvo">
                <select className="rb-field-select" value={praga} onChange={(e) => setPraga(e.target.value as PragaDoenca)}>
                  {PRAGAS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </RebField>
              {tipo !== "MONITORAMENTO_MIP" && (
                <>
                  <RebField label="Produto / princípio ativo">
                    <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: Ciproconazol + Trifloxistrobina" />
                  </RebField>
                  <RebField label="Dose">
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="number" step="0.001" min="0" style={{ width: 100 }} value={doseValor} onChange={(e) => setDoseValor(e.target.value)} placeholder="Ex.: 600" />
                      <select aria-label="Unidade da dose" className="rb-field-select" value={doseUnidadeMedida} onChange={(e) => { setDoseUnidadeMedida(e.target.value as UnidadeMedida); setDoseUnidadeTocada(true); }}>
                        {UNIDADES_ORDENADAS.map((u) => <option key={u} value={u}>{rotuloUnidade(u)}</option>)}
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                        <input type="checkbox" checked={dosePorHectare} onChange={(e) => setDosePorHectare(e.target.checked)} /> por hectare
                      </label>
                    </div>
                  </RebField>
                  <RebField label="Volume de calda (L/ha)">
                    <input type="number" value={volumeCalda} onChange={(e) => setVolumeCalda(e.target.value)} placeholder="Ex.: 500" />
                  </RebField>
                </>
              )}
              <RebField label="Incidência observada (%)">
                <input type="number" step="0.1" value={incidencia} onChange={(e) => setIncidencia(e.target.value)} placeholder="Folhas/frutos amostrados" />
              </RebField>
            </>
          )}

          {/* Nutrição — NPK em kg/ha */}
          {dominio === "nutricao" && (tipo === "ADUBACAO_SOLO" || tipo === "ADUBACAO_FOLIAR") && (
            <>
              <RebField label="Produto / formulado">
                <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: 20-00-20 ou Sulfato de amônio" />
              </RebField>
              <div style={{ display: "flex", gap: 10 }}>
                <RebField label="N (kg/ha)" style={{ flex: 1 }}>
                  <input type="number" value={nKg} onChange={(e) => setNKg(e.target.value)} />
                </RebField>
                <RebField label="P₂O₅ (kg/ha)" style={{ flex: 1 }}>
                  <input type="number" value={pKg} onChange={(e) => setPKg(e.target.value)} />
                </RebField>
                <RebField label="K₂O (kg/ha)" style={{ flex: 1 }}>
                  <input type="number" value={kKg} onChange={(e) => setKKg(e.target.value)} />
                </RebField>
              </div>
            </>
          )}
          {dominio === "nutricao" && (tipo === "CALAGEM" || tipo === "GESSAGEM") && (
            <>
              <RebField label="Produto">
                <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder={tipo === "CALAGEM" ? "Ex.: Calcário dolomítico PRNT 85%" : "Ex.: Gesso agrícola"} />
              </RebField>
              <RebField label="Dose">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" step="0.001" min="0" style={{ width: 100 }} value={doseValor} onChange={(e) => setDoseValor(e.target.value)} placeholder="Ex.: 2,5" />
                  <select aria-label="Unidade da dose" className="rb-field-select" value={doseUnidadeMedida} onChange={(e) => { setDoseUnidadeMedida(e.target.value as UnidadeMedida); setDoseUnidadeTocada(true); }}>
                    {UNIDADES_ORDENADAS.map((u) => <option key={u} value={u}>{rotuloUnidade(u)}</option>)}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    <input type="checkbox" checked={dosePorHectare} onChange={(e) => setDosePorHectare(e.target.checked)} /> por hectare
                  </label>
                </div>
              </RebField>
            </>
          )}

          {/* Colheita — litros + rendimento + método */}
          {dominio === "colheita" && (
            <>
              <RebField label="Método">
                <select className="rb-field-select" value={metodoColheita} onChange={(e) => setMetodoColheita(e.target.value as any)}>
                  <option value="DERRIÇA_PANO">Derriça no pano</option>
                  <option value="DERRIÇA_MECANIZADA">Derriça mecanizada</option>
                  <option value="SELETIVA">Seletiva (catação)</option>
                  <option value="VARRIÇÃO">Varrição</option>
                </select>
              </RebField>
              <RebField label="Litros de cereja colhidos">
                <input type="number" value={litrosCereja} onChange={(e) => setLitrosCereja(e.target.value)} placeholder="Medido no campo" />
              </RebField>
              <RebField label="Rendimento (L/saca)">
                <input type="number" value={rendimentoLsc} onChange={(e) => setRendimentoLsc(e.target.value)} placeholder="Típico 480–520" />
              </RebField>
              {litrosCereja && rendimentoLsc && (
                <p className="text-sm text-ink-3">
                  Saída estimada: <b>{(Number(litrosCereja) / Number(rendimentoLsc)).toFixed(1)} sc</b> beneficiadas.
                </p>
              )}
            </>
          )}

          {/* Baixa de estoque — opcional; liga o texto livre "produto" a um produto
              cadastrado; a saída de estoque só é gerada se ele tiver estoque no sítio. */}
          {(dominio === "fitossanidade" && tipo !== "MONITORAMENTO_MIP") ||
          (dominio === "nutricao" && (tipo === "ADUBACAO_SOLO" || tipo === "ADUBACAO_FOLIAR" || tipo === "CALAGEM" || tipo === "GESSAGEM")) ? (
            <>
              <RebField label="Produto do estoque">
                <select className="rb-field-select" value={produtoId} onChange={(e) => { setPartidas([]); selecionarProduto(e.target.value); }}>
                  <option value="">— sem baixa de estoque —</option>
                  {produtosAgricolas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </RebField>
              <p className="-mt-2.5 text-xs text-ink-3">Só produtos de categorias marcadas como uso agrícola aparecem aqui (Configurações → Categorias).</p>
              {produtoSelecionado && (
                <>
                  {baixaEstimada && baixaEstimada.erro && (
                    <p className="text-sm text-prejuizo">{baixaEstimada.erro}</p>
                  )}
                  {baixaEstimada && baixaEstimada.valor != null && (
                    <p className="text-sm text-ink-3">
                      Baixa estimada: <b>{baixaEstimada.valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {baixaEstimada.unidade}</b>
                    </p>
                  )}
                  {produtoSelecionado.rastrearPartidas && <SelecaoPartidas produtoId={produtoId} saida valor={partidas} onChange={setPartidas} />}
                  <RebField label="Quantidade total (sobrescreve a estimativa)">
                    <input type="number" value={quantidadeTotal} onChange={(e) => setQuantidadeTotal(e.target.value)} placeholder={baixaEstimada?.valor != null ? String(baixaEstimada.valor) : "Ex.: 120"} />
                  </RebField>
                  <RebField label="Centro de custo">
                    <select className="rb-field-select" value={centroCustoId} onChange={(e) => setCentroCustoId(e.target.value)}>
                      <option value="">— usar o centro do produto —</option>
                      {centrosCusto.map((cc) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                    </select>
                  </RebField>
                  <p className="text-sm text-ink-3">Se vazio, usa o único centro do produto (se houver).</p>
                  {erroCentrosCusto && <p className="text-sm text-prejuizo">Erro ao carregar centros de custo: {erroCentrosCusto}</p>}
                </>
              )}
            </>
          ) : null}

          <RebField label="Responsável">
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem executou" />
          </RebField>

          <RebField label="Observação">
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
          </RebField>

          {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
