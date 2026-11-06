import { SelectCampo } from "@/financeiro/SelectCampo";
import { useEffect, useState } from "react";
import { Syringe } from "lucide-react";
import { buscarFichaAnimal, listarAnimais } from "../api";
import type { AnimalResumo } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { FormAplicacaoServico } from "./FormAplicacaoServico";
import { nomeAnimalSanitario } from "./rotulos";

export function FormAplicacaoAnimal({ animalInicial, onFechar, onSalvo }: { animalInicial: string; onFechar: () => void; onSalvo: (id?: string, sitio?: number) => void }) {
  const [animalId, setAnimalId] = useState(animalInicial);
  const [busca, setBusca] = useState("");
  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [animal, setAnimal] = useState<AnimalResumo | null>(null);
  const [continuar, setContinuar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  // Espera a digitação parar antes de buscar: com milhares de animais, cada tecla seria uma consulta.
  useEffect(() => { let vivo = true; const t = setTimeout(() => listarAnimais({ pageSize: 100, busca }).then((r) => { if (vivo) { setAnimais(r.itens); setTotal(r.total ?? r.itens.length); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }), busca ? 250 : 0); return () => { vivo = false; clearTimeout(t); }; }, [busca]);
  useEffect(() => { let vivo = true; setAnimal(null); if (animalId) buscarFichaAnimal(animalId).then((r) => { if (vivo) setAnimal(r); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId]);
  const sitio = animal?.propriedade?.id;
  if (continuar && sitio) return <FormAplicacaoServico animalId={animalId} propriedadeId={sitio} onFechar={onFechar} onSalvo={onSalvo} />;
  return <PainelCadastro aberto compacto icon={Syringe} titulo="Registrar aplicação sanitária" onFechar={onFechar} rodape={fechar => <><Button secondary onClick={fechar}>Cancelar</Button><Button disabled={!sitio} onClick={() => setContinuar(true)}>Continuar</Button></>}><div data-pec-formulario className="grid gap-4"><ErrorBox erro={erro} /><label>Buscar animal<input className={classeInput} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Brinco ou nome" /></label><label>Animal<SelectCampo className={classeInput} value={animalId} onValueChange={(valorSelecionado) => setAnimalId(valorSelecionado)}><option value="">Selecione</option>{animal && !animais.some((a) => a.id === animal.id) && <option value={animal.id}>{nomeAnimalSanitario(animal)}</option>}{animais.map((a) => <option key={a.id} value={a.id}>{nomeAnimalSanitario(a)}</option>)}</SelectCampo>{total > animais.length && <span className="mt-1 block text-xs text-ink-3">Mostrando {animais.length} de {total.toLocaleString("pt-BR")} animais. Busque pelo brinco ou nome para encontrar os demais.</span>}</label></div></PainelCadastro>;
}
