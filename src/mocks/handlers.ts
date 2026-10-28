import { accountHandlers } from "./handlers/account";
import { authHandlers } from "./handlers/auth";
import { cartHandlers } from "./handlers/cart";
import { catalogHandlers } from "./handlers/catalog";
import { devHandlers } from "./handlers/dev";
import { orderHandlers } from "./handlers/orders";

export const handlers = [
  ...devHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
];
