/* Autenticação alinhada à identidade Cooperativa contemporânea.
 *
 * A tela mantém o fluxo de sessão em estado, sem recarregar o documento depois
 * do login. O painel de contexto só aparece em telas largas; no celular a marca
 * e o formulário permanecem em uma única superfície, sem informação perdida.
 */

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";
import { TerranoSymbol } from "./TerranoLogo";
import { CampoSenha } from "./CampoSenha";

function IconeEmail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconeSenha() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function Login({ onEntrar }: { onEntrar?: (token: string, usuario: UsuarioSessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !senha || validando) return;

    setValidando(true);
    setErro(null);
    try {
      const { token, usuario } = await login(email.trim().toLowerCase(), senha);
      onEntrar?.(token, usuario);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha de rede.");
      setValidando(false);
    }
  };

  const campoInput =
    "h-11 rounded-lg border-[#c7d4ca] bg-white px-3 text-[15px] text-[#283c31] shadow-none placeholder:text-[#718178] focus-visible:border-[#24493b] focus-visible:ring-2 focus-visible:ring-[#24493b]/15 focus-visible:ring-offset-0";

  return (
    <main className="login-cooperativa min-h-[100dvh] bg-[#edf2ed] p-4 font-[family-name:var(--sans)] sm:p-6 lg:p-8">
      <div className="login-cooperativa__frame mx-auto grid min-h-[calc(100dvh-2rem)] max-w-[1240px] overflow-hidden rounded-2xl border border-[#d8e2da] bg-white shadow-[0_18px_48px_rgba(34,53,44,0.10)] sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(380px,0.9fr)_minmax(480px,1.1fr)] lg:rounded-[20px]">
        <aside className="login-cooperativa__context relative hidden overflow-hidden bg-[#24493b] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
            <div className="absolute -left-24 top-28 h-72 w-[130%] rounded-[50%] border border-[#a9c4ad]/30" />
            <div className="absolute -left-20 top-40 h-72 w-[130%] rounded-[50%] border border-[#a9c4ad]/25" />
            <div className="absolute -left-14 top-52 h-72 w-[130%] rounded-[50%] border border-[#a9c4ad]/20" />
            <div className="absolute -right-28 -bottom-36 h-80 w-80 rounded-full bg-[#91af95]/20 blur-3xl" />
          </div>

          <div className="relative flex items-center gap-2.5">
            <TerranoSymbol size={30} tone="dark" strokeWidth={4.2} />
            <span className="text-[19px] font-semibold tracking-[-0.02em]">Terrano</span>
          </div>

          <div className="relative max-w-[440px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c8dacb]">Gestão da fazenda</p>
            <h1 className="mt-5 text-[42px] font-semibold leading-[1.08] tracking-[-0.035em] xl:text-[50px]">
              Uma visão clara para decidir melhor, todos os dias.
            </h1>
            <p className="mt-5 max-w-[38ch] text-[16px] leading-7 text-[#d9e6dc]">
              Financeiro, estoque e pecuária trabalhando juntos no ritmo da sua operação.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3 border-t border-white/20 pt-6 text-[#e8f0e9]">
            {[
              ["Financeiro", "resultado"],
              ["Estoque", "controle"],
              ["Pecuária", "manejo"],
            ].map(([titulo, descricao]) => (
              <div key={titulo}>
                <p className="text-[13px] font-semibold">{titulo}</p>
                <p className="mt-1 text-[12px] text-[#c8dacb]">{descricao}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="login-cooperativa__form-panel flex min-h-full items-center justify-center bg-white px-6 py-10 sm:px-12 sm:py-14 lg:px-16">
          <form onSubmit={submeter} className="login-cooperativa__form w-full max-w-[408px]">
            <div className="mb-12 flex items-center gap-2.5 lg:hidden">
              <TerranoSymbol size={28} tone="light" strokeWidth={4.2} />
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#283c31]">Terrano</span>
            </div>

            <div>
              <p className="login-cooperativa__eyebrow text-[11px] font-bold uppercase tracking-[0.14em] text-[#55715e]">Acesse sua conta</p>
              <h2 className="login-cooperativa__title mt-3 text-[32px] font-semibold tracking-[-0.035em] text-[#283c31] sm:text-[36px]">Bem-vindo de volta</h2>
              <p className="login-cooperativa__subtitle mt-3 text-[15px] leading-6 text-[#56665f]">Entre com seus dados para acompanhar a operação.</p>
            </div>

            <div className="mt-9">
              <label htmlFor="login-email" className="mb-2 block text-[13px] font-semibold text-[#384b40]">E-mail</label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 flex h-[18px] w-[18px] text-[#718178]">
                  <IconeEmail />
                </span>
                <Input
                  id="login-email"
                  type="email"
                  autoFocus
                  autoComplete="username"
                  placeholder="voce@fazenda.com.br"
                  value={email}
                  disabled={validando}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${campoInput} pl-10`}
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="login-senha" className="block text-[13px] font-semibold text-[#384b40]">Senha</label>
                <a href="/forgot-password" className="text-[13px] font-semibold text-[#315b49] transition-colors hover:text-[#173a2c] hover:underline">Esqueci a senha</a>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-3 flex h-[18px] w-[18px] text-[#718178]">
                  <IconeSenha />
                </span>
                <CampoSenha
                  id="login-senha"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={senha}
                  disabled={validando}
                  onChange={(event) => setSenha(event.target.value)}
                  className={`${campoInput} pl-10`}
                />
              </div>
            </div>

            {erro && (
              <p role="alert" className="mt-5 rounded-lg border border-[#e7c4bf] bg-[#fbefec] px-3 py-2.5 text-[13px] leading-5 text-[#8d3931]">
                {erro}
              </p>
            )}

            <Button
              type="submit"
              disabled={!email || !senha || validando}
              className="login-cooperativa__submit group mt-7 h-11 w-full gap-2 rounded-lg bg-[#24493b] text-[15px] font-semibold text-white shadow-none transition-colors hover:bg-[#1b3a2e]"
            >
              {validando ? "Entrando…" : "Entrar"}
              {!validando && <IconeSeta />}
            </Button>

            <p className="login-cooperativa__footer mt-7 border-t border-[#e3ebe4] pt-5 text-center text-[13px] leading-5 text-[#64746b]">
              Ainda não tem acesso? <span className="font-semibold text-[#384b40]">Fale com o administrador.</span>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
