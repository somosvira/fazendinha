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
  useEffect(() => { let vivo = true; listarAnimais({ pageSize: 100, busca }).then((r) => { if (vivo) setAnimais(r.itens); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [busca]);
  useEffect(() => { let vivo = true; setAnimal(null); if (animalId) buscarFichaAnimal(animalId).then((r) => { if (vivo) setAnimal(r); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId]);
  const sitio = animal?.propriedade?.id;
  if (continuar && sitio) return <FormAplicacaoServico animalId={animalId} propriedadeId={sitio} onFechar={onFechar} onSalvo={onSalvo} />;
  return <PainelCadastro aberto compacto icon={Syringe} titulo="Registrar aplicação sanitária" onFechar={onFechar} rodape={<Button disabled={!sitio} onClick={() => setContinuar(true)}>Continuar</Button>}><div data-pec-formulario className="grid gap-4"><ErrorBox erro={erro} /><label>Buscar animal<input className={classeInput} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Brinco ou nome" /></label><label>Animal<SelectCampo className={classeInput} value={animalId} onValueChange={(valorSelecionado) => setAnimalId(valorSelecionado)}><option value="">Selecione</option>{animal && !animais.some((a) => a.id === animal.id) && <option value={animal.id}>{nomeAnimalSanitario(animal)}</option>}{animais.map((a) => <option key={a.id} value={a.id}>{nomeAnimalSanitario(a)}</option>)}</SelectCampo></label></div></PainelCadastro>;
}
