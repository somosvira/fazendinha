import { alterarControle } from "../../../lib/controles.fixture";
// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {SeletorCatalogoProtocolo} from "./SeletorCatalogoProtocolo";
import {reqProtocolo} from "./api";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),reqProtocolo:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("busca catálogo sob demanda com dez resultados e preserva referência inativa por ID",async()=>{
 vi.mocked(reqProtocolo).mockImplementation(async path=>{const q=new URL(path,"https://local").searchParams;const pagina=Number(q.get("pagina"));return q.has("selecionadoId")?{itens:[{id:"legado",nome:"Referência antiga",ativo:false}],total:1,pagina:1,porPagina:10}:{itens:Array.from({length:pagina===1?10:1},(_,i)=>({id:`p${(pagina-1)*10+i}`,nome:`Produto ${(pagina-1)*10+i+1}`,unidade:"ML"})),total:11,pagina,porPagina:10};});
 const onChange=vi.fn();render(<SeletorCatalogoProtocolo opcao="PRODUTO" origem="SANITARIO" rotulo="Produto" valor="legado" onChange={onChange}/>);
 await screen.findByText("Produto: Referência antiga");expect(onChange).not.toHaveBeenCalled();
 expect(new URL(vi.mocked(reqProtocolo).mock.calls[0][0],"https://local").searchParams.get("selecionadoId")).toBe("legado");
 fireEvent.click(screen.getByRole("button",{name:"Selecionar Produto"}));await screen.findByRole("button",{name:"Usar Produto 10"});
 expect(screen.getAllByRole("listitem")).toHaveLength(10);fireEvent.click(screen.getByRole("button",{name:"Próxima"}));
 fireEvent.click(await screen.findByRole("button",{name:"Usar Produto 11"}));expect(onChange).toHaveBeenCalledWith("p10",expect.objectContaining({unidade:"ML"}));
});
it("aparência de campo permite selecionar e voltar a Não selecionado", async () => {
 const listar = vi.fn().mockResolvedValue({itens:[{id:"tratamento",nome:"Tratamento"}],total:1,pagina:1,porPagina:10});
 const mudar = vi.fn();
 const props = {aparencia:"campo" as const,opcao:"TIPO_APLICACAO" as const,origem:"SANITARIO" as const,rotulo:"Tipo de aplicação padrão (opcional)",listarOpcoes:listar,onChange:mudar};
 const {rerender}=render(<SeletorCatalogoProtocolo {...props} valor=""/>);
 expect(screen.getByRole("combobox").textContent).toBe("Não selecionado");
 expect(listar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("combobox"));
 fireEvent.click(await screen.findByRole("option", { name: "Tratamento" }));
 expect(mudar).toHaveBeenCalledWith("tratamento",expect.objectContaining({nome:"Tratamento"}));
 rerender(<SeletorCatalogoProtocolo {...props} valor="tratamento"/>);
 await waitFor(()=>expect(screen.getByRole("combobox").textContent).toBe("Tratamento"));
 await alterarControle(screen.getByRole("combobox"), { target: { value: "__nao_selecionado__" } });
 expect(mudar).toHaveBeenLastCalledWith("", undefined);
});
