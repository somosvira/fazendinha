// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {cleanup,render,screen,fireEvent,waitFor} from "@testing-library/react";
import {useState} from "react";
import {PainelCadastro} from "./PainelCadastro";
import {DialogFinanceiro} from "./DialogFinanceiro";
afterEach(cleanup);
function Aninhado({onFecharPai}:{onFecharPai:()=>void}){const [aberto,setAberto]=useState(false);return <DialogFinanceiro titulo="Cuidado" eyebrow="" onClose={onFecharPai}><button onClick={()=>setAberto(true)}>Adiar cuidado</button>{aberto&&<PainelCadastro aberto compacto camada="sobreDetalhe" titulo="Adiar" onFechar={()=>setAberto(false)} rodape={<button type="button">Confirmar adiamento</button>}><label>Motivo<input/></label></PainelCadastro>}</DialogFinanceiro>;}
describe("painel aberto sobre detalhe",()=>{
 it("preserva camada padrão para consumidores existentes",()=>{render(<PainelCadastro aberto compacto titulo="Cadastro" onFechar={vi.fn()} rodape={null}><p>Corpo</p></PainelCadastro>);expect(screen.getByRole("dialog").classList.contains("z-[1100]")).toBe(true);});
 it("eleva só o filho e seu descarte; cancelar/descartar preservam o pai",async()=>{const fecharPai=vi.fn();render(<Aninhado onFecharPai={fecharPai}/>);fireEvent.click(screen.getByRole("button",{name:"Adiar cuidado"}));const filho=screen.getByRole("dialog",{name:"Adiar"});expect(filho.classList.contains("z-[1300]")).toBe(true);fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Motivo editado"}});fireEvent.keyDown(document.activeElement??document.body,{key:"Escape"});await screen.findByText("Descartar alterações?");expect(screen.getByRole("dialog",{name:"Descartar alterações?"}).classList.contains("z-[1400]")).toBe(true);fireEvent.click(screen.getByRole("button",{name:"Continuar editando"}));await waitFor(()=>expect(screen.queryByText("Descartar alterações?")).toBeNull());expect(screen.getByRole("dialog",{name:"Adiar"})).toBeTruthy();fireEvent.keyDown(document.activeElement??document.body,{key:"Escape"});await screen.findByText("Descartar alterações?");fireEvent.click(screen.getByRole("button",{name:"Descartar alterações"}));await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Adiar"})).toBeNull());expect(screen.getByRole("dialog",{name:"Cuidado"})).toBeTruthy();expect(fecharPai).not.toHaveBeenCalled();});
});
