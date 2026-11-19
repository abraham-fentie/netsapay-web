import { api, authPost } from "@/lib/api/client";

export type MfaStatus = { enabled: boolean; enabled_at?: string; recovery_codes_left: number };
export type MfaSetup = { qr_code: string; secret: string; issuer: string; account: string };

export const securityApi = {
  status: () => api<MfaStatus>("auth/mfa"),
  setup: () => api<MfaSetup>("auth/mfa/totp/setup", { method: "POST" }),
  confirm: (code: string) => api<{ recovery_codes: string[] }>("auth/mfa/totp/confirm", { method: "POST", body: { code } }),
  /** Step 1: is this the current password? 204 or 422 wrong_current_password (counts towards the lock). */
  verifyPassword: (current_password: string) => api("auth/password/verify", { method: "POST", body: { current_password } }),
  changePassword: (body: { current_password: string; new_password: string; totp_code: string }) => api("auth/password", { method: "POST", body }),
  signOut: () => authPost("logout", {}),
};
