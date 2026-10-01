// Generic host I/O for FreeLang programs compiled to JavaScript.
// MCP parsing and response decisions remain in the compiled FreeLang functions.
import { createHttpServerModule } from "./stdlib-http-server";
import { createHttpModule } from "./stdlib-http";
import { createCryptoModule } from "./stdlib-crypto";
import { createAuthModule } from "./stdlib-auth";
import { createTimeModule } from "./stdlib-time";
import { createTimerModule } from "./stdlib-timer";

export function createGeneratedHttpHost(callFn: (name: string, args: any[]) => any): Record<string, Function> {
  const interpreter = {
    callUserFunction: callFn,
    callFunction: (fn: Function, args: any[]) => fn(...args),
  };
  return {
    ...createHttpServerModule(callFn),
    ...createHttpModule(),
    ...createCryptoModule(),
    ...createAuthModule(),
    ...createTimeModule(),
    ...createTimerModule(interpreter),
  };
}
