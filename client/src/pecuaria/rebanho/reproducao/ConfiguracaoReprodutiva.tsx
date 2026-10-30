import { CriteriosAptidaoFormulario, ResumoCriteriosAptidao, grupoCriteriosVazio } from "./CriteriosAptidaoFormulario";
import { ModalPolitica } from "./ModalPolitica";
import { getHojeISO } from "../../../lib/hoje";
import { AjudaCampo } from "../../../components/Dica";
import { ConfiguracaoAcompanhamento } from "./ConfiguracaoAcompanhamento";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  criarPolitica,
  listarPoliticas,
  type ParametrosElegibilidade,
  type PapelElegibilidade,
  type PoliticaElegibilidade,
} from "./elegibilidade-api";
export function ConfiguracaoReprodutiva({
  propriedadeId,
  podeLancar,
}: {
  propriedadeId: number;
  podeLancar: boolean;
}) {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [vacas, setVacas] = useState(grupoCriteriosVazio);
  const [novilhas, setNovilhas] = useState(grupoCriteriosVazio);
  const [diasAvaliacao, setDiasAvaliacao] = useState<number | null>(null);
  const [motivoVersao, setMotivoVersao] = useState("");
  const [politicas, setPoliticas] = useState<PoliticaElegibilidade[]>([]);
  const [vigencia, setVigencia] = useState("");
  const [primiparas, setPrimiparas] = useState("");
  const [multiparas, setMultiparas] = useState("");
  const [aborto, setAborto] = useState("");
  const [pevAborto, setPevAborto] = useState("");
  const [descarte, setDescarte] = useState("");
  const [restricoes, setRestricoes] = useState("");
  const [perda, setPerda] = useState("");
  const [papeis, setPapeis] = useState<PapelElegibilidade[]>([]);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef(propriedadeId);
  ref.current = propriedadeId;
  const chave = useRef<{ assinatura: string; chave: string } | null>(null);
  useEffect(() => {
    let ativo = true;
    setPoliticas([]);
    setErro("");
    setMensagem("");
    setFormularioAberto(false);
    setCarregando(true);
    limparFormulario();
    void listarPoliticas(propriedadeId)
      .then((v) => {
        if (ativo) setPoliticas(v);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      }).finally(() => { if (ativo) setCarregando(false); });
    return () => {
      ativo = false;
    };
  }, [propriedadeId]);
  function limparFormulario() {
    setVigencia("");
    setPrimiparas("");
    setMultiparas("");
    setAborto("");
    setPevAborto("");
    setDescarte("");
    setRestricoes("");
    setPerda("");
    setPapeis([]); setVacas(grupoCriteriosVazio()); setNovilhas(grupoCriteriosVazio()); setDiasAvaliacao(null); setMotivoVersao("");
    chave.current = null;
  }
  function fecharFormulario() { setFormularioAberto(false); limparFormulario(); setErro(""); }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setErro("");
    setMensagem("");
    if (!papeis.length) {
      setErro("Selecione ao menos um papel reprodutivo incluído.");
      return;
    }
    const parametros: ParametrosElegibilidade = {
      versao: 2,
      criteriosAptidao: { vacas, novilhas, diasAvaliacaoPosParto: diasAvaliacao },
      metodologia: "IDEAGRI_IILB_BASE_V1",
      pevPrimiparasDias: Number(primiparas),
      pevMultiparasDias: Number(multiparas),
      aborto: aborto as ParametrosElegibilidade["aborto"],
      pevAposAbortoDias:
        aborto === "PEV_CONFIGURADO" ? Number(pevAborto) : null,
      descarte: descarte as ParametrosElegibilidade["descarte"],
      restricoes: restricoes as ParametrosElegibilidade["restricoes"],
      perdaGestacional: perda as ParametrosElegibilidade["perdaGestacional"],
      papeisIncluidos: papeis,
    };
    const input = { propriedadeId, vigenteDesde: vigencia, parametros, motivo: motivoVersao };
    const assinatura = JSON.stringify(input);
    if (chave.current?.assinatura !== assinatura)
      chave.current = { assinatura, chave: crypto.randomUUID() };
    setOcupado(true);
    try {
      await criarPolitica({ ...input, chave: chave.current.chave });
      const lista = await listarPoliticas(propriedadeId);
      if (ref.current === propriedadeId) {
        setPoliticas(lista);
        setFormularioAberto(false);
        limparFormulario();
        setMensagem(
          "Nova versão registrada. Os ciclos já vinculados conservam sua política.",
        );
      }
    } catch (e) {
      if (ref.current === propriedadeId)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar a política.",
        );
    } finally {
      setOcupado(false);
    }
  }
  const vigente = [...politicas].filter(p => p.vigenteDesde.slice(0, 10) <= getHojeISO()).sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao)[0];
  const politicasOrdenadas = [...politicas].sort((a, b) => Number(b.id === vigente?.id) - Number(a.id === vigente?.id) || b.vigenteDesde.localeCompare(a.vigenteDesde) || b.versao - a.versao);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Elegibilidade reprodutiva <AjudaCampo rotulo="Ajuda sobre elegibilidade reprodutiva" texto="Defina o período de espera voluntário (PEV) e as regras da fazenda. Os valores devem ser escolhidos com o responsável pelo manejo."/></h2>
        {podeLancar && <Button type="button" onClick={() => setFormularioAberto(true)}>Nova versão da política</Button>}
      </div>
      {erro && !formularioAberto && (
        <p role="alert" className="rounded border border-destructive p-3">
          {erro}
        </p>
      )}
      {mensagem && <p role="status">{mensagem}</p>}

      <div className="space-y-3">
        <h3 className="font-semibold">Versões preservadas</h3>
        {carregando && <p role="status">Carregando política…</p>}
        {!carregando && !erro && !politicas.length && <p>Nenhuma política registrada neste sítio.</p>}
        {politicasOrdenadas.map((p) => (
          <details key={p.id} open={p.id === vigente?.id} className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-medium">
              {p.id === vigente?.id && "Política vigente · "}Versão {p.versao} · vigente desde{" "}
              {p.vigenteDesde.slice(0, 10).split("-").reverse().join("/")}
            </summary>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt>PEV primeiro parto</dt>
                <dd>{p.parametros.pevPrimiparasDias} dias</dd>
              </div>
              <div>
                <dt>PEV demais partos</dt>
                <dd>{p.parametros.pevMultiparasDias} dias</dd>
              </div>
              <div>
                <dt>Aborto</dt>
                <dd>
                  {p.parametros.aborto === "PEV_CONFIGURADO"
                    ? `${p.parametros.pevAposAbortoDias} dias de PEV`
                    : "Liberação individual"}
                </dd>
              </div>
              <div>
                <dt>Descarte</dt>
                <dd>
                  {p.parametros.descarte === "EXCLUIR" ? "Excluir" : "Incluir"}
                </dd>
              </div>
              <div>
                <dt>Restrições</dt>
                <dd>
                  {p.parametros.restricoes === "EXCLUIR"
                    ? "Excluir enquanto vigentes"
                    : "Apenas alertar"}
                </dd>
              </div>
              <div>
                <dt>Perda gestacional</dt>
                <dd>
                  {p.parametros.perdaGestacional === "EXIGE_LIBERACAO"
                    ? "Exigir liberação"
                    : "Retomar ciclo"}
                </dd>
              </div>
              <div>
                <dt>Papéis incluídos</dt>
                <dd>
                  {p.parametros.papeisIncluidos
                    .map((v) =>
                      v === "NENHUM"
                        ? "Nenhum"
                        : v === "DOADORA"
                          ? "Doadora"
                          : "Receptora",
                    )
                    .join(", ")}
                </dd>
              </div>
            </dl>
            {p.parametros.criteriosAptidao && <div className="mt-4 space-y-3 border-t pt-3"><p>{p.parametros.criteriosAptidao.diasAvaliacaoPosParto === null ? "Sem disparo por dias pós-parto." : `Avaliação devida após ${p.parametros.criteriosAptidao.diasAvaliacaoPosParto} dias de parto comprovado.`}</p><ResumoCriteriosAptidao titulo="Vacas" valor={p.parametros.criteriosAptidao.vacas}/><ResumoCriteriosAptidao titulo="Novilhas" valor={p.parametros.criteriosAptidao.novilhas}/><p className="text-sm">Critérios indicam necessidade de avaliação; liberação exige toque apto e decisão individual.</p></div>}
            <p className="mt-3 text-sm text-muted-foreground">
              Base IDEAGRI/IILB — política de critérios {p.parametros.versao === 2 ? "com avaliação e decisão explícitas" : "histórica"}
            </p>
          </details>
        ))}
      </div>
      {podeLancar && formularioAberto && (
        <ModalPolitica aberto titulo="Nova versão da política" onFechar={fecharFormulario} bloqueado={ocupado} largura="sm:max-w-5xl" rodape={fechar => <><Button type="button" variant="outline" disabled={ocupado} onClick={fechar}>Cancelar</Button><Button form="nova-politica-reprodutiva" type="submit" disabled={ocupado}>{ocupado ? "Registrando…" : "Registrar versão da política"}</Button></>}>
        {erro && <p role="alert" className="mb-4 text-destructive">{erro}</p>}
        <form id="nova-politica-reprodutiva"
          onSubmit={salvar}
          className="space-y-4"
        >
          <fieldset disabled={ocupado} className="space-y-4 min-w-0">
          <p className="text-sm">Registrar nova versão <AjudaCampo rotulo="Ajuda sobre versões da política" texto="Cada ciclo conserva a versão aplicável ao seu início. Consultar um animal não cria vínculos. Ciclos antigos exigem associação explícita na ficha do animal."/></p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              Vigente desde
              <Input
                required
                type="date"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
              />
            </label>
            <label>
              PEV após primeiro parto (dias)
              <Input
                required
                type="number"
                min="0"
                max="2000"
                value={primiparas}
                onChange={(e) => setPrimiparas(e.target.value)}
              />
            </label>
            <label>
              PEV após demais partos (dias)
              <Input
                required
                type="number"
                min="0"
                max="2000"
                value={multiparas}
                onChange={(e) => setMultiparas(e.target.value)}
              />
            </label>
            <Escolha
              rotulo="Após aborto"
              valor={aborto}
              mudar={setAborto}
              opcoes={[
                ["PEV_CONFIGURADO", "Cumprir PEV específico"],
                ["LIBERACAO_EXPLICITA", "Exigir liberação individual"],
              ]}
            />
            {aborto === "PEV_CONFIGURADO" && (
              <label>
                PEV após aborto (dias)
                <Input
                  required
                  type="number"
                  min="0"
                  max="2000"
                  value={pevAborto}
                  onChange={(e) => setPevAborto(e.target.value)}
                />
              </label>
            )}
            <Escolha
              rotulo="Matrizes em descarte"
              valor={descarte}
              mudar={setDescarte}
              opcoes={[
                ["EXCLUIR", "Excluir do denominador"],
                ["INCLUIR", "Incluir no denominador"],
              ]}
            />
            <Escolha
              rotulo="Restrições reprodutivas"
              valor={restricoes}
              mudar={setRestricoes}
              opcoes={[
                ["EXCLUIR", "Excluir enquanto vigentes"],
                ["APENAS_ALERTAR", "Apenas alertar"],
              ]}
            />
            <Escolha
              rotulo="Após perda gestacional"
              valor={perda}
              mudar={setPerda}
              opcoes={[
                ["EXIGE_LIBERACAO", "Exigir nova liberação"],
                ["RETOMAR_CICLO", "Retomar regras do ciclo"],
              ]}
            />
          </div>
          <div className="border-t pt-5">
            <h3 className="text-lg font-semibold">Critérios de avaliação reprodutiva</h3>
            <p className="mt-1 text-sm text-muted-foreground">Somente critérios selecionados exigem evidência. Quando combinados, todos precisam ser atendidos. Avaliação devida não agenda nem determina aptidão.</p>
            <label className="my-3 flex items-center gap-2"><input type="checkbox" checked={diasAvaliacao !== null} onChange={e => setDiasAvaliacao(e.target.checked ? 45 : null)}/>Solicitar avaliação após parto comprovado</label>
            {diasAvaliacao !== null && <label>Dias após parto comprovado<Input required type="number" min={0} max={2000} value={diasAvaliacao} onChange={e => setDiasAvaliacao(Number(e.target.value))}/><span className="text-sm text-muted-foreground">Referência: 45 dias. Ajuste explicitamente com o responsável pelo manejo.</span></label>}
            <div className="mt-5 grid gap-8 lg:grid-cols-2"><CriteriosAptidaoFormulario titulo="Vacas" valor={vacas} onChange={setVacas}/><CriteriosAptidaoFormulario titulo="Novilhas" valor={novilhas} onChange={setNovilhas}/></div>
            <p className="mt-3 text-sm text-muted-foreground">Sem critérios de disparo, o agendamento continua manual. Pesos sem precisão informada não são aceitos como medida.</p>
            <label className="mt-4 block">Motivo da nova versão<Input required minLength={5} maxLength={1000} value={motivoVersao} onChange={e => setMotivoVersao(e.target.value)}/></label>
          </div>
          <fieldset>
            <legend className="mb-2">Papéis incluídos na elegibilidade <AjudaCampo rotulo="Ajuda sobre a elegibilidade de novilhas" texto="Novilhas dependem da situação inicial com “apta desde” ou de liberação individual. Idade e DEL não liberam automaticamente."/></legend>
            {(
              [
                ["NENHUM", "Nenhum"],
                ["DOADORA", "Doadora"],
                ["RECEPTORA", "Receptora"],
              ] as const
            ).map(([id, nome]) => (
              <label className="mr-5 inline-flex gap-2" key={id}>
                <input
                  type="checkbox"
                  checked={papeis.includes(id)}
                  onChange={() =>
                    setPapeis(
                      papeis.includes(id)
                        ? papeis.filter((p) => p !== id)
                        : [...papeis, id],
                    )
                  }
                />
                {nome}
              </label>
            ))}
          </fieldset>

          </fieldset>
        </form>
        </ModalPolitica>
      )}
      <ConfiguracaoAcompanhamento propriedadeId={propriedadeId} podeLancar={podeLancar}/>
    </section>
  );
}
function Escolha({
  rotulo,
  valor,
  mudar,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  opcoes: string[][];
}) {
  return (
    <label>
      {rotulo}
      <select
        required
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3"
      >
        <option value="">Selecione a regra</option>
        {opcoes.map(([v, t]) => (
          <option value={v} key={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
