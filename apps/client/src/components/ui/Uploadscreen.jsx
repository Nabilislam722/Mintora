import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle, Pencil, Wallet, Bell, Palette, Code2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { response } from "express";

/**
 * UploadScreen — Full settings page (mirrors the OpenSea-style layout in the design)
 *
 * Props:
 *  - address:   string
 *  - dbUser:    { username, bio, profileImageUrl, bannerImageUrl } | null
 *  - onSuccess: (patch) => void
 *  - onClose:   () => void   (optional — e.g. navigate back)
 */

const STYLES = `
  .settings-layout {
    display: flex;
    min-height: calc(100vh - 64px);
  }

  /* ── Sidebar ── */
  .settings-nav {
    width: 220px;
    flex-shrink: 0;
    padding: 1.5rem 0.75rem;
    border-right: 1px solid rgba(255,255,255,.06);
  }
  .settings-nav-title {
    font-size: .7rem;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: rgba(255,255,255,.25);
    padding: .25rem .75rem .75rem;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: .65rem;
    padding: .55rem .75rem;
    border-radius: 10px;
    font-size: .875rem;
    font-weight: 500;
    color: rgba(255,255,255,.45);
    cursor: pointer;
    transition: background .13s, color .13s;
    text-decoration: none;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
  }
  .nav-item:hover { background: rgba(255,255,255,.05); color: rgba(255,255,255,.75); }
  .nav-item.active { background: rgba(255,255,255,.08); color: rgba(255,255,255,.9); }

  /* ── Main ── */
  .settings-main {
    flex: 1;
    padding: 2.5rem 3rem;
    max-width: 760px;
  }
  .settings-section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: rgba(255,255,255,.9);
    margin-bottom: 2rem;
    font-family: var(--font-display, inherit);
  }

  /* ── Banner ── */
  .banner-wrap {
    position: relative;
    width: 100%;
    height: 220px;
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    margin-bottom: -48px;
    background: linear-gradient(135deg, #6d28d9, #be185d 60%, #7c3aed);
  }
  .banner-wrap img { width:100%; height:100%; object-fit:cover; }
  .banner-edit-overlay {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0);
    transition: background .18s;
  }
  .banner-wrap:hover .banner-edit-overlay { background: rgba(0,0,0,.45); }
  .banner-edit-overlay .pencil-btn {
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(255,255,255,.15);
    border: 1.5px solid rgba(255,255,255,.3);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .18s;
    backdrop-filter: blur(6px);
  }
  .banner-wrap:hover .pencil-btn { opacity: 1; }

  /* ── Avatar ── */
  .avatar-wrap {
    position: relative;
    width: 88px; height: 88px;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid #0c0c0e;
    cursor: pointer;
    margin-left: 2rem;
    flex-shrink: 0;
    z-index: 10;
  }
  .avatar-wrap img { width:100%; height:100%; object-fit:cover; }
  .avatar-edit-overlay {
    position: absolute; inset: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0); transition: background .18s;
  }
  .avatar-wrap:hover .avatar-edit-overlay { background: rgba(0,0,0,.55); }
  .avatar-edit-overlay .pencil-btn {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,255,255,.2);
    border: 1px solid rgba(255,255,255,.35);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .18s;
  }
  .avatar-wrap:hover .pencil-btn { opacity: 1; }

  /* ── Fields ── */
  .field-group { margin-bottom: 1.75rem; }
  .field-label {
    display: block;
    font-size: .8rem;
    font-weight: 600;
    color: rgba(255,255,255,.65);
    margin-bottom: .5rem;
  }
  .field-hint {
    font-size: .75rem;
    color: rgba(255,255,255,.25);
    margin-top: .4rem;
  }
  .settings-input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,.12);
    padding: .6rem 0;
    font-size: .9rem;
    color: rgba(255,255,255,.8);
    outline: none;
    transition: border-color .15s;
    font-family: inherit;
    resize: none;
  }
  .settings-input::placeholder { color: rgba(255,255,255,.2); }
  .settings-input:focus { border-bottom-color: rgba(255,255,255,.4); }

  .char-count { font-size: .7rem; color: rgba(255,255,255,.18); text-align: right; margin-top: .35rem; }
  .char-count.warn { color: rgba(251,146,60,.6); }

  /* ── Divider ── */
  .settings-divider { border: none; border-top: 1px solid rgba(255,255,255,.06); margin: 2rem 0; }

  /* ── Progress ── */
  .progress-bar { height: 2px; background: rgba(255,255,255,.07); border-radius: 99px; overflow: hidden; margin-top: .75rem; }
  .progress-fill { height: 100%; background: hsl(var(--primary)); border-radius: 99px; transition: width .2s; }
`;

const MAX_MB = 5;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const NAV_ITEMS = [
  { id: "profile",       label: "Profile",             Icon: Wallet },
  { id: "wallets",       label: "Linked Wallets",      Icon: Wallet },
  { id: "notifications", label: "Email Notifications", Icon: Bell },
  { id: "customize",     label: "Customize",           Icon: Palette },
  { id: "developer",     label: "Developer",           Icon: Code2 },
  { id: "verification",  label: "Verification",        Icon: ShieldCheck },
];

function useImagePicker(initial) {
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(initial || null);
  const [err, setErr]         = useState("");

  const pick = (f) => {
    setErr("");
    if (!ACCEPT.includes(f.type)) { setErr("Use JPG, PNG, WEBP, or GIF."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`Max ${MAX_MB} MB.`); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  return { file, preview, err, pick };
}

export default function UploadScreen({ address, dbUser, onSuccess, onClose }) {
  const [activeNav, setActiveNav] = useState("profile");

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

  /* Upload helper */
  async function uploadFile(file, uploadType, onProgress) {
    const pRes = await fetch("/api/upload/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, fileType: file.type, uploadType, address }),
    });
    if (!pRes.ok) throw new Error("Failed to get upload URL");
    const { uploadUrl, publicUrl } = await pRes.json();
    await new Promise((res, rej) => {
      const xhr = new XMLHttpRequest();
     
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
      xhr.onload  = () => xhr.status < 300 ? res() : rej(new Error(String(xhr.status)));
      xhr.onerror = () => rej(new Error("Network error"));
      xhr.send(file);
    });
    return publicUrl;
  }

  const handleSave = async () => {
    setStatus("uploading"); setProgress(0); setSaveErr("");
    try {
      const patch = {};
      if (avatar.file) {
        patch.profileImageUrl = await uploadFile(avatar.file, "avatar", p => setProgress(Math.round(p * .45)));
      }
      if (banner.file) {
        patch.bannerImageUrl = await uploadFile(banner.file, "banner", p => setProgress(45 + Math.round(p * .45)));
      }
      setProgress(92);
      if (username.trim() !== (dbUser?.username || "")) patch.username = username.trim();
      if (bio.trim()      !== (dbUser?.bio      || "")) patch.bio      = bio.trim();
      if (url.trim()      !== (dbUser?.url      || "")) patch.url      = url.trim();

      if (Object.keys(patch).length > 0) {
        const r = await fetch(`/api/users/${address}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!r.ok) throw new Error("Failed to save");
      }
      setProgress(100); setStatus("success");
      setTimeout(() => { onSuccess?.(patch); }, 600);
    } catch (e) {
      setSaveErr(e.message || "Something went wrong."); setStatus("error");
    }
  };

  const hasChanges = avatar.file || banner.file
    || username.trim() !== (dbUser?.username || "")
    || bio.trim()      !== (dbUser?.bio      || "")
    || url.trim()      !== (dbUser?.url      || "");

  return (
    <>
      <style>{STYLES}</style>

      <div className="settings-layout">

        {/* ── Sidebar ── */}
        <nav className="settings-nav">
          <p className="settings-nav-title">Settings</p>
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeNav === id ? "active" : ""}`}
              onClick={() => setActiveNav(id)}
            >
              <Icon className="w-4 h-4 opacity-70" />
              {label}
            </button>
          ))}
        </nav>

        {/* ── Main content ── */}
        <main className="settings-main">

          {activeNav === "profile" && (
            <>
              {/* Banner */}
              <div
                className="banner-wrap"
                onClick={() => bannerRef.current?.click()}
              >
                {banner.preview
                  ? <img src={banner.preview} alt="banner" />
                  : null
                }
                <div className="banner-edit-overlay">
                  <div className="pencil-btn"><Pencil className="w-4 h-4 text-white" /></div>
                </div>
                <input ref={bannerRef} type="file" accept={ACCEPT.join(",")} className="hidden"
                  onChange={e => e.target.files[0] && banner.pick(e.target.files[0])} />
              </div>

              {/* Avatar row */}
              <div className="flex items-end mb-6">
                <div
                  className="avatar-wrap"
                  onClick={() => avatarRef.current?.click()}
                >
                  {avatar.preview
                    ? <img src={avatar.preview} alt="avatar" />
                    : <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <span className="text-2xl font-bold text-black">{address?.slice(2,4).toUpperCase()}</span>
                      </div>
                  }
                  <div className="avatar-edit-overlay">
                    <div className="pencil-btn"><Pencil className="w-3 h-3 text-white" /></div>
                  </div>
                  <input ref={avatarRef} type="file" accept={ACCEPT.join(",")} className="hidden"
                    onChange={e => e.target.files[0] && avatar.pick(e.target.files[0])} />
                </div>
              </div>

              {/* Image errors */}
              {(avatar.err || banner.err) && (
                <div className="flex items-center gap-2 bg-rose-500/08 border border-rose-500/15 rounded-lg px-3 py-2 mb-5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-400">{avatar.err || banner.err}</p>
                </div>
              )}

              <p className="settings-section-title">Edit Profile</p>

              {/* Username */}
              <div className="field-group">
                <label className="field-label">Username</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Enter a username"
                  value={username}
                  maxLength={32}
                  onChange={e => setUsername(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <p className="field-hint">This is your public username.</p>
                  <span className={`char-count ${username.length > 28 ? "warn" : ""}`}>{username.length}/32</span>
                </div>
              </div>

              {/* Bio */}
              <div className="field-group">
                <label className="field-label">Bio</label>
                <textarea
                  className="settings-input"
                  placeholder="Tell the world about yourself…"
                  value={bio}
                  maxLength={160}
                  rows={3}
                  onChange={e => setBio(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <span />
                  <span className={`char-count ${bio.length > 140 ? "warn" : ""}`}>{bio.length}/160</span>
                </div>
              </div>

              {/* URL */}
              <div className="field-group">
                <label className="field-label">URL</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Add a URL"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
              </div>

              <hr className="settings-divider" />

              {/* Save error */}
              {saveErr && (
                <div className="flex items-center gap-2 bg-rose-500/08 border border-rose-500/15 rounded-lg px-3 py-2 mb-4">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-400">{saveErr}</p>
                </div>
              )}

              {/* Progress */}
              {status === "uploading" && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,.25)" }}>
                    <span>Saving…</span><span>{progress}%</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                </div>
              )}

              {/* Save button — bottom right like the screenshot */}
              <div className="flex justify-end">
                <Button
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-8 h-11 disabled:opacity-35"
                  onClick={handleSave}
                  disabled={!hasChanges || status === "uploading" || status === "success"}
                >
                  {status === "uploading" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving</>
                   : status === "success"  ? <><CheckCircle className="w-4 h-4 mr-2" />Saved!</>
                   : "Save"}
                </Button>
              </div>
            </>
          )}

          {activeNav !== "profile" && (
            <div className="flex flex-col items-center justify-center h-64 opacity-30">
              <p className="text-sm text-white/50">Coming soon</p>
            </div>
          )}

        </main>
      </div>
    </>
  );
}