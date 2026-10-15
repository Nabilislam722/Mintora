import { useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { useDismiss } from "@/hooks/use-dismiss";

const CHAIN_ICONS = { 43111: "/hemi.svg" };
const chainName = (chain) => chain.name.replace(/ Network$/, "");

function ChainIcon({ chain }) {
  return CHAIN_ICONS[chain.id] ? (
    <img src={CHAIN_ICONS[chain.id]} alt="" className="w-5 h-5 shrink-0" />
  ) : (
    <span className="w-5 h-5 shrink-0 rounded-full bg-secondary text-[10px] font-bold flex items-center justify-center">{chain.name[0]}</span>
  );
}

// Networks come from the wagmi config in main.jsx; add a chain there and it shows up here.
// The menu is positioned with plain CSS instead of a Radix popper because html { zoom: 0.85 }
// in index.css throws off popper coordinates and pushes the menu toward the middle of the screen.
export default function NetworkSelector() {
  const { chains } = useConfig();
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const active = chains.find((c) => c.id === chainId);
  const wrongNetwork = isConnected && !active;
  const shown = active ?? chains[0];

  useDismiss(ref, open, () => setOpen(false));

  const select = (chain) => {
    setOpen(false);
    if (isConnected && chain.id !== chainId) switchChain({ chainId: chain.id });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={wrongNetwork ? "Wrong network, switch network" : `Network: ${chainName(shown)}`}
        className={`inline-flex items-center gap-2 h-10 px-3 rounded-xl border text-sm font-semibold transition-colors ${
          wrongNetwork
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : "border-border/60 bg-secondary/50 hover:bg-secondary"
        }`}
      >
        {wrongNetwork ? <AlertTriangle className="w-4 h-4" /> : <ChainIcon chain={shown} />}
        <span className="hidden sm:inline">{wrongNetwork ? "Wrong network" : chainName(shown)}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 origin-top-right"
        >
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Select network</p>
          {chains.map((chain) => (
            <button
              key={chain.id}
              type="button"
              role="menuitem"
              onClick={() => select(chain)}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <ChainIcon chain={chain} />
              <span className="flex-1 text-left font-medium">{chainName(chain)}</span>
              {(chain.id === chainId || (!isConnected && chain.id === shown.id)) && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
