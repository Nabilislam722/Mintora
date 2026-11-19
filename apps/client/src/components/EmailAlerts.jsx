import { useState } from "react";
import { Link } from "wouter";
import { AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Bell, BellRing, Loader2, X } from "lucide-react";
import VeHemiDialog from "@/components/vehemi/VeHemiDialog";
import { SETTINGS_PATH, alertsMemory, isEmail, setAlertsMemory, useEmailSettings } from "@/hooks/use-email-settings";

const errorText = (e) => e?.shortMessage || e?.message || "Something went wrong.";
const ALL_ALERTS = "Get an email when someone makes an offer on your veHEMI position, or buys your NFT or veHEMI position.";

// "loading", "none" (no email), "pending" (link not clicked yet), "off" (email but both switches off) or "on"
function statusOf(alerts, address) {
  const s = alerts.settings;
  if (alerts.isLoading) return "loading";
  if (!s) return alertsMemory(address) === "on" ? "on" : "none";
  if (s.email) return s.offers || s.sales ? "on" : "off";
  return s.pendingEmail ? "pending" : "none";
}

function Ping() {
  return (
    <span className="absolute -top-0.5 -right-0.5 flex w-2.5 h-2.5">
      <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-75 animate-ping" />
      <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-primary" />
    </span>
  );
}

function Heading({ title, text, ping = false }) {
  return (
    <div className="flex items-start gap-3 pr-6">
      <span className="relative w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-primary" />
        {ping && <Ping />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
      </div>
    </div>
  );
}

// "Email alerts on", with a link to change them
function AlertsOn({ email }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
      <BellRing className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="min-w-0 truncate">
        <span className="font-semibold text-foreground">Email alerts on</span>
        {email && <span className="text-muted-foreground"> · {email}</span>}
      </span>
      <Link href={SETTINGS_PATH} className="ml-auto shrink-0 text-primary hover:underline">Manage</Link>
    </div>
  );
}

// The email field; saving asks the wallet to sign in first if it hasn't on this device
function EmailForm({ alerts }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const signedIn = !!alerts.settings;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!isEmail(email)) return setErr("Enter a valid email address.");
    setBusy(true);
    try {
      await alerts.saveEmail(email);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex gap-2 max-[360px]:flex-col">
        <input
          type="email"
          autoComplete="email"
          aria-label="Email address"
          placeholder="you@example.com"
          value={email}
          maxLength={254}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-0 h-10 rounded-xl bg-background/60 border border-border focus:border-primary/60 outline-none px-3 text-sm disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" />{signedIn ? "Sending" : "Confirm in wallet"}</> : "Notify me"}
        </button>
      </div>
      <p className={`mt-2 text-[11px] ${err ? "text-destructive" : "text-muted-foreground"}`}>
        {err || (signedIn
          ? "We'll send a link to confirm it's yours. Free, and you can turn it off any time."
          : "You'll sign a message to prove the wallet is yours (no gas), then confirm the email from your inbox.")}
      </p>
    </form>
  );
}

// "Check your inbox", with a way to send the link again
function CheckInbox({ alerts }) {
  const [state, setState] = useState("");
  const resend = async () => {
    setState("busy");
    try {
      await alerts.saveEmail(alerts.settings.pendingEmail);
      setState("Sent again.");
    } catch (e) {
      setState(errorText(e));
    }
  };
  return (
    <>
      <Heading title="Check your inbox" text={<>Click the link we sent to <span className="font-medium text-foreground">{alerts.settings.pendingEmail}</span> to turn on alerts.</>} />
      <div className="mt-3 pl-12 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button type="button" onClick={resend} disabled={state === "busy"} className="text-primary hover:underline disabled:opacity-50">
          {state === "busy" ? "Sending…" : "Send again"}
        </button>
        <Link href={SETTINGS_PATH} className="text-muted-foreground hover:text-foreground">Change email</Link>
        {state && state !== "busy" && <span className="text-muted-foreground">{state}</span>}
      </div>
    </>
  );
}

// Email set but every switch off: one click turns offers and sales back on
function TurnBackOn({ alerts }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const turnOn = async () => {
    setBusy(true);
    setErr("");
    try {
      await alerts.update({ offers: true, sales: true });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Heading title="Your email alerts are off" text={`Turn them on to hear about offers and sales at ${alerts.settings.email}.`} />
      <div className="mt-3 pl-12">
        <button type="button" onClick={turnOn} disabled={busy} className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Turn on alerts
        </button>
        {err && <p className="mt-2 text-[11px] text-destructive">{err}</p>}
      </div>
    </>
  );
}

function AlertsBody({ alerts, status, title, text }) {
  if (status === "pending") return <CheckInbox alerts={alerts} />;
  if (status === "off") return <TurnBackOn alerts={alerts} />;
  return (
    <>
      <Heading title={title} text={text} ping />
      <EmailForm alerts={alerts} />
    </>
  );
}

function AlertsCard({ address, title, text, dismissible }) {
  const alerts = useEmailSettings(address);
  const status = statusOf(alerts, address);
  const [dismissed, setDismissed] = useState(() => dismissible && alertsMemory(address) === "dismissed");

  if (status === "loading" || (dismissed && status === "none")) return null;
  if (status === "on") return <AlertsOn email={alerts.settings?.email} />;

  const dismiss = () => {
    setAlertsMemory(address, "dismissed");
    setDismissed(true);
  };
  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 text-left">
      {dismissible && status === "none" && (
        <button type="button" onClick={dismiss} aria-label="Not now" title="Not now"
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <AlertsBody alerts={alerts} status={status} title={title} text={text} />
    </div>
  );
}

// A callout that asks the connected wallet for an email to send offer and sale alerts to.
// Shrinks to "Email alerts on" once they're set up; shows nothing without a connected wallet.
export function EmailAlertsCard({ title = "Get an email about offers and sales", text = ALL_ALERTS, dismissible = false }) {
  const { address, isConnected } = useAccount();
  if (!isConnected || !address) return null;
  return <AlertsCard key={address} address={address} title={title} text={text} dismissible={dismissible} />;
}

function AlertsDialogBody({ address }) {
  const alerts = useEmailSettings(address);
  const status = statusOf(alerts, address);
  if (status === "loading") return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto my-6" />;
  if (status === "on") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{ALL_ALERTS.replace("Get an email", "You'll get an email")}</p>
        <AlertsOn email={alerts.settings?.email} />
      </div>
    );
  }
  return <AlertsBody alerts={alerts} status={status} title="Never miss an offer" text={`${ALL_ALERTS} Free, and you can turn it off any time.`} />;
}

// A header button that opens the alerts sign-up (or asks to connect a wallet first)
export function EmailAlertsButton({ className = "" }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [open, setOpen] = useState(false);
  const connected = isConnected && !!address;
  const alerts = useEmailSettings(connected ? address : undefined);
  const on = connected && statusOf(alerts, address) === "on";

  return (
    <>
      <button
        type="button"
        onClick={() => (connected ? setOpen(true) : openConnectModal?.())}
        className={`inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-semibold font-display transition-colors ${className}`}
      >
        <span className="relative flex">
          {on ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {!on && <Ping />}
        </span>
        {on ? "Alerts on" : "Get offer alerts"}
      </button>
      <AnimatePresence>
        {open && connected && (
          <VeHemiDialog title={<><Bell className="w-5 h-5 text-primary" /> Email alerts</>} onClose={() => setOpen(false)}>
            <AlertsDialogBody address={address} />
          </VeHemiDialog>
        )}
      </AnimatePresence>
    </>
  );
}
