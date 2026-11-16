/* Entrada do Terrano: uma coluna, marca, formulário. Sem slogan nem painel
 * decorativo — quem chega aqui já sabe o que veio fazer.
 *
 * A tela mantém o fluxo de sessão em estado, sem recarregar o documento depois
 * do login.
 */

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";
import { TerranoSymbol } from "./TerranoLogo";
import { CampoSenha } from "./CampoSenha";

export function Login({ onEntrar }: { onEntrar?: (token: string, usuario: UsuarioSessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emCurso = useRef(false);
  const erroRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (erro) erroRef.current?.focus(); }, [erro]);

  const submeter = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !senha || emCurso.current) return;

    emCurso.current = true;
    setValidando(true);
    setErro(null);
    try {
      const { token, usuario } = await login(email.trim().toLowerCase(), senha);
      onEntrar?.(token, usuario);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha de rede.");
      emCurso.current = false;
      setValidando(false);
    }
  };

  const campoInput =
    "h-12 rounded-md border-[#c7d4ca] bg-card px-3 text-base text-[#283c31] shadow-none placeholder:text-[#718178] focus-visible:border-[#24493b] focus-visible:ring-2 focus-visible:ring-[#24493b]/20 focus-visible:ring-offset-0";

  return (
    <main className="login-campo min-h-[100dvh] bg-[#edf2ed] px-4 py-10 font-[family-name:var(--sans)] sm:py-16">
      <div className="mx-auto w-full max-w-[400px]">
        <div className="flex items-center gap-3">
          <TerranoSymbol size={32} tone="light" strokeWidth={4.2} />
          <div className="leading-tight">
            <span className="block text-[20px] font-bold text-[#283c31]">Terrano</span>
            <span className="block text-[14px] text-[#56665f]">Fazenda Rio Novo</span>
          </div>
        </div>

        <form onSubmit={submeter} className="mt-12">
          <h1 className="text-[28px] font-bold leading-tight text-[#283c31]">Entrar</h1>

          <div className="mt-8">
            <label htmlFor="login-email" className="mb-2 block text-[15px] font-semibold text-[#283c31]">E-mail</label>
            <Input
                  id="login-email"
                  type="email"
                  required
                  maxLength={254}
                  autoFocus
                  autoComplete="username"
                  placeholder="voce@fazenda.com.br"
                  value={email}
                  disabled={validando}
                  onChange={(event) => setEmail(event.target.value)}
                  className={campoInput}
                />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor="login-senha" className="block text-[15px] font-semibold text-[#283c31]">Senha</label>
              <a href="/forgot-password" className="text-[15px] font-semibold text-[#24493b] underline-offset-4 hover:underline">Esqueci a senha</a>
            </div>
                <CampoSenha
                  id="login-senha"
                  autoComplete="current-password"
                  required
                  placeholder="Sua senha"
                  value={senha}
                  disabled={validando}
                  onChange={(event) => setSenha(event.target.value)}
                  className={campoInput}
                />
          </div>

          {erro && (
            <p ref={erroRef} tabIndex={-1} role="alert" className="mt-5 rounded-md border border-[#e3b9b4] bg-[#f8e9e7] px-3 py-2.5 text-[15px] leading-6 text-[#a3312a]">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={!email || !senha || validando}
            className="mt-8 h-12 w-full rounded-md bg-[#24493b] text-base font-semibold text-white shadow-none transition-colors hover:bg-[#1b3a2e] disabled:bg-[#24493b]/55 disabled:text-white disabled:opacity-100"
          >
            {validando ? "Entrando…" : "Entrar"}
          </Button>

          <p className="mt-8 text-[15px] leading-6 text-[#56665f]">
            Sem acesso? Peça um convite a quem administra a fazenda.
          </p>
        </form>
      </div>
    </main>
  );
}
