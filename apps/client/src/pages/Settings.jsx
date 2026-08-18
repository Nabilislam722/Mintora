import { useState, useRef } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, CheckCircle, AlertCircle, Pencil, Wallet, Bell, Palette, Code2, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import "../components/settings.css";
import { uploadToR2 } from "../lib/uploadToR2";
import { useLayoutPreferences } from "../context/LayoutPreferencesContext";

const MAX_MB     = 5;
const ACCEPT     = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPT_STR = ACCEPT.join(",");
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const MAX_USERNAME = 32;
const MAX_BIO = 160;

const NAV = [
  { id: "profile",       label: "Profile",            Icon: User        },
  { id: "wallets",       label: "Linked Wallets",      Icon: Wallet      },
  { id: "notifications", label: "Email Notifications", Icon: Bell        },
  { id: "customize",     label: "Customize",           Icon: Palette     },
  { id: "developer",     label: "Developer",           Icon: Code2       },
  { id: "verification",  label: "Verification",        Icon: ShieldCheck },
];

function ErrorBanner({ msg }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4 bg-destructive/10 border border-destructive/20">
      <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
      <p className="text-xs text-destructive">{msg}</p>
    </div>
  );
}

function ProgressRow({ progress }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>Saving…</span>
        <span>{progress}%</span>
      </div>
      <div className="s-progress-track">
        <div className="s-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function ComingSoon({ Icon }) {
  return (
    <div className="s-soon">
      {Icon && <Icon size={36} />}
      <p className="text-sm font-medium">Coming soon</p>
    </div>
  );
}

function useImagePicker(initial) {
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(initial || null);
  const [err,     setErr]     = useState("");

  const pick = (f) => {
    setErr("");
    if (!ACCEPT.includes(f.type))      { setErr("Use JPG, PNG, WEBP, or GIF."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`Max ${MAX_MB} MB.`);           return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  return { file, preview, err, pick };
}

function isValidImage(file) {
  return !!file && ACCEPT.includes(file.type) && file.size <= MAX_MB * 1024 * 1024;
}

function ProfileTab({ address, dbUser, onSaved }) {
  const avatar = useImagePicker(dbUser?.profileImageUrl || null);
  const banner = useImagePicker(dbUser?.bannerImageUrl  || null);

  const [username, setUsername] = useState(dbUser?.username || "");
  const [bio,      setBio]      = useState(dbUser?.bio      || "");
  const [url,      setUrl]      = useState(dbUser?.url      || "");

  const [status,   setStatus]   = useState("idle");
  const [progress, setProgress] = useState(0);
  const [saveErr,  setSaveErr]  = useState("");

  const avatarRef = useRef(null);
  const bannerRef = useRef(null);

  const hasChanges =
    !!avatar.file || !!banner.file ||
    username.trim() !== (dbUser?.username || "") ||
    bio.trim()      !== (dbUser?.bio      || "") ||
    url.trim()      !== (dbUser?.url      || "");

  const handleSave = async () => {
    setSaveErr("");

    if (username.trim().length > MAX_USERNAME) {
      setSaveErr(`Username must be ${MAX_USERNAME} characters or fewer.`);
      setStatus("error");
      return;
    }
    if (bio.trim().length > MAX_BIO) {
      setSaveErr(`Bio must be ${MAX_BIO} characters or fewer.`);
      setStatus("error");
      return;
    }
    if (avatar.file && !isValidImage(avatar.file)) {
      setSaveErr(`Avatar must be JPG, PNG, WEBP, or GIF under ${MAX_MB} MB.`);
      setStatus("error");
      return;
    }
    if (banner.file && !isValidImage(banner.file)) {
      setSaveErr(`Banner must be JPG, PNG, WEBP, or GIF under ${MAX_MB} MB.`);
      setStatus("error");
      return;
    }

    setStatus("saving"); setProgress(0);
    try {
      const patch = {};

      if (avatar.file) {
        patch.profileImageUrl = await uploadToR2(
          avatar.file, "avatar", address,
          (p) => setProgress(Math.round(p * 0.45))
        );
      }
      if (banner.file) {
        patch.bannerImageUrl = await uploadToR2(
          banner.file, "banner", address,
          (p) => setProgress(45 + Math.round(p * 0.45))
        );
      }

      setProgress(92);

      if (username.trim() !== (dbUser?.username || "")) patch.username = username.trim();
      if (bio.trim()      !== (dbUser?.bio      || "")) patch.bio      = bio.trim();
      if (url.trim()      !== (dbUser?.url      || "")) patch.url      = url.trim();

      if (Object.keys(patch).length > 0) {
        const r = await fetch(`${BASE_URL}/api/users/${address}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(patch),
        });
        if (!r.ok) throw new Error("Failed to save profile");
      }

      setProgress(100);
      setStatus("success");
      setTimeout(() => { onSaved(patch); setStatus("idle"); }, 1200);
    } catch (e) {
      setSaveErr(e.message || "Something went wrong.");
      setStatus("error");
    }
  };

  return (
    <>
      {/* Banner */}
      <div className="s-banner max-md:!h-32" onClick={() => bannerRef.current?.click()}>
        {banner.preview && <img src={banner.preview} alt="banner" />}
        <div className="s-banner-overlay">
          <div className="s-pencil-lg"><Pencil className="w-4 h-4 text-white" /></div>
        </div>
        <input ref={bannerRef} type="file" accept={ACCEPT_STR} className="hidden"
          onChange={e => e.target.files[0] && banner.pick(e.target.files[0])} />
      </div>

      {/* Avatar */}
      <div className="flex items-end mb-7">
        <div className="s-avatar max-md:!w-16 max-md:!h-16" onClick={() => avatarRef.current?.click()}>
          {avatar.preview
            ? <img src={avatar.preview} alt="avatar" />
            : <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-foreground">
                  {address?.slice(2, 4).toUpperCase()}
                </span>
              </div>
          }
          <div className="s-avatar-overlay">
            <div className="s-pencil-sm"><Pencil className="w-3 h-3 text-white" /></div>
          </div>
          <input ref={avatarRef} type="file" accept={ACCEPT_STR} className="hidden"
            onChange={e => e.target.files[0] && avatar.pick(e.target.files[0])} />
        </div>
      </div>

      {(avatar.err || banner.err) && <ErrorBanner msg={avatar.err || banner.err} />}

      <p className="s-page-title">Edit Profile</p>

      {/* Username */}
      <div className="s-field">
        <label className="s-label">Username</label>
        <input type="text" className="s-input" placeholder="Enter a username"
          value={username} maxLength={MAX_USERNAME} onChange={e => setUsername(e.target.value.slice(0, MAX_USERNAME))} />
        <div className="flex items-center justify-between">
          <p className="s-hint">This is your public username.</p>
          <span className={`s-charcount ${username.length > 28 ? "warn" : ""}`}>{username.length}/{MAX_USERNAME}</span>
        </div>
      </div>

      {/* Bio */}
      <div className="s-field">
        <label className="s-label">Bio</label>
        <textarea className="s-input" placeholder="Tell the world about yourself…"
          value={bio} maxLength={MAX_BIO} rows={3} onChange={e => setBio(e.target.value.slice(0, MAX_BIO))} />
        <div className="flex justify-end">
          <span className={`s-charcount ${bio.length > 140 ? "warn" : ""}`}>{bio.length}/{MAX_BIO}</span>
        </div>
      </div>

      {/* URL */}
      <div className="s-field">
        <label className="s-label">URL</label>
        <input type="text" className="s-input" placeholder="https://"
          value={url} onChange={e => setUrl(e.target.value)} />
      </div>

      <hr className="s-divider" />

      {saveErr && <ErrorBanner msg={saveErr} />}
      {status === "saving" && <ProgressRow progress={progress} />}

      <div className="flex justify-end">
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl px-8 h-11 disabled:opacity-40 max-md:!w-full max-md:!px-4"
          onClick={handleSave}
          disabled={!hasChanges || status === "saving" || status === "success"}
        >
          {status === "saving"
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving</>
            : status === "success"
            ? <><CheckCircle className="w-4 h-4 mr-2" />Saved!</>
            : "Save"}
        </Button>
      </div>
    </>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${
        checked ? "bg-primary" : "bg-secondary"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ToggleRow({ label, description, value, onChange }) {
  const isRight = value === "right";
  return (
    <div className="flex max-[420px]:flex-col max-[420px]:items-start max-[420px]:gap-3 items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="pr-4 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-medium ${!isRight ? "text-foreground" : "text-muted-foreground"}`}>Left</span>
        <ToggleSwitch checked={isRight} onChange={(next) => onChange(next ? "right" : "left")} />
        <span className={`text-xs font-medium ${isRight ? "text-foreground" : "text-muted-foreground"}`}>Right</span>
      </div>
    </div>
  );
}

function CustomizeTab() {
  const { sidebarPosition, logoPosition, setSidebarPosition, setLogoPosition } = useLayoutPreferences();

  return (
    <>
      <p className="s-page-title">Customize</p>
      <p className="text-sm text-muted-foreground mb-2">
        Changes apply immediately and are saved to this device.
      </p>

      <ToggleRow
        label="Sidebar position"
        description="Move the hover navigation sidebar to the left or right edge of the screen."
        value={sidebarPosition}
        onChange={setSidebarPosition}
      />

      <ToggleRow
        label="Navbar logo position"
        description="Move the MINTORA logo to the left or right side of the top navbar."
        value={logoPosition}
        onChange={setLogoPosition}
      />
    </>
  );
}

export default function Settings() {
  const { address, isConnected } = useAccount();
  const { openConnectModal }     = useConnectModal();
  const { toast }                = useToast();
  const [, navigate]             = useLocation();
  const queryClient              = useQueryClient();

  const [activeNav, setActiveNav] = useState("profile");

  const { data: dbUser, isLoading } = useQuery({
    queryKey: [`${BASE_URL}/api/users/${address}`],
    queryFn:  async () => {
      const res = await fetch(`${BASE_URL}/api/users/${address}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!address,
  });

  const handleSaved = (patch) => {
    queryClient.invalidateQueries([`${BASE_URL}/api/users/${address}`]);
    toast({ title: "Profile updated!" });
  };

  if (!isConnected || !address) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto glass rounded-2xl border border-border p-8">
          <Wallet className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-display font-bold mb-4 text-foreground">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6">
            You need to connect your wallet to access settings.
          </p>
          <Button onClick={openConnectModal} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl">
            <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeNavMeta = NAV.find(n => n.id === activeNav);

  return (
    <div className="s-layout max-md:!flex max-md:!flex-col max-md:!gap-4 max-md:!px-4 max-md:!py-2">

      {/* Sidebar - Converts to a horizontal scrollable menu on mobile */}
      <nav className="s-sidebar ml-64 max-md:!static max-md:!w-full max-md:!h-auto max-md:!ml-0 max-md:!p-0 max-md:!flex max-md:!flex-row max-md:!items-center max-md:overflow-x-auto max-md:gap-2 max-md:pb-3 max-md:border-r-0 max-md:border-b max-md:border-border max-md:[&::-webkit-scrollbar]:hidden">
        <p className="s-sidebar-heading max-md:hidden">Settings</p>
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`s-nav-btn max-md:!w-auto max-md:!inline-flex max-md:!shrink-0 max-md:whitespace-nowrap max-md:text-xs max-md:px-3.5 max-md:py-2 max-md:rounded-full ${activeNav === id ? "active" : ""}`}
            onClick={() => setActiveNav(id)}
          >
            <Icon className="w-4 h-4 shrink-0" style={{ opacity: activeNav === id ? 1 : 0.6 }} />
            {label}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="s-main ml-60 max-md:!static max-md:!w-full max-md:!ml-0 max-md:!p-0">
        {activeNav === "profile" && (
          <ProfileTab address={address} dbUser={dbUser} onSaved={handleSaved} />
        )}
        {activeNav === "customize" && <CustomizeTab />}
        {activeNav !== "profile" && activeNav !== "customize" && (
          <ComingSoon Icon={activeNavMeta?.Icon} />
        )}
      </main>

    </div>
  );
}