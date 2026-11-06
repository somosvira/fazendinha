import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "@/financeiro/SelectCampo";
export type DestinoConsumoSanitario = "DEVOLVER_ESTOQUE" | "MANTER_CONSUMO";
export type SituacaoAdministracao = "" | "CONFIRMADA" | "DESCARTADA" | "DESCONHECIDA";
export function administracaoMantida(situacao: Exclude<SituacaoAdministracao, "">): boolean | null {
  return situacao === "CONFIRMADA" ? true : situacao === "DESCARTADA" ? false : null;
}
export function DestinoConsumo({valor, onChange, administracao, onAdministracao}: {valor: DestinoConsumoSanitario | ""; onChange: (v: DestinoConsumoSanitario | "") => void; administracao: SituacaoAdministracao; onAdministracao: (v: SituacaoAdministracao) => void}) {
  return <><label className="grid gap-2 text-sm">Destino do material
    <SelectCampo aria-label="Destino do material" required className={classeInput} value={valor} onValueChange={(valor) => onChange(valor as DestinoConsumoSanitario | "")}>
      <option value="">Selecione o destino físico</option>
      <option value="DEVOLVER_ESTOQUE">Material não usado — devolver ao estoque</option>
      <option value="MANTER_CONSUMO">Material usado ou descartado — manter consumo</option>
    </SelectCampo>
    <span>A anulação preserva o histórico. Só material não utilizado pode voltar ao estoque.</span>
  </label>
  {valor === "MANTER_CONSUMO" && <label className="grid gap-2 text-sm">Situação da administração
    <SelectCampo aria-label="Situação da administração" required className={classeInput} value={administracao} onValueChange={(valor) => onAdministracao(valor as SituacaoAdministracao)}>
      <option value="">Confirme a administração ou sua incerteza</option>
      <option value="CONFIRMADA">A administração registrada aconteceu e os dados/carências estão corretos</option>
      <option value="DESCARTADA">Material descartado, sem administração neste animal</option>
      <option value="DESCONHECIDA">Não é possível confirmar a administração/dados</option>
    </SelectCampo>
    <span>Manter o consumo não comprova administração. Quando não for possível confirmar, a carência permanece desconhecida e exige revisão.</span>
  </label>}
  </>;
}
