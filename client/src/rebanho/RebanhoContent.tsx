import { useEffect, useRef, useState } from "react";
import { Loader } from "../components/Loading";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { AnimalTab } from "./components/AnimalTab";
import { ReproducaoTab } from "./components/ReproducaoTab";
import { FivTab } from "./components/FivTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { ProducaoTab } from "./components/ProducaoTab";
import { EstoqueContent } from "../estoque/EstoqueContent";
import { obterCentrosAtividade } from "../estoque/api";
import { CustoProducaoTab } from "./components/CustoProducaoTab";
import { CarteiraTab } from "./components/CarteiraTab";
import { SugestoesTab } from "./components/SugestoesTab";
import { AcasalamentoHub } from "./components/AcasalamentoHub";
import { RelatoriosTab } from "./components/RelatoriosTab";
import { AnimalForm } from "./components/AnimalForm";
import { EventoForm } from "./components/EventoForm";
import { DashboardView } from "./components/DashboardView";
import type { Animal } from "./types";
import type { ChaveWorklistRebanho, EventoPayload, EventoSanidadePayload, LinhaRelatorioRebanhoDTO, ResultadoRelatorioRebanhoDTO, WorklistRebanho } from "./api";
import type { AcaoItemWorklist } from "./components/WorklistCanonica";
import { HOJE } from "./HOJE";

export type RebSub = "dashboard" | "animal" | "reproducao" | "acasalamento" | "fiv" | "relatorios" | "sanidade" | "nutricao" | "producao" | "estoque" | "custo" | "carteira" | "sugestoes";

export function RebanhoContent({ aba, onNavReb, onAbrirWorklist, worklistChave, worklistSnapshot, abrirId, onAbriuEntidade }: { aba: RebSub; onNavReb?: (aba: RebSub) => void; onAbrirWorklist?: (worklist: WorklistRebanho) => void; worklistChave?: ChaveWorklistRebanho; worklistSnapshot?: WorklistRebanho; abrirId?: string; onAbriuEntidade?: () => void }) {
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; animal?: Animal } | null>(null);
  const [registroInline, setRegistroInline] = useState<{
    animal: Animal | Pick<Animal, "id" | "numero" | "nome" | "categoria">;
    dominio: "reproducao" | "sanidade";
    tipoInicial?: { dominio: "reproducao"; tipo: EventoPayload["tipo"] } | { dominio: "sanidade"; tipo: EventoSanidadePayload["tipo"] };
    dataInicial?: string;
    // Para onde ir após salvar: lista/relatório mantêm o contexto operacional;
    // "cockpit" abre a ficha do animal (registro genérico). Ausente = "cockpit".
    retorno?: "lista" | "relatorio" | "cockpit";
  } | null>(null);
  const [flashEventoId, setFlashEventoId] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [recarga, setRecarga] = useState(0);
  const [recargaRelatorio, setRecargaRelatorio] = useState(0);
  // `undefined` = ainda resolvendo o centro de atividade (mostra Loader em vez
  // de montar o EstoqueContent, evitando a busca de saldos sem filtro); `null`
  // = resolvido, mas sem centro cadastrado. O `key` no EstoqueContent remonta o
  // componente quando o centro muda, então ele já nasce com o filtro certo.
  const [centroCustoEstoque, setCentroCustoEstoque] = useState<number | null | undefined>(undefined);
  const [avisoEstoque, setAvisoEstoque] = useState<string | undefined>(undefined);
  // Filtro inicial da tela de Estoque: resolve o centro "Atividade Leiteira" (mesma
  // constante usada em custo-producao.ts, via /estoque/centros-atividade), uma vez,
  // quando a aba Estoque é aberta.
  useEffect(() => {
    if (aba !== "estoque") return;
    let cancelado = false;
    obterCentrosAtividade().then((centros) => {
      if (cancelado) return;
      setCentroCustoEstoque(centros.leite);
      setAvisoEstoque(centros.leite == null ? "Centro da atividade não cadastrado — mostrando todos os produtos." : undefined);
    }).catch((e) => {
      if (cancelado) return;
      setCentroCustoEstoque(null);
      setAvisoEstoque(`Não foi possível resolver o centro da atividade leiteira: ${e instanceof Error ? e.message : String(e)}`);
    });
    return () => { cancelado = true; };
  }, [aba]);
  // O sítio ativo (multi-propriedade) é governado pelo shell (App): trocar lá
  // remonta este conteúdo inteiro via `key`, então aqui não há estado de escopo.

  // Quando ReproducaoTab/SanidadeTab salva e a gente quer pousar na ficha do Animal,
  // a navegação chega via onNavReb("animal"), o que dispara o efeito abaixo. A ref guarda
  // o id que deve ser aberto, para sobreviver à mudança de prop `aba`.
  const proximoAnimalRef = useRef<string | null>(null);

  // A ficha do animal possui rota própria. Centralizar a abertura aqui evita
  // manter um cockpit "por cima" da rota de Sanidade/Reprodução/Estoque.
  const abrirAnimal = (id: string) => {
    if (aba === "animal") {
      setAnimalId(id);
      return;
    }
    proximoAnimalRef.current = id;
    onNavReb?.("animal");
  };

  // A rota sempre vence o estado local do cockpit. A referência transitória só
  // pode abrir uma ficha quando o destino é explicitamente a aba Animal; se ela
  // sobreviver a uma recarga/mutação, nunca deve prender a UI ao animal ao navegar
  // para Estoque, Sanidade ou qualquer outra aba.
  useEffect(() => {
    if (aba === "animal" && proximoAnimalRef.current) {
      setAnimalId(proximoAnimalRef.current);
      proximoAnimalRef.current = null;
    } else {
      proximoAnimalRef.current = null;
      setAnimalId(null);
      setFlashEventoId(null);
    }
    // Formulários pertencem à tela de origem e não podem manter um overlay sobre
    // a nova rota quando a pessoa navega logo após salvar/editar/excluir.
    setForm(null);
    setRegistroInline(null);
  }, [aba]);

  // Deep-link do ⌘K: quando `abrirId` muda, abrimos a ficha desse animal usando
  // a mesma ref, para o efeito [aba] acima não limpar o cockpit recém-aberto.
  useEffect(() => {
    if (!abrirId) return;
    proximoAnimalRef.current = abrirId;
    setAnimalId(abrirId);
    onAbriuEntidade?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);

  const registrarDaWorklist = ({ item, worklist }: AcaoItemWorklist) => {
    if (!worklist.acao) return; // worklist de só visualização (ex.: carência) não registra evento
    const animal = { id: String(item.animalId), numero: item.numero, nome: item.nome ?? "", categoria: (item.categoria ?? "VACA") as Animal["categoria"] };
    const tipoInicial = worklist.acao.dominio === "reproducao"
      ? { dominio: "reproducao" as const, tipo: worklist.acao.tipoEvento as EventoPayload["tipo"] }
      : { dominio: "sanidade" as const, tipo: worklist.acao.tipoEvento as EventoSanidadePayload["tipo"] };
    // Secagem já abre com a data de hoje pra a pessoa só confirmar o motivo.
    const dataInicial = worklist.acao.tipoEvento === "SECAGEM" ? HOJE : undefined;
    setRegistroInline({ animal, dominio: worklist.acao.dominio, tipoInicial, dataInicial, retorno: "lista" });
  };

  const registrarDoRelatorio = ({ linha, acao }: { linha: LinhaRelatorioRebanhoDTO; acao: NonNullable<ResultadoRelatorioRebanhoDTO["acao"]> }) => {
    const animal = { id: String(linha.animalId), numero: linha.numero, nome: linha.nome ?? "", categoria: linha.categoria as Animal["categoria"] };
    const tipoInicial = { dominio: "reproducao" as const, tipo: acao.tipoEvento as EventoPayload["tipo"] };
    const dataInicial = acao.tipoEvento === "SECAGEM" ? HOJE : undefined;
    setRegistroInline({ animal, dominio: "reproducao", tipoInicial, dataInicial, retorno: "relatorio" });
  };

  return (
    <div className="rb">
      {aba === "animal" && animalId
        ? <AnimalCockpit key={recarga} animalId={animalId} onVoltar={() => setAnimalId(null)} onAbrirAnimal={abrirAnimal} onEditar={(a) => setForm({ modo: "editar", animal: a })} onBaixa={(a) => setForm({ modo: "baixa", animal: a })} flashEventoId={flashEventoId} flashKey={flashKey} />
        : aba === "animal"
          ? <AnimalTab key={recarga} onAbrirAnimal={abrirAnimal} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "reproducao"
            ? <ReproducaoTab key={recarga} onRegistrarEvento={(animal) => setRegistroInline({ animal, dominio: "reproducao", retorno: "cockpit" })} onRegistrarWorklist={registrarDaWorklist} onAbrirFicha={abrirAnimal} worklistChave={worklistChave} worklistSnapshot={worklistSnapshot} />
            : aba === "acasalamento"
              ? <AcasalamentoHub onAbrirFicha={abrirAnimal} />
            : aba === "fiv"
              ? <FivTab key={recarga} />
            : aba === "relatorios"
              ? <RelatoriosTab onAbrirFicha={abrirAnimal} onRegistrar={registrarDoRelatorio} refreshToken={recargaRelatorio} />
            : aba === "sanidade"
              ? <SanidadeTab key={recarga} onRegistrarEvento={(animal) => setRegistroInline({ animal, dominio: "sanidade", retorno: "cockpit" })} onRegistrarWorklist={registrarDaWorklist} onAbrirFicha={abrirAnimal} worklistChave={worklistChave} worklistSnapshot={worklistSnapshot} />
              : aba === "nutricao"
                ? <NutricaoTab />
                : aba === "producao"
                  ? <ProducaoTab />
                  : aba === "estoque"
                    ? (centroCustoEstoque === undefined
                        ? <Loader />
                        : <EstoqueContent key={String(centroCustoEstoque)} centroCustoIdInicial={centroCustoEstoque} titulo="Estoque" avisoFiltro={avisoEstoque} />)
                    : aba === "custo"
                      ? <CustoProducaoTab />
                      : aba === "carteira"
                        ? <CarteiraTab onAbrirFicha={(id) => abrirAnimal(String(id))} />
                        : aba === "sugestoes"
                          ? <SugestoesTab onNav={(t) => onNavReb?.(t as RebSub)} onAbrirFicha={(id) => abrirAnimal(String(id))} />
                        : <DashboardView onNav={(t) => onNavReb?.(t as RebSub)} onAbrirWorklist={onAbrirWorklist} />}
      {form && <AnimalForm modo={form.modo} animal={form.animal} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
      {registroInline && (
        <EventoForm
          animalId={registroInline.animal.id}
          animal={registroInline.animal}
          dominioFixo={registroInline.dominio}
          tipoInicial={registroInline.tipoInicial}
          dataInicial={registroInline.dataInicial}
          onFechar={() => setRegistroInline(null)}
          onSalvo={(evento) => {
            const idAnimal = registroInline.animal.id;
            const retorno = registroInline.retorno ?? "cockpit";
            setRegistroInline(null);
            if (retorno === "lista") {
              // Permanece na fila; remontar a aba (via key=recarga) refaz o fetch da worklist,
              // e o animal recém-tratado sai da lista porque o resumo não satisfaz mais a regra.
              setRecarga((n) => n + 1);
              return;
            }
            if (retorno === "relatorio") {
              // Mantém o formulário e os filtros; só repete a consulta já aplicada.
              setRecargaRelatorio((n) => n + 1);
              return;
            }
            setFlashEventoId(evento?.id ?? null);
            setFlashKey((n) => n + 1);
            proximoAnimalRef.current = idAnimal;
            onNavReb?.("animal");
          }}
        />
      )}
    </div>
  );
}
