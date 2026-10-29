import type { CouponRecord, UserRecord, WalletRecord } from "../db/schema";

/**
 * Usuários fictícios. As senhas não ficam aqui: só salt + hash PBKDF2.
 * Credenciais documentadas no README:
 *   ana@kurio.dev   / ana12345
 *   bruno@kurio.dev / bruno12345
 */
export const USER_FIXTURES: UserRecord[] = [
  {
    id: "usr_ana",
    username: "ana.ribeiro",
    displayName: "Ana Ribeiro",
    email: "ana@kurio.dev",
    passwordSalt: "salt-ana-7f3a",
    passwordHash: "3e3f79e9c89893d4e7f941a11918f04b5c7214f2e1c6155910b8cfe35cabbbff",
    avatarUrl: null,
    ensName: "anaribeiro",
    walletNickname: "Cofre da Ana",
    createdAt: "2026-01-10T12:00:00.000Z",
  },
  {
    id: "usr_bruno",
    username: "bruno.costa",
    displayName: "Bruno Costa",
    email: "bruno@kurio.dev",
    passwordSalt: "salt-bruno-91c2",
    passwordHash: "cbf42d600e22d58d87cb10d62e55108f5af7653d159d6d80056b5072e1895c14",
    avatarUrl: null,
    ensName: null,
    walletNickname: null,
    createdAt: "2026-03-02T12:00:00.000Z",
  },
];

/** Ana já tem carteira principal (fluxo de compra direto); Bruno começa sem carteiras. */
export const WALLET_FIXTURES: WalletRecord[] = [
  {
    id: "wal_ana_primary",
    userId: "usr_ana",
    slot: "primary",
    displayName: "Ana Ribeiro",
    profileName: "ana.colecionadora",
    nickname: "Cofre da Ana",
    network: "ethereum",
    type: "metamask",
    address: "0xA91F3c2B7d4E5f60718293a4B5c6D7e8F901E82C",
    ensName: "anaribeiro.eth",
    referralCode: null,
    email: "ana@kurio.dev",
    updatedAt: "2026-01-10T12:00:00.000Z",
  },
];

export const FAVORITE_FIXTURES: Record<string, string[]> = {
  usr_ana: ["emerald-ape-042", "golden-beat-207"],
  usr_bruno: [],
};

export const COUPON_FIXTURES: CouponRecord[] = [
  { code: "KURIO10", percentOff: 10, description: "Desconto do lançamento", expiresAt: "2099-12-31T23:59:59.000Z" },
  { code: "GENESIS25", percentOff: 25, description: "Lançamento gênesis", expiresAt: "2099-12-31T23:59:59.000Z" },
  { code: "EXPIRADO", percentOff: 15, description: "Campanha encerrada", expiresAt: "2026-01-01T00:00:00.000Z" },
];
