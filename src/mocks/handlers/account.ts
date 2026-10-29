import { HttpResponse } from "msw";
import {
  AVATAR_MAX_BYTES,
  changePasswordInputSchema,
  updateAvatarInputSchema,
  updateProfileInputSchema,
  upsertWalletInputSchema,
  walletSlotSchema,
  type Wallet,
  type WalletConnection,
  type Wallets,
} from "@/api/contracts";
import type { WalletRecord } from "../db/schema";
import { db } from "../db/store";
import { hashPassword, randomHex, randomId } from "../lib/crypto";
import { fail, noContent, notFound, nowIso, parseBody, privateRoute } from "../lib/http";
import { scenario } from "../scenarios";
import { toUser } from "./auth";

const toWallet = ({ userId: _userId, ...wallet }: WalletRecord): Wallet => wallet;

function walletsOf(userId: string): Wallets {
  const own = db.state.wallets.filter((w) => w.userId === userId);
  const bySlot = (slot: WalletRecord["slot"]) => {
    const wallet = own.find((w) => w.slot === slot);
    return wallet ? toWallet(wallet) : null;
  };
  return { primary: bySlot("primary"), secondary: bySlot("secondary") };
}

/** Tamanho aproximado do arquivo a partir do base64 do data URL. */
const dataUrlBytes = (dataUrl: string) => Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

export const accountHandlers = [
  privateRoute("get", "/profile", "profile.get", ({ user }) => HttpResponse.json(toUser(user))),

  privateRoute("patch", "/profile", "profile.update", async ({ request, user }) => {
    const input = await parseBody(request, updateProfileInputSchema);
    const others = db.state.users.filter((u) => u.id !== user.id);
    if (others.some((u) => u.email === input.email)) {
      fail(409, "email_taken", "E-mail já cadastrado", { fieldErrors: { email: "Este e-mail já está em uso" } });
    }
    if (others.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
      fail(409, "username_taken", "Nome de usuário em uso", {
        fieldErrors: { username: "Este nome de usuário já está em uso" },
      });
    }
    const updated = db.write((draft) => {
      const target = draft.users.find((u) => u.id === user.id)!;
      Object.assign(target, {
        displayName: input.displayName,
        username: input.username,
        email: input.email,
        ensName: input.ensName || null,
        walletNickname: input.walletNickname || null,
      });
      return target;
    });
    return HttpResponse.json(toUser(updated));
  }),

  privateRoute("put", "/profile/avatar", "profile.avatar", async ({ request, user }) => {
    const { dataUrl } = await parseBody(request, updateAvatarInputSchema);
    if (dataUrlBytes(dataUrl) > AVATAR_MAX_BYTES) {
      fail(422, "validation_error", "Imagem muito grande", { fieldErrors: { dataUrl: "Use uma imagem de até 512 KB" } });
    }
    const updated = db.write((draft) => {
      const target = draft.users.find((u) => u.id === user.id)!;
      target.avatarUrl = dataUrl;
      return target;
    });
    return HttpResponse.json(toUser(updated));
  }),

  privateRoute("delete", "/profile/avatar", "profile.avatar", ({ user }) => {
    const updated = db.write((draft) => {
      const target = draft.users.find((u) => u.id === user.id)!;
      target.avatarUrl = null;
      return target;
    });
    return HttpResponse.json(toUser(updated));
  }),

  privateRoute("post", "/profile/password", "profile.password", async ({ request, user, token }) => {
    const input = await parseBody(request, changePasswordInputSchema);
    if ((await hashPassword(input.currentPassword, user.passwordSalt)) !== user.passwordHash) {
      fail(422, "invalid_password", "Senha atual incorreta", { fieldErrors: { currentPassword: "Senha atual incorreta" } });
    }
    if (input.currentPassword === input.newPassword) {
      fail(422, "validation_error", "A nova senha precisa ser diferente", {
        fieldErrors: { newPassword: "Escolha uma senha diferente da atual" },
      });
    }
    const salt = randomHex(8);
    const hash = await hashPassword(input.newPassword, salt);
    db.write((draft) => {
      const target = draft.users.find((u) => u.id === user.id)!;
      target.passwordSalt = salt;
      target.passwordHash = hash;
      // Outras sessões do usuário são encerradas; a atual continua válida.
      draft.sessions = draft.sessions.filter((s) => s.userId !== user.id || s.token === token);
    });
    return noContent();
  }),

  privateRoute("get", "/wallets", "wallets.list", ({ user }) => HttpResponse.json(walletsOf(user.id))),

  privateRoute<{ slot: string }>("put", "/wallets/:slot", "wallets.upsert", async ({ request, user, params }) => {
    const slot = walletSlotSchema.safeParse(params.slot);
    if (!slot.success) return notFound("Carteira");
    const input = await parseBody(request, upsertWalletInputSchema);
    const duplicate = db.state.wallets.find(
      (w) => w.userId === user.id && w.slot !== slot.data && w.address.toLowerCase() === input.address.toLowerCase(),
    );
    if (duplicate) {
      fail(409, "conflict", "Endereço já cadastrado na outra carteira", {
        fieldErrors: { address: "Este endereço já está na sua outra carteira" },
      });
    }
    db.write((draft) => {
      const existing = draft.wallets.find((w) => w.userId === user.id && w.slot === slot.data);
      const values = {
        displayName: input.displayName,
        profileName: input.profileName ?? null,
        nickname: input.nickname ?? null,
        network: input.network,
        type: input.type,
        address: input.address,
        ensName: input.ensName ?? null,
        referralCode: input.referralCode ?? null,
        email: input.email ?? null,
        updatedAt: nowIso(),
      };
      if (existing) {
        // Endereço ou rede mudaram: conexões antigas deixam de valer.
        if (existing.address !== values.address || existing.network !== values.network) {
          draft.walletConnections = draft.walletConnections.filter((c) => c.walletId !== existing.id);
        }
        Object.assign(existing, values);
      } else {
        draft.wallets.push({ id: randomId("wal"), userId: user.id, slot: slot.data, ...values });
      }
    });
    return HttpResponse.json(walletsOf(user.id));
  }),

  /** Simula a conexão com a extensão da carteira (aprovação ou recusa do usuário). */
  privateRoute<{ id: string }>("post", "/wallets/:id/connect", "wallets.connect", ({ user, params, token }) => {
    const wallet = db.state.wallets.find((w) => w.id === params.id && w.userId === user.id) ?? notFound("Carteira");
    if (scenario.config.walletRejectsOnce && scenario.once("wallet-reject")) {
      fail(409, "wallet_rejected", "A conexão foi recusada na carteira");
    }
    const connection = { id: randomId("con"), userId: user.id, walletId: wallet.id, sessionToken: token, connectedAt: nowIso() };
    db.write((draft) => {
      draft.walletConnections = draft.walletConnections.filter((c) => c.walletId !== wallet.id).concat(connection);
    });
    return HttpResponse.json<WalletConnection>({
      connectionId: connection.id,
      walletId: wallet.id,
      status: "connected",
      connectedAt: connection.connectedAt,
    });
  }),

  privateRoute<{ id: string }>("delete", "/wallets/:id/connect", "wallets.disconnect", ({ user, params }) => {
    db.write((draft) => {
      draft.walletConnections = draft.walletConnections.filter(
        (c) => !(c.walletId === params.id && c.userId === user.id),
      );
    });
    return noContent();
  }),
];
