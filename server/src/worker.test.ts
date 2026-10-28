import { describe,it,expect,vi,beforeEach } from "vitest";
const mock=vi.hoisted(()=>({env:{ALERTAS_CRON_ENABLED:false},criar:vi.fn(),avaliar:vi.fn(),disconnect:vi.fn(),fetch:vi.fn().mockResolvedValue(new Response("ok"))}));
vi.mock("./env.js",()=>({env:mock.env}));
vi.mock("./app.js",()=>({app:{fetch:mock.fetch}}));
vi.mock("./db.js",()=>({criarPrismaClient:mock.criar}));
vi.mock("./services/pecuaria/sanidade/alertas/avaliador.js",()=>({avaliarAlertasTemporais:mock.avaliar}));
import worker from "./worker.js";
describe("Worker fetch e scheduled",()=>{
 beforeEach(()=>{vi.clearAllMocks();mock.env.ALERTAS_CRON_ENABLED=false;mock.criar.mockReturnValue({$disconnect:mock.disconnect});});
 it("fetch mantém encaminhamento Hono",async()=>{const r=await worker.fetch(new Request("http://localhost/api/health"));expect(r.status).toBe(200);expect(mock.fetch).toHaveBeenCalledOnce();});
 it("cron fica desligado por padrão sem criar client",async()=>{await worker.scheduled({scheduledTime:0});expect(mock.criar).not.toHaveBeenCalled();});
 it("cada scheduled possui client e encerra mesmo em falha",async()=>{mock.env.ALERTAS_CRON_ENABLED=true;mock.avaliar.mockRejectedValueOnce(new Error("falha controlada"));await expect(worker.scheduled({scheduledTime:123})).rejects.toThrow("falha controlada");expect(mock.criar).toHaveBeenCalledOnce();expect(mock.avaliar).toHaveBeenCalledWith(expect.objectContaining({$disconnect:mock.disconnect}),new Date(123));expect(mock.disconnect).toHaveBeenCalledOnce();});
});
