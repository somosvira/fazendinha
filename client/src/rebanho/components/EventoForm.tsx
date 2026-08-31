import { useEffect, useMemo, useRef, useState } from "react";
import { criarEventoSanitarioSchema } from "@rionovo/shared";
import { registrarEvento, listarRacas, listarAnimais, listarReprodutores, listarEstoqueSemen, listarEmbrioesDisponiveis, useResultadosGinecologicos, type EventoPayload, type EventoRegistrado, type EventoSanidadePayload, type RacaDTO, type ReprodutorDTO, type EstoqueSemenDTO, type EmbriaoDisponivelDTO } from "../api";
import { camposExameGinecologico, camposInseminacao, camposParto, camposTransferenciaEmbriao } from "./EventoForm.payload";
import { TIPOS_SAN, QUARTOS_UBERE, SEVERIDADES_MASTITE, SanidadeCampos, montarPayloadSanidade, useSanidadeEscrita } from "./EventoForm.sanidade";
import { ESPECIE_POR_CATEGORIA, type Animal, type EventoTimeline } from "../types";
import { FRACOES, complementoLabel, montarRacaDisplay } from "../lib/sangue";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { RebFieldset, REB_SANGUE_ROW, REB_SANGUE_RACA, REB_SANGUE_INPUT, REB_SANGUE_FRAC_COMP } from "@/components/rb/RebPrimitives";
import { rotuloAnimal } from "./AnimalIdentity";

const TIPOS: { v: EventoPayload["tipo"]; label: string }[] = [
  { v: "CIO", label: "Cio" }, { v: "INSEMINACAO", label: "Inseminação" }, { v: "COBERTURA", label: "Cobertura (monta natural)" }, { v: "TRANSFERENCIA_EMBRIAO", label: "Transferência de embrião" }, { v: "DIAGNOSTICO", label: "Diagnóstico" }, { v: "PARTO", label: "Parto" }, { v: "SECAGEM", label: "Secagem" }, { v: "EXAME_GINECOLOGICO", label: "Exame ginecológico" }, { v: "DESMAME", label: "Desmame" },
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

type TipoInicialEvento =
  | { dominio: "reproducao"; tipo: EventoPayload["tipo"] }
  | { dominio: "sanidade"; tipo: EventoSanidadePayload["tipo"] };

type AnimalEvento = Pick<Animal, "id" | "numero" | "nome" | "categoria">;

export function EventoForm({ animalId, animal, dominioFixo, tipoInicial, dataInicial, eventoEdicao, onFechar, onSalvo }: { animalId: string; animal?: AnimalEvento; dominioFixo?: "reproducao" | "sanidade"; tipoInicial?: TipoInicialEvento; dataInicial?: string; eventoEdicao?: EventoTimeline; onFechar: () => void; onSalvo: (evento?: EventoTimeline) => void }) {
  const dadosEdicao = eventoEdicao?.dadosEdicao as any | undefined;
  const dominioInicial = tipoInicial?.dominio ?? dominioFixo ?? "reproducao";
  const [dominio, setDominio] = useState<"reproducao" | "sanidade">(dominioInicial);
  const [tipo, setTipo] = useState<EventoPayload["tipo"]>(() => tipoInicial?.dominio === "reproducao" ? tipoInicial.tipo : "INSEMINACAO");
  const [tipoSan, setTipoSan] = useState<EventoSanidadePayload["tipo"]>(() => dadosEdicao?.tipo ?? (tipoInicial?.dominio === "sanidade" ? tipoInicial.tipo : "EXAME"));
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]); // catálogo p/ escolher a doadora na TE
  const [embrioes, setEmbrioes] = useState<EmbriaoDisponivelDTO[]>([]); // estoque FIV disponível p/ TE
  const [reprodutores, setReprodutores] = useState<ReprodutorDTO[]>([]);
  const [carregandoReprodutores, setCarregandoReprodutores] = useState(false);
  const [estoquesSemen, setEstoquesSemen] = useState<EstoqueSemenDTO[]>([]);
  const [carregandoEstoqueSemen, setCarregandoEstoqueSemen] = useState(false);
  const [f, setF] = useState<any>({
    data: dadosEdicao?.data ?? dataInicial ?? "",
    // Reprodutor estruturado (catálogo opcional ou fallback de raça + grau de sangue).
    reprodutorCatalogoId: "", estoqueSemenId: "",
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
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }));
  const alterarReprodutorCatalogo = (reprodutorCatalogoId: string) => {
    setF((s: any) => ({ ...s, reprodutorCatalogoId, estoqueSemenId: "" }));
    setEstoquesSemen([]);
    setCarregandoEstoqueSemen(Boolean(reprodutorCatalogoId));
  };
  const num = (v: string) => (v.trim() !== "" ? Number(v) : undefined);
  const { produtosEstoque, registrar: registrarSanitario, editar: editarSanitario, toast, salvando: salvandoOffline, enviar } = useSanidadeEscrita();

  useEffect(() => { listarRacas().then(setRacas).catch(() => {}); }, []);
  useEffect(() => {
    if (dominio !== "reproducao" || tipo !== "INSEMINACAO") return;
    let ativo = true;
    setCarregandoReprodutores(true);
    listarReprodutores()
      .then((resultado) => { if (ativo) setReprodutores(resultado.reprodutores); })
      .catch(() => { if (ativo) setReprodutores([]); })
      .finally(() => { if (ativo) setCarregandoReprodutores(false); });
    return () => { ativo = false; };
  }, [dominio, tipo]);
  useEffect(() => {
    let ativo = true;
    if (dominio !== "reproducao" || tipo !== "INSEMINACAO" || !f.reprodutorCatalogoId) {
      return () => { ativo = false; };
    }
    setCarregandoEstoqueSemen(true);
    listarEstoqueSemen(Number(f.reprodutorCatalogoId))
      .then((itens) => { if (ativo) setEstoquesSemen(itens); })
      .catch(() => { if (ativo) setEstoquesSemen([]); })
      .finally(() => { if (ativo) setCarregandoEstoqueSemen(false); });
    return () => { ativo = false; };
  }, [dominio, tipo, f.reprodutorCatalogoId]);
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

  const reprodutorCatalogo = reprodutores.find((r) => String(r.id) === f.reprodutorCatalogoId);
  const loteSelecionado = estoquesSemen.find((e) => String(e.id) === f.estoqueSemenId);
  const loteZerado = loteSelecionado != null && loteSelecionado.dosesDisponiveis === 0;
  const racaReprodutor = racas.find((r) => String(r.id) === f.racaReprodutorId);
  const racaSecReprodutor = racas.find((r) => String(r.id) === f.racaSecReprodutorId);
  const opcoesSecReprodutor = racaReprodutor
    ? racas.filter((r) => r.especie === racaReprodutor.especie && r.id !== racaReprodutor.id)
    : [];
  const ehPuroRep = f.fracaoReprodutor === "8/8";
  const fracCompRep = complementoLabel(f.fracaoReprodutor);

  // Validação client-side compartilhada por criar e editar Sanidade — mesmo
  // schema do servidor, roda antes de enfileirar (reduz erro de fila).
  function validarSanidade(p: EventoSanidadePayload): string | null {
    if ((tipoSan === "APLICACAO" || tipoSan === "VACINA") && (!p.produtoId || !p.quantidadeUsada)) {
      return "Selecione o produto do estoque e a quantidade usada.";
    }
    const valido = criarEventoSanitarioSchema.safeParse(p);
    return valido.success ? null : (valido.error.issues[0]?.message ?? "Dado inválido.");
  }

  // useSalvarOffline: fecha o modal na hora se offline (erro tardio vai pro
  // toast); espera confirmação real do servidor antes de fechar se online.
  function salvarSanidadeNova() {
    const p = montarPayloadSanidade(tipoSan, f);
    const erroValidacao = validarSanidade(p);
    if (erroValidacao) { setErro(erroValidacao); return; }
    const produto = p.produtoId != null ? produtosEstoque.find((pr) => pr.id === p.produtoId) : undefined;
    salvamentoEmCurso.current = true;
    setErro(null);
    enviar(registrarSanitario.mutate, {
      animalId, ...p,
      produtoInfo: produto ? { nome: produto.nome, unidade: produto.unidade, setor: produto.setor } : undefined,
    }, {
      onSalvo: () => { salvamentoEmCurso.current = false; onSalvo(); },
      onErroInline: (msg) => { salvamentoEmCurso.current = false; setErro(msg); },
      onErroTardio: (msg) => toast.error("Erro ao sincronizar o evento sanitário", msg),
    });
  }

  function salvarSanidadeEdicao() {
    const p = montarPayloadSanidade(tipoSan, f);
    const erroValidacao = validarSanidade(p);
    if (erroValidacao) { setErro(erroValidacao); return; }
    salvamentoEmCurso.current = true;
    setErro(null);
    enviar(editarSanitario.mutate, { eventoId: eventoEdicao!.id, animalId, payload: p }, {
      onSalvo: () => { salvamentoEmCurso.current = false; onSalvo(); },
      onErroInline: (msg) => { salvamentoEmCurso.current = false; setErro(msg); },
      onErroTardio: (msg) => toast.error("Erro ao sincronizar a edição do evento sanitário", msg),
    });
  }

  async function salvar() {
    if (salvamentoEmCurso.current || avisoSalvo) return;
    if (dominio === "sanidade") {
      if (eventoEdicao) salvarSanidadeEdicao(); else salvarSanidadeNova();
      return;
    }
    salvamentoEmCurso.current = true;
    setSalvando(true); setErro(null);
    try {
      const p: EventoPayload = { tipo, data: f.data, observacao: f.observacao || undefined };
      if (tipo === "CIO") {
        // Detecção entra como observação curta — o backend não tem campo dedicado.
        p.observacao = [f.deteccaoCio, f.observacao].filter(Boolean).join(" · ") || undefined;
      }
      if (tipo === "INSEMINACAO") {
        const rep = reprodutorCatalogo?.nome ?? montarRacaDisplay(f.fracaoReprodutor, racaReprodutor, racaSecReprodutor);
        if (!rep) throw new Error("Selecione o reprodutor do catálogo ou a raça do reprodutor.");
        const proto = f.protocolo === "Outro" ? f.protocoloOutro.trim() : f.protocolo;
        Object.assign(p, camposInseminacao({
          reprodutor: rep,
          protocolo: proto || undefined,
          estoqueSemenId: f.estoqueSemenId,
        }));
      }
      if (tipo === "COBERTURA") {
        if (f.semenTE.trim()) p.reprodutor = f.semenTE.trim();
      }
      if (tipo === "TRANSFERENCIA_EMBRIAO") {
        const proto = f.protocolo === "Outro" ? f.protocoloOutro.trim() : f.protocolo;
        Object.assign(p, camposTransferenciaEmbriao({ embriaoColetaId: f.embriaoColetaId, doadoraId: f.doadoraId, semenTE: f.semenTE, protocolo: proto }));
      }
      if (tipo === "DIAGNOSTICO") { p.resultado = f.resultado; p.dtPartoPrevista = f.dtPartoPrevista || undefined; }
      if (tipo === "PARTO") Object.assign(p, camposParto(f));
      if (tipo === "SECAGEM") p.motivoSecagem = f.motivoSecagem || undefined;
      if (tipo === "EXAME_GINECOLOGICO") Object.assign(p, camposExameGinecologico(f));
      if (tipo === "DESMAME") p.pesoKg = num(f.pesoDesmame) ?? undefined;
      const criado = await registrarEvento(animalId, p);
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

  return (
    <RebModal
      title={`${eventoEdicao ? "Editar" : "Registrar"} evento${dominioFixo ? ` · ${dominioFixo === "reproducao" ? "Reprodução" : "Sanidade"}` : ""}`}
      onClose={fecharModal}
      actions={
        avisoSalvo
          ? <RebButton ref={botaoConfirmarAviso} variant="pri" onClick={confirmarAvisoSalvo}>Entendi</RebButton>
          : <>
              <RebButton disabled={salvando || salvandoOffline} onClick={fecharModal}>Cancelar</RebButton>
              <RebButton variant="pri" disabled={salvando || salvandoOffline} onClick={salvar}>{(salvando || salvandoOffline) ? "Salvando…" : "Salvar"}</RebButton>
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
            <RebField label="Reprodutor do catálogo (opcional)">
              <select
                className="rb-field-select"
                value={f.reprodutorCatalogoId}
                onChange={(e) => alterarReprodutorCatalogo(e.target.value)}
                disabled={carregandoReprodutores}
              >
                <option value="">{carregandoReprodutores ? "Carregando catálogo…" : "— usar raça e grau de sangue —"}</option>
                {reprodutores.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}{r.codigo ? ` · ${r.codigo}` : ""}</option>
                ))}
              </select>
            </RebField>
            <RebField label="Lote de sêmen">
              <select
                className="rb-field-select"
                value={f.estoqueSemenId}
                onChange={(e) => set("estoqueSemenId", e.target.value)}
                disabled={!f.reprodutorCatalogoId || carregandoEstoqueSemen}
              >
                <option value="">{
                  !f.reprodutorCatalogoId
                    ? "Selecione um reprodutor do catálogo"
                    : carregandoEstoqueSemen
                      ? "Carregando lotes…"
                      : estoquesSemen.length === 0
                        ? "Nenhum lote cadastrado"
                        : "— não baixar dose —"
                }</option>
                {estoquesSemen.map((estoque) => (
                  <option key={estoque.id} value={estoque.id}>
                    {estoque.lote || `Lote #${estoque.id}`}
                    {estoque.tipoSemenNome ? ` · ${estoque.tipoSemenNome}` : ""}
                    {estoque.localizacao ? ` · ${estoque.localizacao}` : ""}
                    {` · saldo ${estoque.dosesDisponiveis}`}
                  </option>
                ))}
              </select>
              {loteZerado && (
                <small role="status" aria-live="polite" className="font-sans text-xs not-italic text-prejuizo">
                  Estoque zerado: o evento será salvo sem baixa de dose.
                </small>
              )}
            </RebField>
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
                <select className="rb-field-select" value={f.embriaoColetaId} onChange={(e) => set("embriaoColetaId", e.target.value)}>
                  <option value="">— usar doadora/touro manualmente —</option>
                  {embrioes.map((emb) => (
                    <option key={emb.id} value={emb.id}>
                      {`doadora ${emb.fertilizacao.coleta.doadora.nome ?? emb.fertilizacao.coleta.doadora.numero} · touro ${emb.fertilizacao.reprodutor.nome}${emb.classificacao ? ` · ${emb.classificacao.sigla}` : ""}`}
                    </option>
                  ))}
                </select>
              </RebField>
            )}
            {usaEstoque && <p style={{ margin: "-4px 0 8px", fontSize: 12, color: "var(--leite)" }}>Doadora e touro vêm do embrião selecionado.</p>}
            <RebField label="Doadora (genética)">
              <select className="rb-field-select" value={f.doadoraId} disabled={usaEstoque} onChange={(e) => set("doadoraId", e.target.value)}>
                <option value="">— selecionar —</option>
                {animais.filter((a) => a.id !== animalId).map((a) => (
                  <option key={a.id} value={a.id}>{rotuloAnimal(a.numero, a.nome)}</option>
                ))}
              </select>
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
            <RebField label="Resultado"><select className="rb-field-select" value={f.resultado} onChange={(e) => set("resultado", e.target.value)}><option value="positivo">Positivo</option><option value="negativo">Negativo</option></select></RebField>
            <RebField label="Parto previsto"><input type="date" value={f.dtPartoPrevista} onChange={(e) => set("dtPartoPrevista", e.target.value)} /></RebField>
          </>}
          {tipo === "PARTO" && <>
            <RebField label="Tipo de parto">
              <select className="rb-field-select" value={f.tipoParto} onChange={(e) => set("tipoParto", e.target.value)}>
                {TIPOS_PARTO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </RebField>
            {f.tipoParto === "2" && (
              <RebField label="Auxílio">
                <select className="rb-field-select" value={f.auxilioParto} onChange={(e) => set("auxilioParto", e.target.value)}>
                  {AUXILIOS_PARTO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </RebField>
            )}
            {f.tipoParto !== "3" && <>
              <RebField label="Crias vivas"><input type="number" min={0} max={3} value={f.criasVivas} onChange={(e) => set("criasVivas", e.target.value)} /></RebField>
              <RebField label="Natimortos"><input type="number" min={0} max={3} value={f.criasNatimortas} onChange={(e) => set("criasNatimortas", e.target.value)} /></RebField>
              <RebField label="Sexo da cria"><select className="rb-field-select" value={f.sexoCria} onChange={(e) => set("sexoCria", e.target.value)}><option value="F">Fêmea</option><option value="M">Macho</option><option value="FM">Gemelar · fêmea e macho</option><option value="MF">Gemelar · macho e fêmea</option></select></RebField>
              <RebField label="Destino da cria">
                <select className="rb-field-select" value={f.criaAcao} onChange={(e) => set("criaAcao", e.target.value)}>
                  <option value="nenhuma">Não cadastrar agora</option>
                  <option value="criar">Cadastrar a cria</option>
                  <option value="vincular">Vincular cria existente</option>
                </select>
              </RebField>
              {f.criaAcao === "criar" && (
                <RebField label="Número da cria*">
                  <input value={f.criaNumero} onChange={(e) => set("criaNumero", e.target.value)} placeholder="ex.: B-101" maxLength={20} />
                  {Number(f.criasVivas) > 1 && <small className="font-sans text-xs not-italic text-ink-3">As demais recebem sufixo -2, -3.</small>}
                </RebField>
              )}
              {f.criaAcao === "vincular" && (
                <RebField label="Cria existente*">
                  <select className="rb-field-select" value={f.criaId} onChange={(e) => set("criaId", e.target.value)}>
                    <option value="">— selecionar —</option>
                    {animais.filter((a) => a.id !== animalId && (a.categoria === "BEZERRA" || a.categoria === "BEZERRO")).map((a) => (
                      <option key={a.id} value={a.id}>{rotuloAnimal(a.numero, a.nome)}</option>
                    ))}
                  </select>
                  {Number(f.criasVivas) !== 1 && <small className="font-sans text-xs not-italic text-prejuizo">O vínculo exige exatamente uma cria viva.</small>}
                </RebField>
              )}
            </>}
          </>}
          {tipo === "SECAGEM" && (
            <RebField label="Motivo">
              <select className="rb-field-select" value={f.motivoSecagem} onChange={(e) => set("motivoSecagem", e.target.value)}>
                {MOTIVOS_SECAGEM.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </RebField>
          )}
          {tipo === "DESMAME" && (
            <RebField label="Peso ao desmame (kg)">
              <input type="number" min={0} step="0.1" value={f.pesoDesmame} onChange={(e) => set("pesoDesmame", e.target.value)} placeholder="opcional" />
            </RebField>
          )}
          {tipo === "EXAME_GINECOLOGICO" && <>
            <RebField label="Resultado oficial">
              <select className="rb-field-select" value={f.resultadoGinecologicoId} onChange={(e) => set("resultadoGinecologicoId", e.target.value)} disabled={resultadosGinecologicos.loading}>
                <option value="">{resultadosGinecologicos.loading ? "Carregando catálogo…" : "— selecionar —"}</option>
                {(resultadosGinecologicos.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.nomeResumido}{r.tipo ? ` · ${r.tipo.toLowerCase()}` : ""}</option>)}
              </select>
            </RebField>
            <RebField label="Achado operacional*">
              <select className="rb-field-select" value={f.achado} onChange={(e) => set("achado", e.target.value)}>
                {ACHADOS_GINE.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </RebField>
            <RebField label="Método">
              <select className="rb-field-select" value={f.metodoExame} onChange={(e) => set("metodoExame", e.target.value)}>
                {METODOS_EXAME.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </RebField>
          </>}
        </>}
        {dominio === "sanidade" && <SanidadeCampos tipoSan={tipoSan} f={f} set={set} setF={setF} produtosEstoque={produtosEstoque} />}
        <RebField label="Observação"><input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} /></RebField>
        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
