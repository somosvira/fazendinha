/* Tela "Definir senha" — usada em dois deep-links:
 *   /invite/<token>         → pessoa recém-convidada cria a primeira senha
 *   /reset-password/<token> → redefinição de senha (reset)
 *
 * Ao concluir, o backend já devolve uma sessão pronta (token + usuário) e
 * `onPronto` entra direto no app — mesmo padrão do Login (sem reload). */

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validarConvite, validarReset, aceitarConvite, redefinirSenha } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";
import { CampoSenha } from "./CampoSenha";

export function DefinirSenha({
  modo,
  token,
  onPronto,
}: {
  modo: "convite" | "senha";
  token: string;
  onPronto: (token: string, usuario: UsuarioSessao) => void;
}) {
  const [nome, setNome] = useState<string | null>(null);
  const [invalido, setInvalido] = useState(false);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const validacao = modo === "convite" ? validarConvite(token) : validarReset(token);
    validacao
      .then((dados) => {
        if ("nome" in dados) setNome(dados.nome);
      })
      .catch(() => setInvalido(true));
  }, [modo, token]);

  const podeEnviar = senha.length >= 8 && senha === senha2 && !enviando;

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = modo === "convite" ? await aceitarConvite(token, senha) : await redefinirSenha(token, senha);
      onPronto(r.token, r.usuario);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao definir a senha.");
      setEnviando(false);
    }
  };

  if (invalido) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-[380px] text-center text-[15px] text-ink-3">
          <p>Este link é inválido, expirou ou já foi utilizado.</p>
          <a className="mt-4 inline-block font-semibold text-[color:var(--cafe)] hover:underline" href={modo === "senha" ? "/forgot-password" : "/signin"}>
            {modo === "senha" ? "Solicitar nova recuperação" : "Voltar para entrar"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <form
        onSubmit={submeter}
        className="flex w-full max-w-[380px] flex-col gap-2.5 rounded-[14px] border border-border bg-card px-[26px] py-7 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
      >
        <div className="mb-1 font-serif text-[26px] leading-[1.1] text-foreground">
          {modo === "convite" ? "Criar sua senha" : "Redefinir senha"}
        </div>
        {modo === "convite" && nome && (
          <div className="mb-2 text-[13px] text-ink-3">Bem-vindo, {nome.split(" ")[0]}.</div>
        )}
        <Label htmlFor="ds-senha" className="mt-1 text-xs uppercase tracking-[0.05em] text-ink-3">
          Nova senha
        </Label>
        <CampoSenha
          id="ds-senha"
          autoFocus
          autoComplete="new-password"
          maxLength={128}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-[8px] bg-background text-[15px]"
        />
        <Label htmlFor="ds-senha2" className="mt-1 text-xs uppercase tracking-[0.05em] text-ink-3">
          Repita a senha
        </Label>
        <CampoSenha
          id="ds-senha2"
          autoComplete="new-password"
          maxLength={128}
          value={senha2}
          onChange={(e) => setSenha2(e.target.value)}
          className="rounded-[8px] bg-background text-[15px]"
        />
        {senha && senha.length < 8 && <div className="text-[12px] text-ink-3">Mínimo 8 caracteres.</div>}
        {senha2 && senha !== senha2 && <div className="text-[12px] text-destructive">As senhas não coincidem.</div>}
        {erro && <div className="text-[13px] text-destructive">{erro}</div>}
        <Button
          type="submit"
          disabled={!podeEnviar}
          className="mt-2 rounded-[8px] bg-foreground text-background hover:bg-foreground/90"
        >
          {enviando ? "Salvando…" : "Salvar e entrar"}
        </Button>
      </form>
    </div>
  );
}
