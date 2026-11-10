import { useEffect, useState } from "react";
import { Link } from "wouter";
import { formatUnits } from "viem";
import { useOfferApprovals } from "@/hooks/use-vehemi";
import { useTxStep, useVeHemiActions } from "@/hooks/use-vehemi-actions";
import { fmt, formatDate } from "@/lib/vehemi";
import { FaKey, FaClock } from "react-icons/fa";
import { TbLoader2 } from "react-icons/tb";

const toHemi = (wei) => Number(formatUnits(wei, 18));

const btnCls = "h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50";
const chipCls = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap";

// The clock, ticking every `ms`, so offers move to "ended" (and their HEMI to "can be revoked") as their time
// runs out, without waiting for the next read from the chain
function useNow(ms) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

const timeUntil = (ms) => {
  const hours = ms / 36e5;
  if (hours >= 48) return `${Math.ceil(hours / 24)} days`;
  if (hours >= 1) return `${Math.ceil(hours)} h`;
  return `${Math.max(1, Math.ceil(ms / 6e4))} min`;
};

function StatusChip({ offer, open, now }) {
  if (offer.cancelled) return <span className={`${chipCls} bg-secondary/60 text-muted-foreground border-white/10`}>Cancelled</span>;
  if (!open) return <span className={`${chipCls} bg-secondary/60 text-muted-foreground border-white/10`}>Ended {formatDate(offer.expiry)}</span>;
  if (offer.acceptable) {
    return <span className={`${chipCls} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>Open · {timeUntil(offer.expiry - now)} left</span>;
  }
  return (
    <span className={`${chipCls} bg-amber-500/10 text-amber-400 border-amber-500/20`}>
      {offer.moved ? "Position changed hands" : "Can't be accepted now"}
    </span>
  );
}

// HEMI the market is approved to take from `address` for their offers, and how much of it no offer needs any
// more. Offers aren't escrowed, so the approval stays after an offer ends; this lets its owner take it back.
// An offer keeps its HEMI approved until it expires or is cancelled (it can come back to life if the position
// returns to the holder it was made to), the same rule the offer dialog uses.
export default function VeHemiApprovals({ address }) {
  const { data } = useOfferApprovals(address);
  const actions = useVeHemiActions();
  const { busy, run } = useTxStep();
  const [pending, setPending] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const now = useNow(30_000);

  if (!data) return null;
  const { token, allowance, offers } = data;
  const isOpen = (o) => !o.cancelled && o.expiry > now;
  const open = offers.filter(isOpen);
  const neededWei = open.reduce((sum, o) => sum + o.amountWei, 0n);
  const revocableWei = allowance > neededWei ? allowance - neededWei : 0n;
  // Nothing approved and nothing open: a one-line note, so people can see where revoking lives (and that
  // nothing of theirs is approved)
  if (allowance === 0n && open.length === 0) {
    return (
      <section className="rounded-3xl border border-border/50 bg-card px-4 py-3 flex items-center gap-3" aria-labelledby="vehemi-approvals-title">
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <FaKey className="w-4 h-4 text-primary" />
        </div>
        <p className="text-sm">
          <span id="vehemi-approvals-title" className="font-semibold">No HEMI approved for offers</span>
          <span className="text-muted-foreground">
            {" "}· nothing to revoke. When you make an offer, its approval shows here, and you can take back what an
            ended offer no longer needs.
          </span>
        </p>
      </section>
    );
  }

  const approved = toHemi(allowance);
  const needed = toHemi(neededWei);
  const revocable = toHemi(revocableWei);
  const next = open[0]; // offers come soonest-ending first
  const keptShare = allowance > 0n ? Math.min(100, (Number(neededWei) / Number(allowance)) * 100) : 0;

  const step = async (key, action, failTitle) => {
    setPending(key);
    if (await run(action, failTitle)) {
      setConfirmAll(false);
      await actions.refresh();
    }
    setPending(null);
  };
  const revokeUnused = () => step("unused", () => actions.approveHemi(token, neededWei), "Couldn't revoke the approval");
  const revokeAll = () => step("all", () => actions.approveHemi(token, 0n), "Couldn't revoke the approval");
  const cancel = (offer) => step(`cancel-${offer.id}`, () => actions.cancelOffer(offer.tokenId), "Couldn't cancel the offer");
  const spinner = (key) => (pending === key ? <TbLoader2 className="w-4 h-4 animate-spin" /> : null);

  const tiles = [
    ["Approved", `${fmt(approved)} HEMI`, ""],
    ["Still needed", `${fmt(needed)} HEMI`, ""],
    ["Can be revoked", `${fmt(revocable)} HEMI`, revocableWei > 0n ? "text-amber-400" : "text-muted-foreground"],
  ];

  return (
    <section
      className={`rounded-2xl border bg-card p-4 sm:p-5 ${revocableWei > 0n ? "border-amber-500/40" : "border-border/50"}`}
      aria-labelledby="vehemi-approvals-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <FaKey className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 id="vehemi-approvals-title" className="font-display font-bold">HEMI approved for your offers</h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Offers aren't escrowed: the HEMI stays in your wallet, and the market can take it only when a holder accepts
              one of your open offers. Once an offer ends, its approval isn't needed and you can revoke it.
            </p>
          </div>
        </div>
        {revocableWei > 0n && (
          <button type="button" onClick={revokeUnused} disabled={busy} className={`${btnCls} bg-primary hover:bg-primary/90 text-white shrink-0`}>
            {spinner("unused")} Revoke {fmt(revocable)} HEMI
          </button>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map(([label, value, cls]) => (
          <div key={label} className="rounded-xl bg-secondary/40 border border-white/5 px-3 py-2.5 min-w-0">
            <dt className="text-[11px] text-muted-foreground truncate">{label}</dt>
            <dd className={`text-sm sm:text-base font-semibold tabular-nums truncate ${cls}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* How much of the approval is still in use, and how much could be taken back */}
      {allowance > 0n && (
        <div className="mt-3 h-1.5 rounded-full bg-amber-500/50 overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${keptShare}%` }} />
        </div>
      )}

      {next && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FaClock className="w-3.5 h-3.5 shrink-0" />
          <span>
            In {timeUntil(next.expiry - now)} ({formatDate(next.expiry)}) your offer on veHEMI #{next.id} ends, and its{" "}
            {fmt(next.amount)} HEMI can be revoked too.
          </span>
        </p>
      )}
      {allowance < neededWei && (
        <p className="mt-2 text-xs text-amber-400">
          Your approval covers {fmt(approved)} of the {fmt(needed)} HEMI your open offers need, so not all of them can be filled.
        </p>
      )}

      {offers.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5 border-t border-white/5">
          {offers.map((o) => {
            const stillOpen = isOpen(o);
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                <Link href={`/vehemi/${o.id}`} className="text-sm font-semibold hover:text-primary transition-colors">
                  veHEMI #{o.id}
                </Link>
                <span className={`text-sm tabular-nums ${stillOpen ? "" : "text-muted-foreground line-through"}`}>{fmt(o.amount)} HEMI</span>
                <StatusChip offer={o} open={stillOpen} now={now} />
                <span className="ml-auto">
                  {stillOpen ? (
                    <button
                      type="button"
                      onClick={() => cancel(o)}
                      disabled={busy}
                      className={`${btnCls} h-8 px-3 text-xs border border-white/10 hover:bg-secondary`}
                    >
                      {spinner(`cancel-${o.id}`)} Cancel offer
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No longer needs approval</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {allowance > 0n && open.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs">
          {confirmAll ? (
            <>
              <span className="text-muted-foreground">
                Revoking everything stops your {open.length} open offer{open.length === 1 ? "" : "s"} from being filled.
              </span>
              <button type="button" onClick={() => setConfirmAll(false)} disabled={busy} className={`${btnCls} h-8 px-3 text-xs border border-white/10 hover:bg-secondary`}>
                Keep
              </button>
              <button type="button" onClick={revokeAll} disabled={busy} className={`${btnCls} h-8 px-3 text-xs bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25`}>
                {spinner("all")} Revoke all {fmt(approved)} HEMI
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmAll(true)} disabled={busy} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Revoke all, including open offers
            </button>
          )}
        </div>
      )}
    </section>
  );
}
