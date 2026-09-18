import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY no está configurada");
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Keep backward compat — lazily evaluated
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResend() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
