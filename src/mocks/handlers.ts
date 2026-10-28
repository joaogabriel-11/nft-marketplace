import { HttpResponse } from "msw";
import { accountHandlers } from "./handlers/account";
import { authHandlers } from "./handlers/auth";
import { cartHandlers } from "./handlers/cart";
import { catalogHandlers } from "./handlers/catalog";
import { devHandlers } from "./handlers/dev";
import { orderHandlers } from "./handlers/orders";
import { route } from "./lib/http";
import { scenario } from "./scenarios";

export const handlers = [
  ...devHandlers,
  route("get", "/health", "health", () => HttpResponse.json({ status: "ok", scenario: scenario.name })),
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
];
