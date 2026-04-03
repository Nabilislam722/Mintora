import { useState, useRef } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, CheckCircle, AlertCircle, Pencil, Wallet, Bell, Palette, Code2, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import "../components/settings.css";
import { uploadToR2 } from "../lib/uploadToR2"


const MAX_MB     = 5;
const ACCEPT     = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPT_STR = ACCEPT.join(",");

const NAV = [
  { id: "profile",       label: "Profile",             Icon: User        },
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
    setStatus("saving"); setProgress(0); setSaveErr("");
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
        const r = await fetch(`/api/users/${address}`, {
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
      <div className="s-banner" onClick={() => bannerRef.current?.click()}>
        {banner.preview && <img src={banner.preview} alt="banner" />}
        <div className="s-banner-overlay">
          <div className="s-pencil-lg"><Pencil className="w-4 h-4 text-white" /></div>
        </div>
        <input ref={bannerRef} type="file" accept={ACCEPT_STR} className="hidden"
          onChange={e => e.target.files[0] && banner.pick(e.target.files[0])} />
      </div>

      {/* Avatar */}
      <div className="flex items-end mb-7">
        <div className="s-avatar" onClick={() => avatarRef.current?.click()}>
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
          value={username} maxLength={32} onChange={e => setUsername(e.target.value)} />
        <div className="flex items-center justify-between">
          <p className="s-hint">This is your public username.</p>
          <span className={`s-charcount ${username.length > 28 ? "warn" : ""}`}>{username.length}/32</span>
        </div>
      </div>

      {/* Bio */}
      <div className="s-field">
        <label className="s-label">Bio</label>
        <textarea className="s-input" placeholder="Tell the world about yourself…"
          value={bio} maxLength={160} rows={3} onChange={e => setBio(e.target.value)} />
        <div className="flex justify-end">
          <span className={`s-charcount ${bio.length > 140 ? "warn" : ""}`}>{bio.length}/160</span>
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
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl px-8 h-11 disabled:opacity-40"
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

export default function Settings() {
  const { address, isConnected } = useAccount();
  const { openConnectModal }     = useConnectModal();
  const { toast }                = useToast();
  const [, navigate]             = useLocation();
  const queryClient              = useQueryClient();

  const [activeNav, setActiveNav] = useState("profile");

  const { data: dbUser, isLoading } = useQuery({
    queryKey: [`/api/users/${address}`],
    queryFn:  async () => {
      const res = await fetch(`/api/users/${address}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!address,
  });

  const handleSaved = (patch) => {
    queryClient.invalidateQueries([`/api/users/${address}`]);
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
    <>
      <div className="s-layout">

        {/* Sidebar */}
        <nav className="s-sidebar">
          <p className="s-sidebar-heading">Settings</p>
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`s-nav-btn ${activeNav === id ? "active" : ""}`}
              onClick={() => setActiveNav(id)}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ opacity: activeNav === id ? 1 : 0.6 }} />
              {label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main className="s-main">
          {activeNav === "profile" && (
            <ProfileTab address={address} dbUser={dbUser} onSaved={handleSaved} />
          )}
          {activeNav !== "profile" && (
            <ComingSoon Icon={activeNavMeta?.Icon} />
          )}
        </main>
      </div>
    </>
  );
}