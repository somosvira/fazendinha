/* Tela de login — e-mail + senha (usuários reais do backend).
 *
 * Design "Login — Terrano" (importado do Claude Design): split-panel — painel
 * de marca escuro à esquerda (símbolo Terrano + headline + números da fazenda)
 * e formulário à direita. Abaixo de 900px o painel de marca some e o form ocupa
 * a tela inteira.
 *
 * `onEntrar` recebe o token de sessão e o usuário validados pelo backend. Quem
 * chama (App) persiste a sessão e transiciona pro app EM ESTADO — sem
 * window.location.reload(). O reload mataria a "sticky activation" do documento
 * e a música da abertura Terrano, ancorada neste clique, voltaria a ser
 * bloqueada.
 *
 * Adaptações ao backend da fatia 1 (email+senha próprio, sem OAuth): o mockup
 * trazia "Continuar com Google" (sem backend → omitido) e "Esqueci a senha"
 * (reset é por link gerado pelo proprietário → o link revela essa instrução em
 * vez de navegar). Cores/tipografia usam os tokens do tema (var(--…)). */

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";
import { TerranoSymbol } from "./TerranoLogo";

function IconeEmail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function IconeSenha() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function IconeOlho() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[17px] w-[17px] transition-transform duration-200 group-hover:translate-x-[3px]" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Login({ onEntrar }: { onEntrar?: (token: string, usuario: UsuarioSessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dicaReset, setDicaReset] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !senha || validando) return;
    setValidando(true);
    setErro(null);
    try {
      const { token, usuario } = await login(email.trim().toLowerCase(), senha);
      onEntrar?.(token, usuario);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha de rede.");
      setValidando(false);
    }
  };

  const campoInput =
    "border-[color:var(--rule)] bg-[color:var(--bg-card)] text-[15px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-mute)] rounded-[10px] h-auto py-3 focus-visible:border-[color:var(--cafe)] focus-visible:bg-white focus-visible:ring-[color:var(--cafe)]/15 focus-visible:ring-offset-0";

  return (
    <div className="grid min-h-screen grid-cols-1 min-[900px]:grid-cols-[1.05fr_0.95fr] bg-[color:var(--bg)] font-[family-name:var(--sans)]">
      {/* ---------------- painel de marca (esquerda) ---------------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[color:var(--mast-bg)] px-14 py-[52px] text-[color:var(--mast-ink)] min-[900px]:flex">
        {/* brilho de campo (sol nascente + terra) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 0%, rgba(184,154,92,.16), transparent 60%), radial-gradient(90% 70% at 100% 100%, rgba(92,58,30,.5), transparent 55%)",
          }}
          aria-hidden
        />
        {/* textura de campo: linhas de plantio */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 600 800" preserveAspectRatio="none" aria-hidden>
          <g fill="none" stroke="rgba(184,154,92,.14)" strokeWidth={1.2}>
            <path d="M-40 300 C 180 240, 420 240, 640 300" />
            <path d="M-40 360 C 180 300, 420 300, 640 360" />
            <path d="M-40 420 C 180 360, 420 360, 640 420" />
            <path d="M-40 480 C 180 420, 420 420, 640 480" />
            <path d="M-40 540 C 180 480, 420 480, 640 540" />
            <path d="M-40 600 C 180 540, 420 540, 640 600" />
            <path d="M-40 660 C 180 600, 420 600, 640 660" />
          </g>
        </svg>

        <div className="relative z-[2] flex items-center gap-3">
          <TerranoSymbol size={34} tone="dark" strokeWidth={4.4} />
          <span className="font-[family-name:var(--serif)] text-[26px] font-medium tracking-[-0.01em]">Terrano</span>
        </div>

        <div className="relative z-[2] max-w-[22ch]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--leite)]">
            Gestão de fazendas
          </div>
          <h1 className="mt-[18px] font-[family-name:var(--serif)] text-[52px] font-normal leading-[1.06] tracking-[-0.02em]">
            O campo em <em className="italic text-[color:var(--leite)]">números</em> que você entende.
          </h1>
          <p className="mt-5 max-w-[34ch] text-[15px] leading-[1.6] text-[color:var(--side-mute)]">
            Leite, café, gado e equipe — o resultado de cada atividade, mês a mês, sem planilha.
          </p>
        </div>

        <div className="relative z-[2] flex gap-[34px]">
          {[
            { n: "8.412", k: "lançamentos" },
            { n: "23", k: "meses" },
            { n: "4", k: "atividades" },
          ].map((s) => (
            <div key={s.k}>
              <div className="font-[family-name:var(--serif)] text-[26px] tabular-nums">{s.n}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--side-mute)]">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-[22px] left-14 z-[2] text-[11.5px] text-[color:var(--side-mute)]">
          Terrano · © 2026
        </div>
      </aside>

      {/* ---------------- formulário (direita) ---------------- */}
      <main className="flex items-center justify-center px-6 py-12 min-[900px]:p-12">
        <form onSubmit={submeter} className="w-full max-w-[392px]">
          {/* marca compacta (visível quando o painel escuro some) */}
          <div className="mb-8 flex items-center gap-2.5 min-[900px]:hidden">
            <TerranoSymbol size={28} tone="light" strokeWidth={4.4} />
            <span className="font-[family-name:var(--serif)] text-[22px] font-medium tracking-[-0.01em] text-[color:var(--ink)]">Terrano</span>
          </div>

          <div>
            <h2 className="font-[family-name:var(--serif)] text-[34px] font-medium tracking-[-0.02em] text-[color:var(--ink)]">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-[14.5px] text-[color:var(--ink-3)]">
              Entre para acompanhar a Fazenda Rio Novo.
            </p>
          </div>

          {/* e-mail */}
          <div className="mt-8">
            <label htmlFor="login-email" className="mb-[7px] block text-[12.5px] font-medium tracking-[0.01em] text-[color:var(--ink-2)]">
              E-mail
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-[13px] flex h-[18px] w-[18px] text-[color:var(--ink-mute)]">
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
                onChange={(e) => setEmail(e.target.value)}
                className={`${campoInput} pl-[42px]`}
              />
            </div>
          </div>

          {/* senha */}
          <div className="mt-4">
            <label htmlFor="login-senha" className="mb-[7px] block text-[12.5px] font-medium tracking-[0.01em] text-[color:var(--ink-2)]">
              Senha
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-[13px] flex h-[18px] w-[18px] text-[color:var(--ink-mute)]">
                <IconeSenha />
              </span>
              <Input
                id="login-senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={senha}
                disabled={validando}
                onChange={(e) => setSenha(e.target.value)}
                className={`${campoInput} pl-[42px] pr-[42px]`}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className={`absolute right-[13px] flex h-[18px] w-[18px] items-center justify-center ${mostrarSenha ? "text-[color:var(--cafe)]" : "text-[color:var(--ink-mute)]"} hover:text-[color:var(--ink-2)]`}
              >
                <IconeOlho />
              </button>
            </div>
          </div>

          {/* esqueci a senha (reset é por link do proprietário) */}
          <div className="mt-[10px] flex items-center justify-end">
            <button
              type="button"
              onClick={() => setDicaReset(true)}
              className="text-[13.5px] font-medium text-[color:var(--cafe)] hover:text-[color:var(--ink)]"
            >
              Esqueci a senha
            </button>
          </div>
          {dicaReset && (
            <p className="mt-2 text-[13px] leading-[1.5] text-[color:var(--ink-3)]">
              O acesso é por convite: peça ao proprietário um novo link para redefinir sua senha.
            </p>
          )}

          {erro && <div className="mt-3 text-[13px] text-[color:var(--prejuizo)]">{erro}</div>}

          <Button
            type="submit"
            disabled={!email || !senha || validando}
            className="group mt-6 h-auto w-full gap-2.5 rounded-[10px] bg-[color:var(--mast-bg)] py-[14px] text-[15px] font-semibold text-[color:var(--mast-ink)] transition-all duration-200 hover:-translate-y-px hover:bg-[color:var(--mast-bg-2)]"
          >
            {validando ? "Entrando…" : "Entrar"}
            {!validando && <IconeSeta />}
          </Button>

          <p className="mt-[26px] text-center text-[14px] text-[color:var(--ink-3)]">
            Ainda não tem acesso? <span className="font-semibold text-[color:var(--ink-2)]">Fale com o administrador</span>
          </p>
        </form>
      </main>
    </div>
  );
}
