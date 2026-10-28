import { accountHandlers } from "./handlers/account";
import { authHandlers } from "./handlers/auth";
import { cartHandlers } from "./handlers/cart";
import { catalogHandlers } from "./handlers/catalog";
import { devHandlers } from "./handlers/dev";
import { orderHandlers } from "./handlers/orders";
import { realtimeHandlers } from "./realtime";

export const handlers = [
  ...realtimeHandlers,
  ...devHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
];
