/* Tela "Definir senha" — usada em dois deep-links:
 *   /invite/<token>         → pessoa recém-convidada cria a primeira senha
 *   /reset-password/<token> → redefinição de senha (reset)
 *
 * Ao concluir, o backend já devolve uma sessão pronta (token + usuário) e
 * `onPronto` entra direto no app — mesmo padrão do Login (sem reload). */

import { FormEvent, useEffect, useRef, useState } from "react";
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
  const contexto = `${modo}:${token}`;
  const contextoAtual = useRef(contexto);
  contextoAtual.current = contexto;
  const [validacao, setValidacao] = useState<{ contexto: string; estado: "carregando" | "valido" | "invalido" | "erro" }>({ contexto, estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emCurso = useRef(false);
  const geracao = useRef(0);
  const erroRef = useRef<HTMLDivElement>(null);
  const validacaoErroRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (erro) erroRef.current?.focus(); }, [erro]);

  useEffect(() => {
    let vivo = true;
    geracao.current++;
    setValidacao({ contexto, estado: "carregando" });
    setNome(null); setSenha(""); setSenha2(""); setErro(null); setEnviando(false); emCurso.current = false;
    const pedido = modo === "convite" ? validarConvite(token) : validarReset(token);
    pedido
      .then((dados) => {
        if (!vivo) return;
        if ("nome" in dados) setNome(dados.nome);
        setValidacao({ contexto, estado: "valido" });
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        const status = falha && typeof falha === "object" && "status" in falha ? falha.status : undefined;
        setValidacao({ contexto, estado: status === 404 ? "invalido" : "erro" });
      });
    return () => { vivo = false; geracao.current++; };
  }, [modo, token, contexto, tentativa]);

  const estado = validacao.contexto === contexto ? validacao.estado : "carregando";
  useEffect(() => { if (estado === "erro" || estado === "invalido") validacaoErroRef.current?.focus(); }, [estado]);
  const podeEnviar = estado === "valido" && senha.length >= 8 && senha === senha2 && !enviando;

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeEnviar || emCurso.current) return;
    const contextoEnvio = contexto;
    const geracaoEnvio = geracao.current;
    emCurso.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const r = modo === "convite" ? await aceitarConvite(token, senha) : await redefinirSenha(token, senha);
      if (contextoAtual.current !== contextoEnvio || geracao.current !== geracaoEnvio) return;
      onPronto(r.token, r.usuario);
    } catch (err) {
      if (contextoAtual.current !== contextoEnvio || geracao.current !== geracaoEnvio) return;
      setErro(err instanceof Error ? err.message : "Falha ao definir a senha.");
      emCurso.current = false;
      setEnviando(false);
    }
  };

  if (estado === "carregando" || estado === "erro") {
    return <main className="cooperativa-content financeiro-colorido grid min-h-screen place-items-center bg-background p-6"><section className="max-w-[380px] text-center text-[15px] text-ink-3">
      {estado === "carregando" ? <p role="status">Verificando seu link… Aguarde antes de definir a senha.</p> : <><p ref={validacaoErroRef} tabIndex={-1} role="alert">Não foi possível verificar o link agora. Confira sua conexão e tente novamente.</p><Button className="mt-4" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</Button></>}
    </section></main>;
  }

  if (estado === "invalido") {
    return (
      <main className="cooperativa-content financeiro-colorido grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-[380px] text-center text-[15px] text-ink-3">
          <p ref={validacaoErroRef} tabIndex={-1} role="alert">Este link é inválido, expirou ou já foi utilizado.</p>
          <a className="mt-4 inline-block font-semibold text-[color:var(--cafe)] hover:underline" href={modo === "senha" ? "/forgot-password" : "/signin"}>
            {modo === "senha" ? "Solicitar nova recuperação" : "Voltar para entrar"}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="cooperativa-content financeiro-colorido grid min-h-screen place-items-center bg-background p-6">
      <form
        onSubmit={submeter}
        className="flex w-full max-w-[380px] flex-col gap-2.5 rounded-[14px] border border-border bg-card px-[26px] py-7 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
      >
        <h1 className="mb-1 text-[26px] font-semibold leading-[1.1] text-foreground">
          {modo === "convite" ? "Criar sua senha" : "Redefinir senha"}
        </h1>
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
          required
          disabled={enviando}
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
          required
          disabled={enviando}
          value={senha2}
          onChange={(e) => setSenha2(e.target.value)}
          className="rounded-[8px] bg-background text-[15px]"
        />
        {senha && senha.length < 8 && <div className="text-[12px] text-ink-3">Mínimo 8 caracteres.</div>}
        {senha2 && senha !== senha2 && <div className="text-[12px] text-destructive">As senhas não coincidem.</div>}
        {erro && <div ref={erroRef} tabIndex={-1} role="alert" className="text-[13px] text-destructive">{erro}</div>}
        <Button
          type="submit"
          disabled={!podeEnviar}
          className="mt-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {enviando ? "Salvando…" : "Salvar e entrar"}
        </Button>
      </form>
    </main>
  );
}
