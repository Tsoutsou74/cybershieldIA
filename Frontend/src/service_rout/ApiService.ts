const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const TOKEN_KEY = "cs_token";
const ROLE_KEY = "cs_role";

// Move any previous shared browser session into this tab, then isolate future logins per tab.
if (typeof window !== "undefined") {
  if (!sessionStorage.getItem(TOKEN_KEY)) {
    const previousToken = localStorage.getItem(TOKEN_KEY);
    const previousRole = localStorage.getItem(ROLE_KEY);
    if (previousToken) sessionStorage.setItem(TOKEN_KEY, previousToken);
    if (previousRole) sessionStorage.setItem(ROLE_KEY, previousRole);
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const getStoredRole = () => sessionStorage.getItem(ROLE_KEY) === "superadmin" ? "superadmin" : "user";
const setSession = (token: string, role: string) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ROLE_KEY, role);
};
export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: () => void = () => {};
export const setOnUnauthorized = (fn: () => void) => {
  onUnauthorized = fn;
};

export interface Analysis {
  id: number;
  type: string;
  target: string;
  score: number;
  status: string;
  created_at: string;
  malware?: MalwareCheck;
}

export interface MalwareCheck {
  status: 'malware_found' | 'no_match' | 'not_configured' | 'not_applicable' | 'unavailable';
  source: string;
  detail: string;
  url_status?: string | null;
  threat?: string | null;
  tags?: string[];
  reference?: string | null;
}

export interface IntrusionSummary {
  analysis_id: number;
  filename: string;
  status: string;
  total_flows: number;
  malicious_flows: number;
  malicious_ratio: number;
  low_confidence_flows: number;
  mean_confidence: number;
  dominant_attack: string | null;
  counts: Record<string, number>;
}

export interface SupportMessage {
  id: number;
  user_id?: number;
  sender: "user" | "assistant" | "superadmin";
  message: string;
  escalated: boolean;
  created_at: string;
  user_email?: string;
}

export interface SupportChatResult {
  messages: SupportMessage[];
  escalated: boolean;
}

export interface ThreatFeedStatus {
  source: string;
  source_url: string;
  status: "not_synced" | "syncing" | "online" | "partial" | "error";
  last_updated_at: string | null;
  next_update_at: string | null;
  entry_count: number;
  preview_urls: string[];
  last_error: string | null;
  update_interval_hours: number;
  license_note: string;
  feeds: Array<{
    id: string;
    name: string;
    url: string;
    status: "not_synced" | "syncing" | "online" | "error";
    last_updated_at: string | null;
    next_update_at: string | null;
    entry_count: number;
    last_error: string | null;
    update_interval_hours: number;
  }>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Serveur injoignable. Vérifie que le backend est lancé.");
  }

  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail))
        msg = body.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch {
      /* corps non JSON : on garde le message générique */
    }
    if (res.status === 401 && auth && token) {
      clearToken();
      onUnauthorized();
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const register = (email: string, password: string) =>
  request("/auth/register", json({ email, password }), false);

export type AccountRole = "user" | "superadmin";

export type LoginStep = { requires_2fa: true; challenge_token: string; email: string };
export async function login(email: string, password: string, role: AccountRole = "user"): Promise<LoginStep> {
  return request<LoginStep>(
    role === "superadmin" ? "/auth/superadmin/login" : "/auth/login",
    json({ email, password }),
    false,
  );
}

export async function verifyLoginCode(code: string, challengeToken: string): Promise<AccountRole> {
  const r = await request<{ access_token: string; role: AccountRole }>(
    `/auth/2fa/verify?challenge_token=${encodeURIComponent(challengeToken)}`,
    json({ code }),
    false,
  );
  setSession(r.access_token, r.role);
  return r.role;
}

export interface AuthUser {
  id: number;
  email: string;
  is_active: boolean;
  role: AccountRole;
  full_name: string;
}

export const getCurrentUser = () => request<AuthUser>("/auth/me");
export const updateMyProfile = (full_name: string, password?: string) =>
  request<AuthUser>("/auth/me", { ...json({ full_name, ...(password ? { password } : {}) }), method: "PATCH" });

export const getThreatFeedStatus = () => request<ThreatFeedStatus>("/threat-intel/status");
export const syncThreatFeed = () => request<ThreatFeedStatus>("/threat-intel/sync", json({}));

export interface ManagedUser {
  id: number;
  email: string;
  is_active: boolean;
  role: string;
  full_name: string;
}

export const getManagedUsers = () => request<ManagedUser[]>("/users/");
export const createManagedUser = (email: string, password: string, full_name: string) =>
  request<ManagedUser>("/users/", json({ email, password, full_name }));
export const updateManagedUser = (id: number, changes: { email?: string; full_name?: string; password?: string; is_active?: boolean }) =>
  request<ManagedUser>(`/users/${id}`, { ...json(changes), method: "PATCH" });

export interface AdminActivity extends Analysis {
  user_id: number | null;
  user_email: string | null;
}

export type SubscriptionPlan = "premium" | "business";
export type PaymentMethod = "stripe" | "manual";
export type PaymentStatus = "pending" | "paid" | "failed" | "rejected";

export interface SubscriptionPayment {
  payment_id: number;
  subscription_id: number;
  user_id: number;
  user_email: string;
  plan: SubscriptionPlan;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
  subscription_status: string;
}

export const getSubscriptionHistory = () => request<SubscriptionPayment[]>("/subscriptions/history");
export const syncStripeSubscriptionHistory = () =>
  request<{ imported: number }>("/subscriptions/admin/sync-stripe", json({}));
export const startStripeCheckout = (plan: SubscriptionPlan) =>
  request<{ checkout_url: string }>("/subscriptions/checkout", json({ plan }));
export const submitManualPayment = (plan: SubscriptionPlan, reference: string) =>
  request<SubscriptionPayment>("/subscriptions/manual", json({ plan, reference }));
export const verifyManualPayment = (paymentId: number, approved: boolean) =>
  request<SubscriptionPayment>(`/subscriptions/payments/${paymentId}/review`, json({ approved }));

export const analyzePhishing = (text: string) =>
  request<Analysis>("/phishing/analyze", json({ url_or_text: text }));

export interface IntrusionPayload {
  source_ip: string;
  packet_size: number;
  flags: string;
}

export const analyzeIntrusion = (payload: IntrusionPayload) =>
  request<Analysis>("/intrusion/analyze", json(payload));

export function analyzeCsv(file: File) {
  const fd = new FormData();
  fd.append("file", file); // pas de Content-Type : le navigateur ajoute la bonne frontière
  return request<IntrusionSummary>("/intrusion/analyze-csv", { method: "POST", body: fd });
}

export const getHistory = () => request<Analysis[]>("/history/");
export const getAllUserActivity = () => request<AdminActivity[]>("/history/admin");

export const getSupportChat = () => request<SupportMessage[]>("/support/chat");

export const sendSupportMessage = (message: string, contactSupport = false) =>
  request<SupportChatResult>("/support/chat", json({ message, contact_support: contactSupport }));

export const getSupportInbox = () => request<SupportMessage[]>("/support/inbox");

export const getSupportConversation = (userId: number) =>
  request<SupportMessage[]>(`/support/inbox/${userId}`);

export const replyToSupportConversation = (userId: number, message: string) =>
  request<SupportMessage>(`/support/inbox/${userId}`, json({ message }));
