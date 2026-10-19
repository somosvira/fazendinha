import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = "http://localhost:41883/api";
const evidencias = [];
async function req(path, token, { method = "GET", body, sitio } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(sitio ? { "X-Propriedade-Id": String(sitio) } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
}
async function caso(nome, teste) { await teste(); evidencias.push(nome); console.log(`PASS ${nome}`); }
const tokens = {};
for (const perfil of ["dono", "consulta", "operador", "sem-area"]) {
  const r = await req("/auth/login", null, { method: "POST", body: { email: `${perfil}@qa.example.test`, senha: "QaInterface!2026" } });
  assert.equal(r.status, 200, JSON.stringify(r.body)); tokens[perfil] = r.body.token;
}
const sitios = (await req("/propriedades", tokens.dono)).body;
const sitio = sitios.find(s => s.nome === "QA Principal").id;
const destino = sitios.find(s => s.nome === "QA Destino").id;
const config = (await req("/financeiro/configuracoes", tokens.dono, { sitio })).body;
const produto = config.produtos.find(p => p.nome === "QA Ração");
const fornecedor = config.parceiros.find(p => p.nome === "QA Fornecedor");
const conta = config.contas.find(p => p.nome === "QA Conta");
const operacoes = (await req("/financeiro/operacoes", tokens.dono, { sitio })).body;
const op = operacoes.find(o => o.descricao === "QA Compra com valores restritos");
await caso("sem sessão recebe401", async () => assert.equal((await req("/financeiro/operacoes")).status, 401));
await caso("sem área não consulta financeiro nem rebanho", async () => {
  assert.equal((await req("/financeiro/operacoes", tokens["sem-area"])).status, 403);
  assert.equal((await req("/pecuaria/rebanho/animais", tokens["sem-area"])).status, 403);
});
await caso("consulta lê e não grava operação", async () => {
  assert.equal((await req(`/financeiro/operacoes/${op.id}`, tokens.consulta, { sitio })).status, 200);
  assert.equal((await req("/financeiro/operacoes", tokens.consulta, { method: "POST", sitio, body: {} })).status, 403);
});
await caso("operador recebe null nos valores e mantém quantidades", async () => {
  const r = await req(`/financeiro/operacoes/${op.id}`, tokens.operador, { sitio }); assert.equal(r.status, 200);
  assert.equal(r.body.valorTotal, null); assert.equal(r.body.itens[0].valorUnitario, null); assert.equal(r.body.itens[0].valorTotal, null);
  assert.equal(r.body.transacoes[0].valorTotal, null); assert.equal(r.body.transacoes[0].movimentos[0].valor, null);
  assert.equal(Number(r.body.itens[0].quantidade), 10);
});
await caso("operador não acessa agregados, PDF, contas ou rascunho", async () => {
  for (const path of ["/financeiro/dashboard", "/financeiro/compromissos", "/financeiro/contas", "/financeiro/relatorios", "/financeiro/operacoes/rascunho"]) assert.equal((await req(path, tokens.operador, { sitio })).status, 403, path);
});
await caso("operador não altera fato financeiro existente", async () => {
  assert.equal((await req(`/financeiro/operacoes/${op.id}/estorno`, tokens.operador, { sitio, method: "POST", body: { motivo: "QA" } })).status, 403);
});
await caso("sítio selecionado não lê operação de outro sítio", async () => {
  const r = await req(`/financeiro/operacoes/${op.id}`, tokens.dono, { sitio: destino }); assert.ok([403,404].includes(r.status), String(r.status));
});
await caso("operador grava preço manual e retry idempotente não duplica", async () => {
  const input = { chave: randomUUID(), tipo: "COMPRA_ESTOQUE", data: "2026-10-15", descricao: "QA Escrita manual operador", parceiroId: fornecedor.id, itens: [{ produtoId: produto.id, descricao: "QA Ração", quantidade: 2, unidade: "KG", valorUnitario: 11, estocavel: true }], valorTotal: 22, financeiro: { condicao: "A_VISTA", contaId: conta.id } };
  const a = await req("/financeiro/operacoes", tokens.operador, { sitio, method: "POST", body: input }); assert.equal(a.status, 201, JSON.stringify(a.body)); assert.equal(a.body.valorTotal, null);
  const b = await req("/financeiro/operacoes", tokens.operador, { sitio, method: "POST", body: input }); assert.ok(b.status >= 200 && b.status < 300, JSON.stringify(b)); assert.equal(a.body.id, b.body.id);
  const owner = await req(`/financeiro/operacoes/${a.body.id}`, tokens.dono, { sitio }); assert.equal(Number(owner.body.valorTotal), 22);
  const lista = await req("/financeiro/operacoes", tokens.dono, { sitio }); assert.equal(lista.body.filter(x => x.id === a.body.id).length, 1);
});
await caso("validação inválida não cria fato", async () => {
  const antes = (await req("/financeiro/operacoes", tokens.dono, { sitio })).body.length;
  const invalido = await req("/financeiro/operacoes", tokens.dono, { sitio, method: "POST", body: { tipo: "COMPRA_ESTOQUE", descricao: "" } }); assert.equal(invalido.status, 400);
  assert.equal((await req("/financeiro/operacoes", tokens.dono, { sitio })).body.length, antes);
});
console.log(JSON.stringify({ testes: evidencias.length, resultado: "aprovado", ambiente: "QA descartável, sem seed" }));
