/* Rio Novo — Acessos (controle de permissões, admin).
 * Ligado à API real (/api/usuarios): carrega a lista no mount e persiste cada
 * mudança via PATCH. O convite devolve um link copiável, mostrado no próprio
 * modal e na ficha de quem está pendente; a recuperação pública
 * de senha envia o link pelo canal configurado no backend.
 * As CONSTANTES de UI (ABAS/FLAGS/PAPEIS) continuam vindo de data/acessos. */

import { useEffect, useState } from "react";
import { Check, Circle, CircleCheck, Search, ShieldCheck, UserPlus, Users, TriangleAlert } from "lucide-react";
import "./acessos.css";
import { ABAS, AREAS, FLAGS, PAPEIS } from "../data/acessos";
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  revogarUsuario,
  gerarConvite,
} from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button, Modal, PageHeader, PaginaFinanceira } from "../financeiro/financeiro-ui";

/* validação simples de email (suficiente p/ feedback antes do envio real) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* inicial derivada do nome (o DTO real não traz `inicial`) */
const inicialDe = (nome: string) => nome.trim()[0]?.toUpperCase() ?? "?";

/* último acesso: ISO string ou null → data pt-BR ou travessão */
function fmtUltimoAcesso(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/* status-badge base + tom por status (o DTO usa MAIÚSCULAS) */
const STATUS_BADGE_BASE =
  "inline-block whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium";
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ATIVO: { label: "Ativo", cls: "text-[color:var(--pos)]" },
    PENDENTE: { label: "Convite pendente", cls: "text-[color:var(--warn)]" },
    INATIVO: { label: "Inativo", cls: "text-[color:var(--ink-mute)]" },
  };
  const s = map[status] || map.ATIVO;
  return <span className={STATUS_BADGE_BASE + " " + s.cls}>{s.label}</span>;
}

/* dono-tag / admin-tag (pequenas etiquetas outline) */
const DONO_TAG =
  "border border-leite px-[6px] py-px text-[9px] uppercase tracking-[0.16em] text-leite";
const ADMIN_TAG =
  "ml-2 inline-block border border-[color:var(--neg)] px-[5px] py-px align-middle text-[9px] uppercase tracking-[0.14em] text-[color:var(--neg)]";

/* Campo somente-leitura com o link de acesso e botão de copiar. O token cru só
 * existe em memória: o backend guarda apenas o hash, então o mesmo link não
 * pode ser recuperado depois. */
export function LinkAcesso({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const [copiando, setCopiando] = useState(false);

  const copiar = async () => {
    setErro(""); setCopiado(false); setCopiando(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Indisponível");
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Selecione o link e copie manualmente.");
    } finally { setCopiando(false); }
  };
  useEffect(() => { if (!copiado) return; const id = setTimeout(() => setCopiado(false), 1800); return () => clearTimeout(id); }, [copiado]);

  return (
    <div>
    <div className="flex gap-2 max-[560px]:flex-col">
      <input
        readOnly
        value={link}
        aria-label="Link de acesso"
        className="field-input min-w-0 flex-1 text-[13px]"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button className="btn-secondary whitespace-nowrap" disabled={copiando} onClick={copiar}>
        {copiando ? "Copiando…" : copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
    <span className="sr-only" role="status">{copiado ? "Link copiado" : ""}</span>
    {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
    </div>
  );
}

function InviteModal({
  onClose,
  onInvite,
  existingEmails,
}: {
  onClose: () => void;
  onInvite: (v: { nome: string; email: string; papel: string }) => Promise<{ nome: string; link: string }>;
  existingEmails: string[];
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("gestor");
  const [touched, setTouched] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ nome: string; link: string } | null>(null);

  const emailNorm = email.trim().toLowerCase();
  const emailJaExiste = !!emailNorm && existingEmails.includes(emailNorm);
  const emailInvalido = !!emailNorm && !EMAIL_RE.test(emailNorm);
  const emailErr = touched
    ? emailInvalido
      ? "E-mail inválido."
      : emailJaExiste
        ? "Já existe um acesso com esse e-mail."
        : null
    : null;
  const podeEnviar = !!nome.trim() && !!emailNorm && !emailInvalido && !emailJaExiste;

  const submeter = async () => {
    setTouched(true);
    if (!podeEnviar || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      setCriado(await onInvite({ nome: nome.trim(), email: emailNorm, papel }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o convite.");
    } finally {
      setEnviando(false);
    }
  };

  // Depois de criar, o mesmo modal passa a mostrar só o link — ele aparece uma
  // única vez e some ao fechar, então nada de formulário competindo por atenção.
  if (criado) {
    return (
      <Modal titulo="Convite criado" eyebrow="Acessos" onClose={onClose}>
          <div className="modal-body">
            <p className="m-0 mb-5 text-[15px] leading-[1.6] text-ink-3">
              Envie este link para <strong className="text-[color:var(--ink)]">{criado.nome}</strong>. Ele vale por 7 dias,
              serve uma vez só e é a única forma de a pessoa criar a senha.
            </p>
            <div className="field">
              <label className="field-label">Link de acesso</label>
              <LinkAcesso link={criado.link} />
            </div>
            <div className="caption" style={{ fontStyle: "italic" }}>
              Guarde agora: por segurança o link não pode ser consultado depois. Se perder, gere um novo pela ficha da pessoa.
            </div>
          </div>
          <div className="modal-foot sticky bottom-0 bg-card">
            <button className="btn-primary" onClick={onClose}>
              Concluir
            </button>
          </div>
      </Modal>
    );
  }

  return (
    <Modal titulo="Convidar pessoa" eyebrow="Acessos" onClose={onClose}>
        <div className="modal-body">
          <div className="field">
            <label className="field-label" htmlFor="inv-nome">Nome</label>
            <input
              id="inv-nome" className="field-input rounded-lg" value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Sandra Oliveira"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="inv-email">E-mail</label>
            <input
              id="inv-email"
              className={"field-input rounded-lg" + (emailErr ? " is-error" : "")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="pessoa@email.com"
              aria-invalid={!!emailErr}
              aria-describedby={emailErr ? "inv-email-err" : undefined}
            />
            {emailErr && <span id="inv-email-err" className="field-error">{emailErr}</span>}
          </div>
          <div className="field">
            <label className="field-label">Papel inicial</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(PAPEIS)
                .filter(([k]) => k !== "proprietario")
                .map(([k, p]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={papel === k}
                    className={
                      "flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-transparent px-4 py-[13px] text-left hover:border-[color:var(--ink-3)] " +
                      (papel === k
                        ? "border-[color:var(--ink)] bg-[color:var(--bg-card-2)]"
                        : "border-[color:var(--rule)]")
                    }
                    onClick={() => setPapel(k)}
                  >
                    <span className="mt-px text-[color:var(--ink)]">{papel === k ? <CircleCheck size={18} aria-hidden /> : <Circle size={18} aria-hidden />}</span>
                    <span className="flex flex-col gap-0.5">
                      <strong className="text-[15px] font-bold text-[color:var(--ink)]">{p.nome}</strong>
                      <small className="text-[12px] leading-[1.4] text-ink-3">{p.desc}</small>
                    </span>
                  </button>
                ))}
            </div>
          </div>
          <div className="caption" style={{ fontStyle: "italic" }}>
            Você vai receber um link para enviar à pessoa. Você pode ajustar exatamente o que ela vê depois de convidar.
          </div>
          {erro && <span className="field-error">{erro}</span>}
        </div>
        <div className="modal-foot sticky bottom-0 bg-card">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!podeEnviar || enviando} onClick={submeter}>
            {enviando ? "Criando…" : "Criar convite →"}
          </button>
        </div>
    </Modal>
  );
}

function PermissionEditor({
  user,
  linkConvite,
  onChange,
  onResendInvite,
  onRevoke,
}: {
  user: UsuarioSessao;
  /** Link gerado nesta sessão. O backend só guarda o hash, então um convite
   *  emitido antes não tem link recuperável — resta gerar outro. */
  linkConvite?: string | null;
  onChange: (u: UsuarioSessao) => void;
  onResendInvite: (u: UsuarioSessao) => void;
  onRevoke: (u: UsuarioSessao) => void;
}) {
  const applyPreset = (papelId: string) => {
    const preset = PAPEIS[papelId];
    onChange({ ...user, papel: papelId, abas: [...preset.abas], areas: [...preset.areas], flags: [...preset.flags] });
  };
  const toggleAba = (id: string) => {
    const has = user.abas.includes(id);
    onChange({ ...user, abas: has ? user.abas.filter((a) => a !== id) : [...user.abas, id], papel: "personalizado" });
  };
  const toggleFlag = (id: string) => {
    const has = user.flags.includes(id);
    onChange({ ...user, flags: has ? user.flags.filter((f) => f !== id) : [...user.flags, id], papel: "personalizado" });
  };
  const toggleArea = (id: string) => {
    const has = user.areas.includes(id);
    onChange({ ...user, areas: has ? user.areas.filter((a) => a !== id) : [...user.areas, id], papel: "personalizado" });
  };

  const papelNome = user.papel === "personalizado" ? "Personalizado" : PAPEIS[user.papel]?.nome || "—";

  /* .perm-row base + estado .on/.admin (transição border+bg 80ms) */
  const permRow =
    "flex cursor-pointer items-start gap-3 border bg-transparent px-[14px] py-[13px] text-left transition-[border-color,background] duration-[80ms] hover:border-[color:var(--ink-3)]";
  const permRowClass = (on: boolean) =>
    permRow + (on ? " border-[color:var(--rule)] bg-[color:var(--bg-card-2)]" : " border-[color:var(--rule-soft)]");
  /* .perm-check base; data-on=true → preenche (ink) ou neg quando linha .admin */
  const permCheck =
    "mt-px grid h-[18px] w-[18px] flex-none place-items-center border-[1.5px] border-[color:var(--rule)] data-[on=true]:border-[color:var(--ink)] data-[on=true]:bg-[color:var(--ink)]";
  const permCheckAdmin =
    permCheck + " data-[on=true]:border-[color:var(--neg)] data-[on=true]:bg-[color:var(--neg)]";

  return (
    <div className="acessos-editor overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5">
        <div className="flex items-center gap-[14px]">
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-mast font-serif text-[22px] text-mast-ink">{inicialDe(user.nome)}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 text-lg font-semibold">
              {user.nome}
              {user.dono && <span className={DONO_TAG}>dono</span>}
            </div>
            <div className="mt-0.5 break-all text-[13px] text-ink-3">{user.email}</div>
          </div>
        </div>
        <StatusBadge status={user.status} />
      </div>
      {!user.dono && <div className="acessos-perfil-resumo"><ShieldCheck size={18} aria-hidden="true" /><div><strong>{papelNome}</strong><p>{user.areas.map(id => AREAS.find(area => area.id === id)?.label ?? id).join(" · ") || "Nenhuma área habilitada"} · {user.flags.includes("lancar") ? "Pode registrar operações" : "Sem registro de operações"} · {user.flags.includes("verValores") ? "Valores visíveis" : "Valores ocultos"}</p></div><small>Permissões salvas automaticamente</small></div>}

      {user.status === "PENDENTE" && (
        <div className="border-b border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)] px-[26px] py-[22px]">
          <div className="mb-3 text-[12px] uppercase tracking-[0.16em] text-[color:var(--warn)]">
            Convite pendente
          </div>
          {linkConvite ? (
            <>
              <div className="mb-2 text-[13px] text-ink-3">Link de acesso</div>
              <LinkAcesso link={linkConvite} />
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="caption" style={{ fontStyle: "italic" }}>
                  Válido por 7 dias e utilizável uma única vez.
                </span>
                <button
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-ink-3 underline underline-offset-2 hover:text-[color:var(--ink)]"
                  onClick={() => onResendInvite(user)}
                >
                  Gerar novo link
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="m-0 max-w-[56ch] text-[14px] leading-[1.55] text-ink-3">
                {user.nome.split(" ")[0]} ainda não criou a senha. O link aparece uma única vez, no momento em que é
                gerado, e não fica guardado. Gere um novo para reenviar — o anterior deixa de valer.
              </p>
              <button className="btn-secondary" onClick={() => onResendInvite(user)}>
                Gerar link de acesso
              </button>
            </div>
          )}
        </div>
      )}

      {user.dono ? (
        <div className="px-[26px] py-[30px]">
          <span className="font-serif font-medium" style={{ fontSize: 17 }}>
            Acesso total e irrevogável.
          </span>
          <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.6] text-ink-3">
            Como proprietário, {user.nome.split(" ")[0]} vê tudo e é o único que gerencia acessos. Esse papel não pode ser reduzido.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-[color:var(--rule-soft)] px-[26px] py-[22px]">
            <div className="mb-[14px] flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-3">Áreas que pode acessar</span>
              <span className="text-[12px] text-ink-3 tabular-nums">{user.areas.length} de {AREAS.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-[1100px]:grid-cols-1 min-[1500px]:grid-cols-3">
              {AREAS.map((area) => {
                const on = user.areas.includes(area.id);
                return (
                  <button key={area.id} aria-pressed={on} className={permRowClass(on)} onClick={() => toggleArea(area.id)}>
                    <span className={permCheck} data-on={on}>{on && <Check size={12} aria-hidden className="text-[color:var(--bg-card)]" />}</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="font-sans text-[14px] font-medium text-[color:var(--ink)]">{area.label}</strong>
                      <small className="text-[12px] leading-[1.4] text-ink-3">{area.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-b border-[color:var(--rule-soft)] px-[26px] py-[22px]">
            <div className="mb-[14px] flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-3">Papel</span>
              <span className="font-serif text-[15px] italic text-[color:var(--ink)]">{papelNome}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PAPEIS)
                .filter(([k]) => k !== "proprietario")
                .map(([k, p]) => (
                  <button
                    key={k}
                    aria-pressed={user.papel === k}
                    className={
                      "cursor-pointer border px-[14px] py-2 font-sans text-[13px] tracking-[0.01em] " +
                      (user.papel === k
                        ? "border-[color:var(--mast-bg)] bg-mast text-mast-ink"
                        : "border-[color:var(--rule)] bg-transparent text-ink-2 hover:border-[color:var(--ink-3)] hover:text-[color:var(--ink)]")
                    }
                    onClick={() => applyPreset(k)}
                    title={p.desc}
                  >
                    {p.nome}
                  </button>
                ))}
            </div>
          </div>

          <div className="border-b border-[color:var(--rule-soft)] px-[26px] py-[22px]">
            <div className="mb-[14px] flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-3">Abas que pode ver</span>
              <span className="text-[12px] text-ink-3 tabular-nums">
                {user.abas.length} de {ABAS.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-[1100px]:grid-cols-1 min-[1500px]:grid-cols-3">
              {ABAS.map((aba) => {
                const on = user.abas.includes(aba.id);
                return (
                  <button key={aba.id} aria-pressed={on} className={permRowClass(on)} onClick={() => toggleAba(aba.id)}>
                    <span className={permCheck} data-on={on}>
                      {on && <Check size={12} aria-hidden className="text-[color:var(--bg-card)]" />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="font-sans text-[14px] font-medium text-[color:var(--ink)]">{aba.label}</strong>
                      <small className="text-[12px] leading-[1.4] text-ink-3">{aba.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-b border-[color:var(--rule-soft)] px-[26px] py-[22px]">
            <div className="mb-[14px] flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-3">Permissões sensíveis</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-[1100px]:grid-cols-1 min-[1500px]:grid-cols-3">
              {FLAGS.map((flag) => {
                const on = user.flags.includes(flag.id);
                const isAdmin = flag.id === "gerenciarAcessos";
                return (
                  <button key={flag.id} aria-pressed={on} className={permRowClass(on)} onClick={() => toggleFlag(flag.id)}>
                    <span className={isAdmin ? permCheckAdmin : permCheck} data-on={on}>
                      {on && <Check size={12} aria-hidden className="text-[color:var(--bg-card)]" />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="font-sans text-[14px] font-medium text-[color:var(--ink)]">
                        {flag.label}
                        {isAdmin && <span className={ADMIN_TAG}>admin</span>}
                      </strong>
                      <small className="text-[12px] leading-[1.4] text-ink-3">{flag.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="acessos-revogacao">
            <TriangleAlert size={18} aria-hidden="true" /><p><strong>Revogar acesso</strong><small>A pessoa perderá o acesso à fazenda imediatamente.</small></p>
            <button className="btn-secondary text-destructive" onClick={() => onRevoke(user)}>
              Revogar acesso
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Acessos() {
  const toast = useToast();
  const [users, setUsers] = useState<UsuarioSessao[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [revoking, setRevoking] = useState<UsuarioSessao | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Links emitidos nesta sessão, por usuário. O backend guarda só o hash do
  // token, então nada aqui pode ser reconstruído depois de recarregar a página.
  const [linksConvite, setLinksConvite] = useState<Record<number, string>>({});

  useEffect(() => {
    let atual = true;
    setCarregando(true);
    setErroCarga(null);
    listarUsuarios()
      .then((us) => {
        if (!atual) return;
        setUsers(us);
        setSelId((cur) => cur ?? us[0]?.id ?? null);
      })
      .catch((e) => { if (atual) setErroCarga(e instanceof Error ? e.message : "Não foi possível carregar os acessos."); })
      .finally(() => { if (atual) setCarregando(false); });
    return () => { atual = false; };
  }, [revisao]);

  const sel = users.find((u) => u.id === selId) ?? users[0] ?? null;
  const ativos = users.filter((u) => u.status === "ATIVO").length;
  const pendentes = users.filter((u) => u.status === "PENDENTE").length;

  const updateUser = async (next: UsuarioSessao) => {
    if (salvando) return;
    setSalvando(true);
    try {
      const salvo = await atualizarUsuario(next.id, { papel: next.papel, abas: next.abas, areas: next.areas, flags: next.flags });
      setUsers((us) => us.map((u) => (u.id === salvo.id ? salvo : u)));
    } catch (e) {
      toast.error("Não foi possível salvar", e instanceof Error ? e.message : "");
    } finally { setSalvando(false); }
  };

  // O modal fica aberto e assume a exibição do link; por isso devolvemos, em vez
  // de guardar num painel fixo da página.
  const invite = async ({ nome, email, papel }: { nome: string; email: string; papel: string }) => {
    const { usuario, conviteLink: link } = await criarUsuario(nome, email, papel);
    setUsers((us) => [...us, usuario]);
    setSelId(usuario.id);
    setLinksConvite((atual) => ({ ...atual, [usuario.id]: link }));
    return { nome: usuario.nome, link };
  };

  const resendInvite = async (u: UsuarioSessao) => {
    try {
      const link = await gerarConvite(u.id);
      setLinksConvite((atual) => ({ ...atual, [u.id]: link }));
      toast.info("Novo link gerado", "O link anterior deixou de valer.");
    } catch (e) {
      toast.error("Falha ao gerar link", e instanceof Error ? e.message : "");
    }
  };

  const confirmRevoke = (u: UsuarioSessao) => {
    if (u.dono) {
      toast.error("Não é possível revogar", "O acesso do proprietário é irrevogável.");
      return;
    }
    setRevoking(u);
  };

  const doRevoke = async () => {
    if (!revoking) return;
    const alvo = revoking;
    try {
      await revogarUsuario(alvo.id);
      setUsers((us) => us.map((u) => (u.id === alvo.id ? { ...u, status: "INATIVO" } : u)));
      setRevoking(null);
      toast.success("Acesso revogado", `${alvo.nome.split(" ")[0]} não tem mais acesso à fazenda.`);
    } catch (e) {
      toast.error("Não foi possível revogar", e instanceof Error ? e.message : "");
      setRevoking(null);
    }
  };

  const existingEmails = users.map((u) => u.email.trim().toLowerCase()).filter(Boolean);
  const termo = busca.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const usersVisiveis = users.filter(u => (!statusFiltro || u.status === statusFiltro) && `${u.nome} ${u.email}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(termo));

  return (
    <PaginaFinanceira>
      <PageHeader
        titulo="Acessos"
        descricao="Convide pessoas e defina quais áreas e informações cada perfil pode consultar ou operar."
        acao={<Button onClick={() => setShowInvite(true)}><UserPlus size={16} /> Convidar pessoa</Button>}
      />
      <div className="acessos-layout mt-5">
        <section className="acessos-equipe" aria-label="Equipe e convidados">
          <div className="acessos-equipe-cabecalho">
            <h2><Users size={18} aria-hidden="true" />Equipe e convidados</h2>
            <p>{carregando ? "Consultando acessos…" : `${ativos} ativos · ${pendentes} convites pendentes`}</p>
            <label className="acessos-busca"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Buscar pessoa" placeholder="Buscar nome ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} /></label>
            <div className="acessos-status-filtros" aria-label="Filtrar pessoas por situação">{[["", "Todos"], ["ATIVO", "Ativos"], ["PENDENTE", "Pendentes"], ["INATIVO", "Inativos"]].map(([valor, texto]) => <button type="button" key={valor} aria-pressed={statusFiltro === valor} onClick={() => setStatusFiltro(valor)}>{texto}</button>)}</div>
          </div>
          {carregando ? <div className="p-5 text-sm text-ink-3" role="status">Carregando pessoas…</div> : erroCarga ? <div className="p-5 text-sm" role="alert"><p>{erroCarga}</p><Button secondary className="mt-3" onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button></div> : usersVisiveis.length === 0 ? (
            <div className="px-[18px] py-[22px] text-[13px] text-ink-3">{users.length ? "Nenhuma pessoa encontrada. Ajuste a busca ou a situação." : "Ninguém por aqui ainda. Convide a primeira pessoa."}</div>
          ) : (
            <div className="acessos-pessoas" aria-label="Selecionar pessoa">
              {usersVisiveis.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={sel?.id === u.id}
                  className="acessos-pessoa"
                  onClick={() => setSelId(u.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full bg-mast font-serif text-[17px] text-mast-ink">{inicialDe(u.nome)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="break-words font-sans text-[14px] font-medium text-[color:var(--ink)]">{u.nome}</span>
                        {u.dono && <span className={DONO_TAG}>dono</span>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-3">
                        {u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome ?? "Personalizado"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={u.status} />
                    <span className="whitespace-nowrap text-[11px] text-[color:var(--ink-mute)]">{fmtUltimoAcesso(u.ultimoAcesso)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {sel ? (
          <fieldset disabled={salvando} aria-busy={salvando} className="min-w-0 border-0 p-0 m-0">
          <legend className="sr-only">Permissões de {sel.nome}</legend>
          <span role="status" className={salvando ? "block mb-2 text-sm text-muted-foreground" : "sr-only"}>{salvando ? "Salvando permissões…" : ""}</span>
          <PermissionEditor
            user={sel}
            linkConvite={linksConvite[sel.id] ?? null}
            onChange={updateUser}
            onResendInvite={resendInvite}
            onRevoke={confirmRevoke}
          />
          </fieldset>
        ) : (
          <div className="border border-[color:var(--rule)] bg-[color:var(--bg-card)] px-[26px] py-[30px] text-[15px] text-ink-3">
            {carregando ? "Carregando acessos…" : "Selecione uma pessoa para editar as permissões."}
          </div>
        )}
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={invite}
          existingEmails={existingEmails}
        />
      )}
      <ConfirmDialog
        open={!!revoking}
        title="Revogar acesso?"
        message={
          revoking ? (
            <>
              <strong>{revoking.nome}</strong> perderá imediatamente o acesso à fazenda.
              Você pode convidar a pessoa novamente a qualquer momento.
            </>
          ) : null
        }
        confirmLabel="Revogar acesso"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={doRevoke}
        onCancel={() => setRevoking(null)}
      />
    </PaginaFinanceira>
  );
}
