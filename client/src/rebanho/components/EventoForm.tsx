import { useEffect, useMemo, useRef, useState } from "react";
import { registrarEvento, registrarEventoSanidade, editarEventoSanidade, listarRacas, listarAnimais, listarEmbrioesDisponiveis, listarParametros, obterAnimal, useProdutos, useResultadosGinecologicos, type EventoPayload, type EventoRegistrado, type EventoSanidadePayload, type RacaDTO, type EmbriaoDisponivelDTO } from "../api";
import { camposExameGinecologico, camposInseminacao, camposParto, camposTransferenciaEmbriao } from "./EventoForm.payload";
import { ESPECIE_POR_CATEGORIA, type Animal, type EventoTimeline } from "../types";
import { FRACOES, complementoLabel, montarRacaDisplay } from "../lib/sangue";
import { BaixaEstoqueCard } from "./BaixaEstoqueCard";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { RebFieldset, REB_SANGUE_ROW, REB_SANGUE_RACA, REB_SANGUE_INPUT, REB_SANGUE_FRAC_COMP } from "@/components/rb/RebPrimitives";
import { rotuloAnimal } from "./AnimalIdentity";

const TIPOS: { v: EventoPayload["tipo"]; label: string }[] = [
  { v: "CIO", label: "Cio" }, { v: "INSEMINACAO", label: "Inseminação" }, { v: "COBERTURA", label: "Cobertura (monta natural)" }, { v: "TRANSFERENCIA_EMBRIAO", label: "Transferência de embrião" }, { v: "DIAGNOSTICO", label: "Diagnóstico" }, { v: "PARTO", label: "Parto" }, { v: "SECAGEM", label: "Secagem" }, { v: "EXAME_GINECOLOGICO", label: "Exame ginecológico" }, { v: "DESMAME", label: "Desmame" },
];

const TIPOS_SAN: { v: EventoSanidadePayload["tipo"]; label: string }[] = [
  { v: "OCORRENCIA", label: "Ocorrência" }, { v: "APLICACAO", label: "Aplicação" }, { v: "EXAME", label: "Exame" }, { v: "MASTITE", label: "Mastite" }, { v: "VACINA", label: "Vacina" },
];

// Protocolos reprodutivos comuns no manejo leiteiro brasileiro (IATF + monta).
const PROTOCOLOS = [
  "IATF 11 dias", "IATF 9 dias", "IATF 8 dias",
  "Ressincronização (Resynch)", "Ovsynch", "Cosynch", "PreSynch",
  "Cio natural (IA convencional)", "Monta natural", "Repasse com touro",
];

// Motivos típicos para secagem da vaca.
const MOTIVOS_SECAGEM = [
  "Fim de ciclo (60d pré-parto)", "Baixa produção", "Mastite crônica",
  "Preparo para descarte", "CCS elevada persistente", "Decisão de manejo",
];

// Como o cio foi detectado — substitui a observação solta sobre detecção.
const DETECCAO_CIO = [
  "Visual (curral / pasto)", "Coleira / colar (sensor)", "Podômetro",
  "Bastão marcador", "Touro rufião", "Pintura / cera",
];

// Dicionários oficiais IDEAGRI (TIPOPARTO / AUXILIOPARTO).
const TIPOS_PARTO = [
  { v: "1", label: "Normal" },
  { v: "2", label: "Auxiliado" },
  { v: "3", label: "Aborto" },
  { v: "4", label: "Natimorto" },
  { v: "5", label: "Induzido" },
  { v: "6", label: "Prematuro" },
  { v: "7", label: "Vivo/Natimorto" },
];
const AUXILIOS_PARTO = [
  { v: "4", label: "1-Introdução de mãos" },
  { v: "1", label: "2-Bezerro puxado" },
  { v: "3", label: "3-Complicado" },
  { v: "2", label: "4-Cesariana" },
];

// Achados de exame ginecológico (palpação/US). Valor = enum do backend; label = pt-BR.
const ACHADOS_GINE: { v: string; label: string }[] = [
  { v: "CICLANDO", label: "Ciclando" }, { v: "CIO", label: "Em cio" }, { v: "CORPO_LUTEO", label: "Corpo lúteo" },
  { v: "GESTANTE", label: "Gestante" }, { v: "ANESTRO", label: "Anestro" }, { v: "CISTO_FOLICULAR", label: "Cisto folicular" },
  { v: "CISTO_LUTEO", label: "Cisto lúteo" }, { v: "ENDOMETRITE", label: "Endometrite" }, { v: "INDEFINIDO", label: "Indefinido" },
];
const METODOS_EXAME = ["Palpação", "Ultrassom"];

const QUARTOS_UBERE = ["AD", "AE", "PD", "PE"]; // anterior/posterior · direito/esquerdo

const SEVERIDADES_MASTITE = ["Subclínica", "Clínica leve", "Clínica moderada", "Clínica grave"];

type TipoInicialEvento =
  | { dominio: "reproducao"; tipo: EventoPayload["tipo"] }
  | { dominio: "sanidade"; tipo: EventoSanidadePayload["tipo"] };

type AnimalEvento = Pick<Animal, "id" | "numero" | "nome" | "categoria" | "resumo">;

function somarDiasIso(data: string, dias: number): string {
  const resultado = new Date(`${data}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

export function EventoForm({ animalId, animal, dominioFixo, tipoInicial, dataInicial, eventoEdicao, onFechar, onSalvo }: { animalId: string; animal?: AnimalEvento; dominioFixo?: "reproducao" | "sanidade"; tipoInicial?: TipoInicialEvento; dataInicial?: string; eventoEdicao?: EventoTimeline; onFechar: () => void; onSalvo: (evento?: EventoTimeline) => void }) {
  const dadosEdicao = eventoEdicao?.dadosEdicao as any | undefined;
  const dominioInicial = tipoInicial?.dominio ?? dominioFixo ?? "reproducao";
  const [dominio, setDominio] = useState<"reproducao" | "sanidade">(dominioInicial);
  const [tipo, setTipo] = useState<EventoPayload["tipo"]>(() => tipoInicial?.dominio === "reproducao" ? tipoInicial.tipo : "INSEMINACAO");
  const [tipoSan, setTipoSan] = useState<EventoSanidadePayload["tipo"]>(() => dadosEdicao?.tipo ?? (tipoInicial?.dominio === "sanidade" ? tipoInicial.tipo : "EXAME"));
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]); // catálogo p/ escolher a doadora na TE
  const [embrioes, setEmbrioes] = useState<EmbriaoDisponivelDTO[]>([]); // estoque FIV disponível p/ TE
  const [ultimaCobertura, setUltimaCobertura] = useState<string | null>(animal?.resumo?.ultimaInseminacao ?? null);
  const [gestacaoDias, setGestacaoDias] = useState(283);
  const [carregandoPrevisao, setCarregandoPrevisao] = useState(false);
  const [f, setF] = useState<any>({
    data: dadosEdicao?.data ?? dataInicial ?? "",
    // Reprodutor informado pela raça + grau de sangue.
    racaReprodutorId: "", fracaoReprodutor: "8/8", racaSecReprodutorId: "",
    protocolo: PROTOCOLOS[0], protocoloOutro: "",
    deteccaoCio: DETECCAO_CIO[0],
    // Transferência de embrião (TE): doadora da genética + touro/sêmen do embrião.
    doadoraId: "", semenTE: "", embriaoColetaId: "",
    resultado: "positivo", dtPartoPrevista: "",
    numCrias: "1", criasVivas: "1", criasNatimortas: "0", sexoCria: "F", tipoParto: "1", auxilioParto: "1",
    criaAcao: "nenhuma", criaNumero: "", criaId: "",
    motivoSecagem: MOTIVOS_SECAGEM[0],
    // Exame ginecológico.
    achado: ACHADOS_GINE[0].v, metodoExame: METODOS_EXAME[0], resultadoGinecologicoId: "",
    // Desmame (peso opcional).
    pesoDesmame: "",
    observacao: dadosEdicao?.observacao ?? "",
    // Sanidade.
    doenca: dadosEdicao?.doenca ?? "", diasTratamento: dadosEdicao?.diasTratamento ?? "", produto: dadosEdicao?.produto ?? "", dose: dadosEdicao?.dose ?? "", carencia: dadosEdicao?.carencia ?? "", loteProduto: dadosEdicao?.loteProduto ?? "",
    // Vínculo opcional com o estoque (baixa automática): produto cadastrado + quantidade usada.
    estoqueProdutoId: dadosEdicao?.produtoId ?? "", estoqueQtd: dadosEdicao?.quantidadeUsada ?? "",
    ccs: dadosEdicao?.ccs ?? "", gordura: dadosEdicao?.gordura ?? "", proteina: dadosEdicao?.proteina ?? "",
    quarto: dadosEdicao?.quarto || QUARTOS_UBERE[0], severidade: dadosEdicao?.severidade || SEVERIDADES_MASTITE[0], resultadoCultivo: dadosEdicao?.resultadoCultivo ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvamentoEmCurso = useRef(false);
  const botaoConfirmarAviso = useRef<HTMLButtonElement>(null);
  const [avisoSalvo, setAvisoSalvo] = useState<{ mensagem: string; evento: EventoRegistrado } | null>(null);
  const [baixaCtx, setBaixaCtx] = useState<{
    criado?: EventoTimeline;
    produto: string;
    dose?: string;
    loteProduto?: string;
    data: string;
    tipo: "APLICACAO" | "VACINA";
  } | null>(null);
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }));
  const num = (v: string) => (v.trim() !== "" ? Number(v) : undefined);
  // Produtos do estoque para o vínculo opcional de baixa automática (só medicamentos/insumos).
  const { data: produtosEstoque } = useProdutos({ ativo: true });

  useEffect(() => { listarRacas().then(setRacas).catch(() => {}); }, []);
  useEffect(() => {
    if (dominio !== "reproducao" || tipo !== "DIAGNOSTICO") return;
    let ativo = true;
    setCarregandoPrevisao(true);
    const animalComResumo = animal && "resumo" in animal
      ? Promise.resolve(animal)
      : obterAnimal(animalId).catch(() => null);
    Promise.all([animalComResumo, listarParametros().catch(() => [])])
      .then(([detalhado, parametros]) => {
        if (!ativo) return;
        setUltimaCobertura(detalhado?.resumo?.ultimaInseminacao ?? null);
        const configurado = parametros.find((p) => p.chave === "GESTACAO_DIAS")?.valorNumero;
        if (configurado != null && configurado > 0) setGestacaoDias(configurado);
      })
      .finally(() => { if (ativo) setCarregandoPrevisao(false); });
    return () => { ativo = false; };
  }, [animal, animalId, dominio, tipo]);
  // Só carrega o catálogo de animais quando a TE ou vínculo de cria precisarem dele.
  useEffect(() => {
    if ((tipo === "TRANSFERENCIA_EMBRIAO" || (tipo === "PARTO" && f.criaAcao === "vincular")) && animais.length === 0) {
      listarAnimais({ status: "ATIVO" }).then(setAnimais).catch(() => {});
    }
  }, [tipo, f.criaAcao, animais.length]);
  // Estoque de embriões FIV disponível — só busca ao entrar na TE.
  useEffect(() => {
    if (tipo === "TRANSFERENCIA_EMBRIAO" && embrioes.length === 0) {
      listarEmbrioesDisponiveis().then(setEmbrioes).catch(() => {});
    }
  }, [tipo, embrioes.length]);
  const resultadosGinecologicos = useResultadosGinecologicos(tipo === "EXAME_GINECOLOGICO");

  // Espécie da fêmea — filtra raças do reprodutor pra mesma espécie.
  const especie = animal ? ESPECIE_POR_CATEGORIA[animal.categoria] : null;
  const racasDaEspecie = useMemo(
    () => (especie ? racas.filter((r) => r.especie === especie) : racas),
    [racas, especie],
  );

  const racaReprodutor = racas.find((r) => String(r.id) === f.racaReprodutorId);
  const racaSecReprodutor = racas.find((r) => String(r.id) === f.racaSecReprodutorId);
  const opcoesSecReprodutor = racaReprodutor
    ? racas.filter((r) => r.especie === racaReprodutor.especie && r.id !== racaReprodutor.id)
    : [];
  const ehPuroRep = f.fracaoReprodutor === "8/8";
  const fracCompRep = complementoLabel(f.fracaoReprodutor);
  const previsaoPartoAutomatica = ultimaCobertura ? somarDiasIso(ultimaCobertura, gestacaoDias) : "";
  const quantidadeCriasVivas = Math.max(0, Math.min(3, Number(f.criasVivas) || 0));

  useEffect(() => {
    if (dominio !== "reproducao" || tipo !== "DIAGNOSTICO" || f.resultado !== "positivo" || !previsaoPartoAutomatica) return;
    setF((atual: any) => atual.dtPartoPrevista === previsaoPartoAutomatica
      ? atual
      : { ...atual, dtPartoPrevista: previsaoPartoAutomatica });
  }, [dominio, tipo, f.resultado, previsaoPartoAutomatica]);

  const alterarCriasVivas = (valor: string) => {
    const quantidade = Math.max(0, Math.min(3, Number(valor) || 0));
    setF((atual: any) => ({
      ...atual,
      criasVivas: valor,
      sexoCria: Array.from({ length: quantidade }, (_, indice) => atual.sexoCria?.[indice] ?? "F").join(""),
    }));
  };
  const alterarSexoCria = (indice: number, sexo: string) => {
    setF((atual: any) => {
      const sexos = Array.from({ length: quantidadeCriasVivas }, (_, posicao) => atual.sexoCria?.[posicao] ?? "F");
      sexos[indice] = sexo;
      return { ...atual, sexoCria: sexos.join("") };
    });
  };

  async function salvar() {
    if (salvamentoEmCurso.current || avisoSalvo) return;
    salvamentoEmCurso.current = true;
    setSalvando(true); setErro(null);
    try {
      let criado: EventoRegistrado | undefined;
      if (dominio === "reproducao") {
        const p: EventoPayload = { tipo, data: f.data, observacao: f.observacao || undefined };
        if (tipo === "CIO") {
          // Detecção entra como observação curta — o backend não tem campo dedicado.
          p.observacao = [f.deteccaoCio, f.observacao].filter(Boolean).join(" · ") || undefined;
        }
        if (tipo === "INSEMINACAO") {
          const rep = montarRacaDisplay(f.fracaoReprodutor, racaReprodutor, racaSecReprodutor);
          if (!rep) throw new Error("Selecione a raça do reprodutor.");
          const proto = f.protocolo === "Outro" ? f.protocoloOutro.trim() : f.protocolo;
          Object.assign(p, camposInseminacao({
            reprodutor: rep,
            protocolo: proto || undefined,
          }));
        }
        if (tipo === "COBERTURA") {
          if (f.semenTE.trim()) p.reprodutor = f.semenTE.trim();
        }
        if (tipo === "TRANSFERENCIA_EMBRIAO") {
          const proto = f.protocolo === "Outro" ? f.protocoloOutro.trim() : f.protocolo;
          Object.assign(p, camposTransferenciaEmbriao({ embriaoColetaId: f.embriaoColetaId, doadoraId: f.doadoraId, semenTE: f.semenTE, protocolo: proto }));
        }
        if (tipo === "DIAGNOSTICO") {
          p.resultado = f.resultado;
          p.dtPartoPrevista = f.resultado === "positivo" ? (f.dtPartoPrevista || undefined) : undefined;
        }
        if (tipo === "PARTO") Object.assign(p, camposParto(f));
        if (tipo === "SECAGEM") p.motivoSecagem = f.motivoSecagem || undefined;
        if (tipo === "EXAME_GINECOLOGICO") Object.assign(p, camposExameGinecologico(f));
        if (tipo === "DESMAME") p.pesoKg = num(f.pesoDesmame) ?? undefined;
        criado = await registrarEvento(animalId, p);
      } else {
        const p: EventoSanidadePayload = { tipo: tipoSan, data: f.data, observacao: f.observacao || undefined };
        if (tipoSan === "EXAME") { p.ccs = num(f.ccs); p.gordura = num(f.gordura); p.proteina = num(f.proteina); }
        if (tipoSan === "APLICACAO") { p.produto = f.produto; p.dose = f.dose || undefined; p.carencia = num(f.carencia); p.loteProduto = f.loteProduto || undefined; }
        if (tipoSan === "OCORRENCIA") { p.doenca = f.doenca; p.diasTratamento = num(f.diasTratamento); }
        if (tipoSan === "MASTITE") { p.quarto = f.quarto || undefined; p.severidade = f.severidade || undefined; p.resultadoCultivo = f.resultadoCultivo || undefined; }
        if (tipoSan === "VACINA") p.produto = f.produto;
        // Vínculo de estoque (baixa automática): só quando produto cadastrado + quantidade informados.
        const usaEstoque = (tipoSan === "APLICACAO" || tipoSan === "VACINA") && f.estoqueProdutoId && num(f.estoqueQtd);
        if (usaEstoque) { p.produtoId = Number(f.estoqueProdutoId); p.quantidadeUsada = num(f.estoqueQtd); }
        criado = eventoEdicao ? await editarEventoSanidade(eventoEdicao.id, p) : await registrarEventoSanidade(animalId, p);
        // Se a baixa foi automática (produtoId), NÃO abre o card manual (evita baixa dupla).
        if (!eventoEdicao && !usaEstoque && (tipoSan === "APLICACAO" || tipoSan === "VACINA") && f.produto && f.produto.trim()) {
          setBaixaCtx({
            criado,
            produto: f.produto,
            dose: f.dose || undefined,
            loteProduto: f.loteProduto || undefined,
            data: f.data,
            tipo: tipoSan,
          });
          return;
        }
      }
      if (criado?.aviso) {
        setAvisoSalvo({ mensagem: criado.aviso, evento: criado });
        return;
      }
      onSalvo(criado);
    } catch (e: any) { setErro(e.message); } finally {
      salvamentoEmCurso.current = false;
      setSalvando(false);
    }
  }

  useEffect(() => {
    if (avisoSalvo) botaoConfirmarAviso.current?.focus();
  }, [avisoSalvo]);

  const confirmarAvisoSalvo = () => {
    if (avisoSalvo) onSalvo(avisoSalvo.evento);
  };
  const fecharModal = () => {
    if (salvamentoEmCurso.current) return;
    if (avisoSalvo) confirmarAvisoSalvo();
    else onFechar();
  };

  if (baixaCtx) {
    return (
      <BaixaEstoqueCard
        animalId={animalId}
        animal={animal}
        produtoDigitado={baixaCtx.produto}
        dose={baixaCtx.dose}
        loteProduto={baixaCtx.loteProduto}
        data={baixaCtx.data}
        tipo={baixaCtx.tipo}
        onFechar={() => onSalvo(baixaCtx.criado)}
        onBaixaFeita={() => {}}
      />
    );
  }

  return (
    <RebModal
      title={`${eventoEdicao ? "Editar" : "Registrar"} evento${dominioFixo ? ` · ${dominioFixo === "reproducao" ? "Reprodução" : "Sanidade"}` : ""}`}
      onClose={fecharModal}
      actions={
        avisoSalvo
          ? <RebButton ref={botaoConfirmarAviso} variant="pri" onClick={confirmarAvisoSalvo}>Entendi</RebButton>
          : <>
              <RebButton disabled={salvando} onClick={fecharModal}>Cancelar</RebButton>
              <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
            </>
      }
    >
      <>
        {avisoSalvo && (
          <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-border bg-card px-4 py-3 font-sans text-sm text-foreground">
            <strong>Evento salvo.</strong> {avisoSalvo.mensagem}
          </div>
        )}
        {!dominioFixo && <RebField label="Domínio"><RebSelect value={dominio} onChange={(v) => setDominio(v as any)}><option value="reproducao">Reprodução</option><option value="sanidade">Sanidade</option></RebSelect></RebField>}
        {dominio === "reproducao"
          ? <RebField label="Tipo"><RebSelect value={tipo} onChange={(v) => setTipo(v as any)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</RebSelect></RebField>
          : <RebField label="Tipo"><RebSelect value={tipoSan} onChange={(v) => setTipoSan(v as any)} disabled={Boolean(eventoEdicao)}>{TIPOS_SAN.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</RebSelect></RebField>}
        <RebField label="Data*"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></RebField>
        {dominio === "reproducao" && <>
          {tipo === "CIO" && (
            <RebField label="Detecção">
              <RebSelect value={f.deteccaoCio} onChange={(v) => set("deteccaoCio", v)}>
                {DETECCAO_CIO.map((d) => <option key={d} value={d}>{d}</option>)}
              </RebSelect>
            </RebField>
          )}
          {tipo === "INSEMINACAO" && <>
            <RebField label="Raça do reprodutor*">
              <RebSelect value={f.racaReprodutorId} onChange={(v) => set("racaReprodutorId", v)}>
                <option value="">—</option>
                {racasDaEspecie.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </RebSelect>
            </RebField>
            {racaReprodutor && (
              <RebFieldset>
                <legend>Grau de sangue</legend>
                <div className={REB_SANGUE_ROW}>
                  <span className={REB_SANGUE_RACA}>{racaReprodutor.nome}</span>
                  <RebSelect className={REB_SANGUE_INPUT} value={f.fracaoReprodutor} onChange={(v) => set("fracaoReprodutor", v)} aria-label="Fração da raça principal">
                    {FRACOES.map((fr) => <option key={fr.id} value={fr.id}>{fr.label}</option>)}
                  </RebSelect>
                </div>
                {!ehPuroRep && (
                  <div className={REB_SANGUE_ROW}>
                    <RebSelect className={REB_SANGUE_INPUT} value={f.racaSecReprodutorId} onChange={(v) => set("racaSecReprodutorId", v)} aria-label="Raça secundária">
                      <option value="">— escolher raça —</option>
                      {opcoesSecReprodutor.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </RebSelect>
                    <span className={REB_SANGUE_FRAC_COMP}>{fracCompRep}</span>
                  </div>
                )}
              </RebFieldset>
            )}
            <RebField label="Protocolo">
              <RebSelect value={f.protocolo} onChange={(v) => set("protocolo", v)}>
                {PROTOCOLOS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="Outro">Outro…</option>
              </RebSelect>
            </RebField>
            {f.protocolo === "Outro" && (
              <RebField label="Descrever protocolo"><input value={f.protocoloOutro} onChange={(e) => set("protocoloOutro", e.target.value)} placeholder="ex.: P36 / FertilizAID" /></RebField>
            )}
          </>}
          {tipo === "COBERTURA" && (
            <RebField label="Touro (opcional)"><input value={f.semenTE} onChange={(e) => set("semenTE", e.target.value)} placeholder="ex.: Touro do pasto" /></RebField>
          )}
          {tipo === "TRANSFERENCIA_EMBRIAO" && (() => {
            const usaEstoque = !!f.embriaoColetaId;
            return <>
            <p style={{ margin: "-4px 0 8px", fontSize: 12, opacity: 0.75 }}>
              A receptora (este animal) carrega o embrião; a genética do bezerro vem da <b>doadora</b>.
            </p>
            {embrioes.length > 0 && (
              <RebField label="Embrião do estoque (FIV/TE)">
                <RebSelect value={f.embriaoColetaId} onChange={(v) => set("embriaoColetaId", v)}>
                  <option value="">— usar doadora/touro manualmente —</option>
                  {embrioes.map((emb) => (
                    <option key={emb.id} value={emb.id}>
                      {`doadora ${emb.fertilizacao.coleta.doadora.nome ?? emb.fertilizacao.coleta.doadora.numero} · touro ${emb.fertilizacao.reprodutor.nome}${emb.classificacao ? ` · ${emb.classificacao.sigla}` : ""}`}
                    </option>
                  ))}
                </RebSelect>
              </RebField>
            )}
            {usaEstoque && <p style={{ margin: "-4px 0 8px", fontSize: 12, color: "var(--leite)" }}>Doadora e touro vêm do embrião selecionado.</p>}
            <RebField label="Doadora (genética)">
              <RebSelect value={f.doadoraId} disabled={usaEstoque} onChange={(v) => set("doadoraId", v)}>
                <option value="">— selecionar —</option>
                {animais.filter((a) => a.id !== animalId).map((a) => (
                  <option key={a.id} value={a.id}>{rotuloAnimal(a.numero, a.nome)}</option>
                ))}
              </RebSelect>
            </RebField>
            <RebField label="Touro / sêmen do embrião"><input value={f.semenTE} disabled={usaEstoque} onChange={(e) => set("semenTE", e.target.value)} placeholder="ex.: Holandês GEN 12" /></RebField>
            <RebField label="Protocolo">
              <RebSelect value={f.protocolo} onChange={(v) => set("protocolo", v)}>
                {PROTOCOLOS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="Outro">Outro…</option>
              </RebSelect>
            </RebField>
            {f.protocolo === "Outro" && (
              <RebField label="Descrever protocolo"><input value={f.protocoloOutro} onChange={(e) => set("protocoloOutro", e.target.value)} placeholder="ex.: sincronização de receptoras" /></RebField>
            )}
          </>;
          })()}
          {tipo === "DIAGNOSTICO" && <>
            <RebField label="Resultado"><RebSelect value={f.resultado} onChange={(v) => set("resultado", v)}><option value="positivo">Positivo</option><option value="negativo">Negativo</option></RebSelect></RebField>
            {f.resultado === "positivo" && (
              <RebField label="Parto previsto">
                <input type="date" value={f.dtPartoPrevista} readOnly={Boolean(previsaoPartoAutomatica)} onChange={(e) => set("dtPartoPrevista", e.target.value)} />
                {carregandoPrevisao
                  ? <small className="font-sans text-xs not-italic text-ink-3">Calculando pela última cobertura…</small>
                  : previsaoPartoAutomatica
                    ? <small className="font-sans text-xs not-italic text-ink-3">Automático: cobertura em {ultimaCobertura} + {gestacaoDias} dias.</small>
                    : <small className="font-sans text-xs not-italic text-ink-3">Sem cobertura anterior encontrada; informe a data.</small>}
              </RebField>
            )}
          </>}
          {tipo === "PARTO" && <>
            <RebField label="Tipo de parto">
              <RebSelect value={f.tipoParto} onChange={(v) => set("tipoParto", v)}>
                {TIPOS_PARTO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </RebSelect>
            </RebField>
            {f.tipoParto === "2" && (
              <RebField label="Auxílio">
                <RebSelect value={f.auxilioParto} onChange={(v) => set("auxilioParto", v)}>
                  {AUXILIOS_PARTO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </RebSelect>
              </RebField>
            )}
            {f.tipoParto !== "3" && <>
              <RebField label="Crias vivas"><input type="number" min={0} max={3} value={f.criasVivas} onChange={(e) => alterarCriasVivas(e.target.value)} /></RebField>
              <RebField label="Natimortos"><input type="number" min={0} max={3} value={f.criasNatimortas} onChange={(e) => set("criasNatimortas", e.target.value)} /></RebField>
              {Array.from({ length: quantidadeCriasVivas }, (_, indice) => (
                <RebField key={indice} label={quantidadeCriasVivas === 1 ? "Sexo da cria" : `Sexo da cria ${indice + 1}`}>
                  <RebSelect value={f.sexoCria?.[indice] ?? "F"} onChange={(v) => alterarSexoCria(indice, v)}>
                    <option value="F">Fêmea</option>
                    <option value="M">Macho</option>
                  </RebSelect>
                </RebField>
              ))}
              <RebField label="Destino da cria">
                <RebSelect value={f.criaAcao} onChange={(v) => set("criaAcao", v)}>
                  <option value="nenhuma">Não cadastrar agora</option>
                  <option value="criar">Cadastrar a cria</option>
                  <option value="vincular">Vincular cria existente</option>
                </RebSelect>
              </RebField>
              {f.criaAcao === "criar" && (
                <RebField label="Número da cria*">
                  <input value={f.criaNumero} onChange={(e) => set("criaNumero", e.target.value)} placeholder="ex.: B-101" maxLength={20} />
                  {Number(f.criasVivas) > 1 && <small className="font-sans text-xs not-italic text-ink-3">As demais recebem sufixo -2, -3.</small>}
                </RebField>
              )}
              {f.criaAcao === "vincular" && (
                <RebField label="Cria existente*">
                  <RebSelect value={f.criaId} onChange={(v) => set("criaId", v)}>
                    <option value="">— selecionar —</option>
                    {animais.filter((a) => a.id !== animalId && (a.categoria === "BEZERRA" || a.categoria === "BEZERRO")).map((a) => (
                      <option key={a.id} value={a.id}>{rotuloAnimal(a.numero, a.nome)}</option>
                    ))}
                  </RebSelect>
                  {Number(f.criasVivas) !== 1 && <small className="font-sans text-xs not-italic text-prejuizo">O vínculo exige exatamente uma cria viva.</small>}
                </RebField>
              )}
            </>}
          </>}
          {tipo === "SECAGEM" && (
            <RebField label="Motivo">
              <RebSelect value={f.motivoSecagem} onChange={(v) => set("motivoSecagem", v)}>
                {MOTIVOS_SECAGEM.map((m) => <option key={m} value={m}>{m}</option>)}
              </RebSelect>
            </RebField>
          )}
          {tipo === "DESMAME" && (
            <RebField label="Peso ao desmame (kg)">
              <input type="number" min={0} step="0.1" value={f.pesoDesmame} onChange={(e) => set("pesoDesmame", e.target.value)} placeholder="opcional" />
            </RebField>
          )}
          {tipo === "EXAME_GINECOLOGICO" && <>
            <RebField label="Resultado oficial">
              <RebSelect value={f.resultadoGinecologicoId} onChange={(v) => set("resultadoGinecologicoId", v)} disabled={resultadosGinecologicos.loading}>
                <option value="">{resultadosGinecologicos.loading ? "Carregando catálogo…" : "— selecionar —"}</option>
                {(resultadosGinecologicos.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.nomeResumido}{r.tipo ? ` · ${r.tipo.toLowerCase()}` : ""}</option>)}
              </RebSelect>
            </RebField>
            <RebField label="Achado operacional*">
              <RebSelect value={f.achado} onChange={(v) => set("achado", v)}>
                {ACHADOS_GINE.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </RebSelect>
            </RebField>
            <RebField label="Método">
              <RebSelect value={f.metodoExame} onChange={(v) => set("metodoExame", v)}>
                {METODOS_EXAME.map((m) => <option key={m} value={m}>{m}</option>)}
              </RebSelect>
            </RebField>
          </>}
        </>}
        {dominio === "sanidade" && <>
          {tipoSan === "EXAME" && <>
            <RebField label="CCS (mil)*"><input type="number" min={0} value={f.ccs} onChange={(e) => set("ccs", e.target.value)} /></RebField>
            <RebField label="Gordura (%)"><input type="number" step="0.01" value={f.gordura} onChange={(e) => set("gordura", e.target.value)} /></RebField>
            <RebField label="Proteína (%)"><input type="number" step="0.01" value={f.proteina} onChange={(e) => set("proteina", e.target.value)} /></RebField>
          </>}
          {tipoSan === "APLICACAO" && <>
            <RebField label="Produto*"><input value={f.produto} onChange={(e) => set("produto", e.target.value)} placeholder="Mastijet" /></RebField>
            <RebField label="Dose"><input value={f.dose} onChange={(e) => set("dose", e.target.value)} placeholder="1 bisnaga" /></RebField>
            <RebField label="Carência (h)"><input type="number" min={0} value={f.carencia} onChange={(e) => set("carencia", e.target.value)} /></RebField>
            <RebField label="Lote do produto"><input value={f.loteProduto} onChange={(e) => set("loteProduto", e.target.value)} placeholder="MAST-2231" /></RebField>
            <RebField label="Produto do estoque*">
              <RebSelect value={f.estoqueProdutoId} onChange={(id) => { setF((s: any) => ({ ...s, estoqueProdutoId: id, ...(id ? { produto: produtosEstoque.find((p) => String(p.id) === id)?.nome ?? s.produto } : {}) })); }}>
                <option value="">— selecione —</option>
                {produtosEstoque.map((pr) => <option key={pr.id} value={pr.id}>{pr.nome} ({pr.unidade})</option>)}
              </RebSelect>
            </RebField>
            {f.estoqueProdutoId && <RebField label="Qtd. usada*"><input type="number" min={0.01} step="0.01" value={f.estoqueQtd} onChange={(e) => set("estoqueQtd", e.target.value)} placeholder="1" /></RebField>}
          </>}
          {tipoSan === "OCORRENCIA" && <>
            <RebField label="Doença*"><input value={f.doenca} onChange={(e) => set("doenca", e.target.value)} placeholder="Mastite clínica" /></RebField>
            <RebField label="Dias de tratamento"><input type="number" min={0} value={f.diasTratamento} onChange={(e) => set("diasTratamento", e.target.value)} /></RebField>
          </>}
          {tipoSan === "MASTITE" && <>
            <RebField label="Quarto">
              <RebSelect value={f.quarto} onChange={(v) => set("quarto", v)}>
                {QUARTOS_UBERE.map((q) => <option key={q} value={q}>{q}</option>)}
              </RebSelect>
            </RebField>
            <RebField label="Severidade">
              <RebSelect value={f.severidade} onChange={(v) => set("severidade", v)}>
                {SEVERIDADES_MASTITE.map((s) => <option key={s} value={s}>{s}</option>)}
              </RebSelect>
            </RebField>
            <RebField label="Resultado do cultivo"><input value={f.resultadoCultivo} onChange={(e) => set("resultadoCultivo", e.target.value)} placeholder="ex.: Staphylococcus aureus" /></RebField>
          </>}
          {tipoSan === "VACINA" && <>
            <RebField label="Produto*"><input value={f.produto} onChange={(e) => set("produto", e.target.value)} /></RebField>
            <RebField label="Produto do estoque*">
              <RebSelect value={f.estoqueProdutoId} onChange={(id) => { setF((s: any) => ({ ...s, estoqueProdutoId: id, ...(id ? { produto: produtosEstoque.find((p) => String(p.id) === id)?.nome ?? s.produto } : {}) })); }}>
                <option value="">— selecione —</option>
                {produtosEstoque.map((pr) => <option key={pr.id} value={pr.id}>{pr.nome} ({pr.unidade})</option>)}
              </RebSelect>
            </RebField>
            {f.estoqueProdutoId && <RebField label="Qtd. usada*"><input type="number" min={0.01} step="0.01" value={f.estoqueQtd} onChange={(e) => set("estoqueQtd", e.target.value)} placeholder="1" /></RebField>}
          </>}
        </>}
        <RebField label="Observação"><input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} /></RebField>
        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
