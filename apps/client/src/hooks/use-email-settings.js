import { useSignMessage } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, sessionFetch, signIn } from "@/lib/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value) => EMAIL_SHAPE.test(value.trim());
export const SETTINGS_PATH = "/settings?tab=notifications";

// What this device remembers about a wallet's alerts without signing in: "on" or "dismissed"
const memoryKey = (address) => `mintora:email-alerts:${address.toLowerCase()}`;
export function alertsMemory(address) {
  try { return localStorage.getItem(memoryKey(address)); } catch { return null; }
}
export function setAlertsMemory(address, value) {
  try { value ? localStorage.setItem(memoryKey(address), value) : localStorage.removeItem(memoryKey(address)); } catch { }
}

// A wallet's email notification settings, shared by every component that shows them.
// `settings` is null until the wallet has signed in on this device; loading never asks the wallet to sign.
export function useEmailSettings(address) {
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const queryKey = ["email-settings", address?.toLowerCase()];
  const url = `${BASE_URL}/api/users/${address}/email`;

  const remember = (s) => {
    if (s.email || s.pendingEmail) setAlertsMemory(address, "on");
    else if (alertsMemory(address) === "on") setAlertsMemory(address, null);
  };

  const { data: settings = null, isLoading, error } = useQuery({
    queryKey,
    enabled: !!address,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const res = await sessionFetch(address, url);
      if (!res) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load your email settings.");
      remember(data);
      return data;
    },
  });

  // A signed request (asks the wallet to sign in first if needed); the answer becomes the shared settings
  const send = async (method, body) => {
    const res = await authFetch(address, signMessageAsync, url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Something went wrong.");
    queryClient.setQueryData(queryKey, data);
    remember(data);
    return data;
  };

  return {
    settings,
    isLoading,
    error,
    signIn: async () => {
      await signIn(address, signMessageAsync);
      await queryClient.invalidateQueries({ queryKey });
    },
    saveEmail: (email) => send("PUT", { email: email.trim().toLowerCase() }),
    removeEmail: () => send("PUT", { email: "" }),
    // Changes switches right away, and puts them back if the API refuses
    update: async (patch) => {
      const before = queryClient.getQueryData(queryKey);
      if (before) queryClient.setQueryData(queryKey, { ...before, ...patch });
      try {
        return await send("PATCH", patch);
      } catch (e) {
        queryClient.setQueryData(queryKey, before);
        throw e;
      }
    },
  };
}
