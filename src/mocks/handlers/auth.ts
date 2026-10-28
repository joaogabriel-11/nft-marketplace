import { HttpResponse } from "msw";
import { loginInputSchema, registerInputSchema, type Session, type User } from "@/api/contracts";
import type { UserRecord } from "../db/schema";
import { db } from "../db/store";
import { hashPassword, randomHex, randomId } from "../lib/crypto";
import { fail, noContent, nowIso, parseBody, privateRoute, route } from "../lib/http";
import { DEFAULT_SESSION_TTL_MS, scenario } from "../scenarios";

export function toUser(user: UserRecord): User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    ensName: user.ensName,
    walletNickname: user.walletNickname,
    createdAt: user.createdAt,
  };
}

function createSession(user: UserRecord): Session {
  const ttl = scenario.config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const session = {
    token: randomHex(24),
    userId: user.id,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
  };
  db.write((draft) => {
    draft.sessions.push(session);
  });
  return { token: session.token, expiresAt: session.expiresAt, user: toUser(user) };
}

export const authHandlers = [
  route("post", "/auth/register", "auth.register", async ({ request }) => {
    const input = await parseBody(request, registerInputSchema);
    const { users } = db.state;
    const fieldErrors: Record<string, string> = {};
    if (users.some((u) => u.email === input.email)) fieldErrors.email = "Este e-mail já está cadastrado";
    if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase()))
      fieldErrors.username = "Este nome de usuário já está em uso";
    if (fieldErrors.email) fail(409, "email_taken", "E-mail já cadastrado", { fieldErrors });
    if (fieldErrors.username) fail(409, "username_taken", "Nome de usuário em uso", { fieldErrors });

    const salt = randomHex(8);
    const user: UserRecord = {
      id: randomId("usr"),
      username: input.username,
      displayName: input.username,
      email: input.email,
      passwordSalt: salt,
      passwordHash: await hashPassword(input.password, salt),
      avatarUrl: null,
      ensName: null,
      walletNickname: null,
      createdAt: nowIso(),
    };
    db.write((draft) => {
      draft.users.push(user);
      draft.favorites[user.id] = [];
    });
    return HttpResponse.json(createSession(user), { status: 201 });
  }),

  route("post", "/auth/login", "auth.login", async ({ request }) => {
    const input = await parseBody(request, loginInputSchema);
    const user = db.state.users.find((u) => u.email === input.email);
    // Mesma resposta para e-mail inexistente e senha errada: não revela contas cadastradas.
    if (!user || (await hashPassword(input.password, user.passwordSalt)) !== user.passwordHash) {
      return fail(401, "invalid_credentials", "E-mail ou senha incorretos");
    }
    return HttpResponse.json(createSession(user));
  }),

  privateRoute("get", "/auth/session", "auth.session", ({ user, token }) => {
    const session = db.state.sessions.find((s) => s.token === token)!;
    return HttpResponse.json<Session>({ token, expiresAt: session.expiresAt, user: toUser(user) });
  }),

  privateRoute("post", "/auth/logout", "auth.logout", ({ token }) => {
    db.write((draft) => {
      draft.sessions = draft.sessions.filter((s) => s.token !== token);
      // Conexões de carteira pertencem à sessão; não sobrevivem ao logout.
      draft.walletConnections = draft.walletConnections.filter((c) => c.sessionToken !== token);
    });
    return noContent();
  }),
];
