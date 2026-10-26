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
    setVigencia("");
    setPrimiparas("");
    setMultiparas("");
    setAborto("");
    setPevAborto("");
    setDescarte("");
    setRestricoes("");
    setPerda("");
    setPapeis([]);
    void listarPoliticas(propriedadeId)
      .then((v) => {
        if (ativo) setPoliticas(v);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [propriedadeId]);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    if (!papeis.length) {
      setErro("Selecione ao menos um papel reprodutivo incluído.");
      return;
    }
    const parametros: ParametrosElegibilidade = {
      versao: 1,
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
    const input = { propriedadeId, vigenteDesde: vigencia, parametros };
    const assinatura = JSON.stringify(input);
    if (chave.current?.assinatura !== assinatura)
      chave.current = { assinatura, chave: crypto.randomUUID() };
    setOcupado(true);
    try {
      await criarPolitica({ ...input, chave: chave.current.chave });
      const lista = await listarPoliticas(propriedadeId);
      if (ref.current === propriedadeId) {
        setPoliticas(lista);
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
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Elegibilidade reprodutiva <AjudaCampo rotulo="Ajuda sobre elegibilidade reprodutiva" texto="Defina o período de espera voluntário (PEV) e as regras da fazenda. Os valores devem ser escolhidos com o responsável pelo manejo."/></h2>

      </div>
      {erro && (
        <p role="alert" className="rounded border border-destructive p-3">
          {erro}
        </p>
      )}
      {mensagem && <p role="status">{mensagem}</p>}
      {podeLancar && (
        <form
          onSubmit={salvar}
          className="space-y-4 rounded-xl border bg-card p-5"
        >
          <h3 className="font-semibold">Registrar nova versão <AjudaCampo rotulo="Ajuda sobre versões da política" texto="Cada ciclo conserva a versão aplicável ao seu início. Consultar um animal não cria vínculos. Ciclos antigos exigem associação explícita na ficha do animal."/></h3>

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

          <Button disabled={ocupado} type="submit">
            {ocupado ? "Registrando…" : "Registrar versão da política"}
          </Button>
        </form>
      )}
      <div className="space-y-3">
        <h3 className="font-semibold">Versões preservadas</h3>
        {!politicas.length && <p>Nenhuma política registrada neste sítio.</p>}
        {politicas.map((p) => (
          <details key={p.id} className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-medium">
              Versão {p.versao} · vigente desde{" "}
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
            <p className="mt-3 text-sm text-muted-foreground">
              Base IDEAGRI/IILB — metodologia Fazendinha v1
            </p>
          </details>
        ))}
      </div>
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
