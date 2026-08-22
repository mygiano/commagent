import { useState, useEffect, useRef } from "react";
import {
  X, Send, Shield, UserPlus, Trash2,
  Pencil, KeyRound, LogOut, Radio, AlertTriangle, ChevronLeft, Eye, EyeOff, Lock, CornerUpLeft,
  Paperclip, FileText, Download, Camera, Mic, Square,
} from "lucide-react";
import { useAgents, useAgentMessages } from "./dataHooks";
import { supabaseStatus } from "./supabaseClient";

/* ---------------------------------------------------------------
   CONFIG
--------------------------------------------------------------- */
const ADMIN_PASSWORD = "SHADOW9"; // change this before real use

const ink = {
  bg: "#0B0E0C",
  panel: "#121613",
  panel2: "#171C18",
  line: "#262B26",
  text: "#E9E6DD",
  muted: "#8A9089",
  stamp: "#B8402F",
  green: "#39D98A",
  greenDim: "#1F5C3F",
};

const mono = {
  fontFamily:
    "'IBM Plex Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
};

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — keep uploads snappy on mobile

// Records a short voice note via the mic and hands back a File once stopped,
// via onDone(file). Shared by both the admin composer and the agent composer.
function useVoiceRecorder(onDone, onError) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearInterval(timerRef.current);
  }

  async function start() {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Perangkat ini tidak mendukung rekam suara");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext = (mr.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type });
        cleanupStream();
        onDone(file);
      };
      recorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      onError?.("Tidak bisa akses microphone — izin ditolak?");
    }
  }

  function stop() {
    if (!isRecording) return;
    recorderRef.current?.stop();
    setIsRecording(false);
  }

  function cancel() {
    if (recorderRef.current) {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    cleanupStream();
    setIsRecording(false);
  }

  useEffect(() => () => cleanupStream(), []);

  return { isRecording, seconds, start, stop, cancel };
}

// Renders a message's file attachment, if any. Handles the "expired"
// case (file auto-deleted after 30 days, file_url is null but the
// filename is still on record) with a muted placeholder.
function AttachmentView({ m }) {
  if (m.file_name && !m.file_url) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-[10px] mb-1" style={{ background: "rgba(0,0,0,0.15)", color: ink.muted }}>
        <FileText size={12} /> {m.file_name} — file dihapus otomatis (30 hari)
      </div>
    );
  }
  if (!m.file_url) return null;

  const isImage = (m.file_type || "").startsWith("image/");
  const isAudio = (m.file_type || "").startsWith("audio/");

  if (isImage) {
    return (
      <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img
          src={m.file_url}
          alt={m.file_name || "photo"}
          className="rounded-sm max-w-[200px] max-h-[220px] object-cover"
          style={{ border: `1px solid ${ink.line}` }}
        />
      </a>
    );
  }

  if (isAudio) {
    return (
      <div className="mb-1">
        <audio controls src={m.file_url} style={{ height: 32, maxWidth: 220 }} />
      </div>
    );
  }

  return (
    <a
      href={m.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2 py-1.5 rounded-sm mb-1"
      style={{ background: "rgba(0,0,0,0.15)" }}
    >
      <FileText size={14} />
      <div className="min-w-0 text-left">
        <div className="text-[11px] truncate max-w-[160px]">{m.file_name || "File"}</div>
        <div className="text-[9px] opacity-70">{fmtSize(m.file_size)}</div>
      </div>
      <Download size={12} className="ml-auto shrink-0" />
    </a>
  );
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// Desktop-only fallback for the camera button: a small modal with a live
// webcam preview and a shutter button. On mobile we skip this entirely and
// use the native camera via <input capture> instead, which feels better there.
function WebcamCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser ini tidak mendukung akses webcam");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Tidak bisa akses webcam — izin ditolak atau tidak ada kamera"));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-sm rounded-md overflow-hidden" style={{ background: ink.panel, border: `1px solid ${ink.line}` }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: ink.line }}>
          <span className="text-[11px] uppercase tracking-widest flex items-center gap-1" style={{ color: ink.muted }}>
            <Camera size={12} /> Ambil Foto
          </span>
          <button onClick={onClose}><X size={16} color={ink.muted} /></button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="text-xs py-8 text-center" style={{ color: ink.stamp }}>{error}</div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-sm" style={{ background: "#000", transform: "scaleX(-1)" }} />
          )}
        </div>
        {!error && (
          <div className="px-4 pb-4">
            <button onClick={capture} className="w-full py-2 rounded-sm text-xs uppercase tracking-widest font-bold" style={{ background: ink.green, color: ink.bg }}>
              Jepret
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ROOT APP
   Agents + messages now live in Supabase (Postgres + Realtime), so
   the admin console and the agent widget stay in sync across any
   device or browser — not just within one page session.
--------------------------------------------------------------- */
export default function App() {
  const { agents, addAgent, editAgent, removeAgent, clearAgentView } = useAgents();
  const [view, setView] = useState("site"); // 'site' | 'admin'
  const [widgetOpen, setWidgetOpen] = useState(false);

  return (
    <div
      style={{ ...mono, background: ink.bg, color: ink.text, height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
      className="relative w-full"
    >
      {view === "site" && <SiteHome onAdmin={() => setView("admin")} />}
      {view === "admin" && (
        <AdminConsole
          agents={agents}
          addAgent={addAgent}
          editAgent={editAgent}
          removeAgent={removeAgent}
          onExit={() => setView("site")}
        />
      )}

      <ChatWidget
        agents={agents}
        clearAgentView={clearAgentView}
        open={widgetOpen}
        setOpen={setWidgetOpen}
      />
    </div>
  );
}

/* ---------------------------------------------------------------
   PUBLIC SITE (the "normal website" wrapper)
--------------------------------------------------------------- */
function SiteHome({ onAdmin }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="flex items-center justify-between px-6 md:px-10 py-5 border-b"
        style={{ borderColor: ink.line }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 flex items-center justify-center rounded-sm"
            style={{ background: ink.green }}
          >
            <span style={{ color: ink.bg, fontWeight: 900, fontSize: 13 }}>M</span>
          </div>
          <span className="tracking-[0.2em] text-sm font-bold uppercase">
            Meridian Field Logistics
          </span>
        </div>
        <nav className="hidden md:flex gap-8 text-xs uppercase tracking-widest" style={{ color: ink.muted }}>
          <span>Services</span>
          <span>Network</span>
          <span>Contact</span>
        </nav>
      </header>

      <main className="flex-1 px-6 md:px-10 py-16 md:py-24 max-w-4xl">
        <div className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: ink.green }}>
          Est. — Discreet Freight &amp; Field Coordination
        </div>
        <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] mb-6">
          Cargo moves quietly.
          <br />
          <span style={{ color: ink.muted }}>So does the paperwork.</span>
        </h1>
        <p className="max-w-xl text-sm md:text-base leading-relaxed" style={{ color: ink.muted }}>
          Meridian coordinates last-mile logistics across contested and
          low-visibility corridors. Every shipment gets a dedicated field
          contact and a private line — use the comms terminal in the corner
          to reach your assigned coordinator.
        </p>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {[
            ["01", "Route Planning", "Corridor mapping with fallback paths for every leg."],
            ["02", "Field Contacts", "A dedicated coordinator assigned to every active file."],
            ["03", "Secure Comms", "Sending requires your agent code. Closing clears your view — command keeps full history."],
          ].map(([n, t, d]) => (
            <div key={n} className="p-5 rounded-md border" style={{ borderColor: ink.line, background: ink.panel }}>
              <div className="text-xs mb-3" style={{ color: ink.green }}>{n}</div>
              <div className="text-sm font-bold uppercase tracking-wide mb-2">{t}</div>
              <div className="text-xs leading-relaxed" style={{ color: ink.muted }}>{d}</div>
            </div>
          ))}
        </div>
      </main>

      <footer
        className="px-6 md:px-10 py-6 border-t flex items-center justify-between text-xs"
        style={{ borderColor: ink.line, color: ink.muted }}
      >
        <span>© Meridian Field Logistics</span>
        <button
          onClick={onAdmin}
          className="uppercase tracking-widest hover:underline underline-offset-4"
          style={{ color: ink.muted }}
        >
          Staff Portal
        </button>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------
   ADMIN CONSOLE
--------------------------------------------------------------- */
function AdminConsole({ agents, addAgent, editAgent, removeAgent, onExit }) {
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function attemptLogin() {
    if (pwInput.trim() === ADMIN_PASSWORD) {
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm p-6 rounded-md border" style={{ borderColor: ink.line, background: ink.panel }}>
          <div className="flex items-center gap-2 mb-5">
            <Shield size={16} color={ink.green} />
            <span className="text-xs uppercase tracking-[0.25em]" style={{ color: ink.muted }}>
              Command Access
            </span>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest block mb-2" style={{ color: ink.muted }}>
              Passphrase
            </label>
            <div className="relative mb-1">
              <input
                type={showPw ? "text" : "password"}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="text"
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
                onKeyDown={(e) => e.key === "Enter" && attemptLogin()}
                className="w-full px-3 py-2 pr-10 rounded-sm outline-none text-sm"
                style={{ background: ink.bg, border: `1px solid ${pwError ? ink.stamp : ink.line}`, color: ink.text }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: ink.muted }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwError && (
              <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: ink.stamp }}>
                <AlertTriangle size={12} /> Access denied
              </div>
            )}
            <button
              type="button"
              onClick={attemptLogin}
              className="w-full mt-4 py-2 rounded-sm text-xs uppercase tracking-widest font-bold"
              style={{ background: ink.green, color: ink.bg }}
            >
              Authenticate
            </button>
          </div>
          <button
            onClick={onExit}
            className="w-full mt-3 py-2 text-[11px] uppercase tracking-widest flex items-center justify-center gap-1"
            style={{ color: ink.muted }}
          >
            <ChevronLeft size={12} /> Back to site
          </button>
          <div className="mt-4 pt-4 border-t text-[10px] text-center" style={{ borderColor: ink.line, color: supabaseStatus.configured ? ink.green : ink.stamp }}>
            {supabaseStatus.configured
              ? `Supabase: connected (${supabaseStatus.host})`
              : "Supabase: NOT CONFIGURED — cek env var VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY di Vercel, lalu redeploy"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      agents={agents}
      addAgent={addAgent}
      editAgent={editAgent}
      removeAgent={removeAgent}
      onExit={onExit}
    />
  );
}

function AdminDashboard({ agents, addAgent, editAgent, removeAgent, onExit }) {
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  function validCode(code, ignoreId) {
    if (!/^\d{3}$/.test(code)) return "Code must be exactly 3 digits";
    if (agents.some((a) => a.code === code && a.id !== ignoreId)) return "Code already in use";
    return "";
  }

  async function handleAddAgent() {
    const err = validCode(newCode, null);
    if (!newName.trim()) return setFormError("Name required");
    if (err) return setFormError(err);
    const { error: dbErr } = await addAgent(newName.trim(), newCode);
    if (dbErr) return setFormError(dbErr.message);
    setNewName(""); setNewCode(""); setFormError("");
  }

  function handleRemoveAgent(id) {
    removeAgent(id);
    if (selected === id) setSelected(null);
  }

  async function saveEdit(id) {
    const err = validCode(editCode, id);
    if (!editName.trim()) return;
    if (err) return;
    const { error: dbErr } = await editAgent(id, { name: editName.trim(), code: editCode });
    if (!dbErr) setEditingId(null);
  }

  const selectedAgent = agents.find((a) => a.id === selected) || null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b" style={{ borderColor: ink.line }}>
        <div className="flex items-center gap-2">
          <Shield size={16} color={ink.green} />
          <span className="text-xs uppercase tracking-[0.25em]" style={{ color: ink.muted }}>Command Console</span>
        </div>
        <button onClick={onExit} className="flex items-center gap-1 text-[11px] uppercase tracking-widest" style={{ color: ink.muted }}>
          <LogOut size={12} /> Exit
        </button>
      </header>

      <div className="flex-1 grid md:grid-cols-[340px_1fr]">
        {/* Roster */}
        <div className="border-r p-5 md:p-6" style={{ borderColor: ink.line }}>
          <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: ink.muted }}>Agent Roster</div>

          <div className="space-y-1 mb-6">
            {agents.length === 0 && (
              <div className="text-xs py-6 text-center rounded-sm border border-dashed" style={{ borderColor: ink.line, color: ink.muted }}>
                No agents on file yet
              </div>
            )}
            {agents.map((a) => (
              <div key={a.id} className="rounded-sm px-3 py-2" style={{ background: selected === a.id ? ink.panel2 : "transparent", border: `1px solid ${selected === a.id ? ink.line : "transparent"}` }}>
                {editingId === a.id ? (
                  <div className="space-y-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 text-xs rounded-sm outline-none" style={{ background: ink.bg, border: `1px solid ${ink.line}`, color: ink.text }} />
                    <input value={editCode} onChange={(e) => setEditCode(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Code" className="w-full px-2 py-1 text-xs rounded-sm outline-none tracking-widest" style={{ background: ink.bg, border: `1px solid ${ink.line}`, color: ink.text }} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(a.id)} className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm" style={{ background: ink.green, color: ink.bg }}>Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm" style={{ color: ink.muted }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <button onClick={() => setSelected(a.id)} className="text-left flex-1">
                      <div className="text-sm">{a.name}</div>
                      <div className="text-[10px] tracking-[0.2em]" style={{ color: ink.muted }}>
                        CODE {a.code} · ID {a.id.slice(0, 6)}
                      </div>
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingId(a.id); setEditName(a.name); setEditCode(a.code); }} style={{ color: ink.muted }}><Pencil size={13} /></button>
                      <button onClick={() => handleRemoveAgent(a.id)} style={{ color: ink.stamp }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-sm border mb-8" style={{ borderColor: ink.line, background: ink.panel }}>
            <div className="text-[11px] uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: ink.muted }}>
              <UserPlus size={12} /> New Agent
            </div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Codename" className="w-full mb-2 px-2 py-1.5 text-xs rounded-sm outline-none" style={{ background: ink.bg, border: `1px solid ${ink.line}`, color: ink.text }} />
            <input value={newCode} onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="3-digit code" className="w-full mb-2 px-2 py-1.5 text-xs rounded-sm outline-none tracking-widest" style={{ background: ink.bg, border: `1px solid ${ink.line}`, color: ink.text }} />
            {formError && <div className="text-[10px] mb-2" style={{ color: ink.stamp }}>{formError}</div>}
            <button
              type="button"
              onClick={handleAddAgent}
              className="w-full py-2.5 text-[10px] uppercase tracking-widest font-bold rounded-sm"
              style={{ background: ink.green, color: ink.bg }}
            >
              Add to roster
            </button>
          </div>
        </div>

        {/* Inbox */}
        <div className="p-5 md:p-8">
          {!selectedAgent ? (
            <div className="h-full flex items-center justify-center text-xs text-center" style={{ color: ink.muted }}>
              Select an agent to view their private line
            </div>
          ) : (
            <AdminInboxView agent={selectedAgent} />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminInboxView({ agent }) {
  const { messages, send } = useAgentMessages(agent.id);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // { id, text, label }
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [webcamOpen, setWebcamOpen] = useState(false);

  function handleCameraClick() {
    if (isMobileDevice()) {
      cameraInputRef.current?.click();
    } else {
      setWebcamOpen(true);
    }
  }

  function showFileError(msg) {
    setFileError(msg);
    setTimeout(() => setFileError(""), 2200);
  }

  const recorder = useVoiceRecorder(
    (file) => setPendingFile(file),
    (msg) => showFileError(msg)
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Autofocus the composer whenever a different agent's inbox is opened.
  useEffect(() => {
    inputRef.current?.focus();
  }, [agent.id]);

  function focusReply(target) {
    setReplyingTo(target);
    inputRef.current?.focus();
  }

  function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      showFileError("File maksimal 10MB");
      return;
    }
    setPendingFile(file);
    inputRef.current?.focus();
  }

  async function submit() {
    if (!text.trim() && !pendingFile) return;
    setUploading(true);
    const { error } = await send("admin", text.trim(), replyingTo, pendingFile);
    setUploading(false);
    if (error) {
      showFileError(error.message);
      return;
    }
    setText("");
    setReplyingTo(null);
    setPendingFile(null);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="pb-4 mb-4 border-b" style={{ borderColor: ink.line }}>
        <div className="text-sm font-bold">{agent.name}</div>
        <div className="text-[10px] tracking-[0.2em]" style={{ color: ink.muted }}>
          PRIVATE LINE · CODE {agent.code} · ID {agent.id.slice(0, 6)}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4" style={{ maxHeight: 420 }}>
        {messages.length === 0 && <div className="text-xs" style={{ color: ink.muted }}>No messages yet.</div>}
        {messages.map((m) => {
          const mine = m.sender === "admin";
          return (
            <div key={m.id} className={`max-w-sm group ${mine ? "ml-auto text-right" : ""}`}>
              <div className={`flex items-end gap-1 ${mine ? "justify-end" : ""}`}>
                {!mine && (
                  <button onClick={() => focusReply({ id: m.id, text: m.text, label: agent.name })} style={{ color: ink.muted }}>
                    <CornerUpLeft size={13} />
                  </button>
                )}
                <div className="inline-block px-3 py-2 rounded-md text-xs" style={{ background: mine ? ink.greenDim : ink.panel2, border: `1px solid ${ink.line}` }}>
                  {m.reply_to && (
                    <div className="mb-1 pl-2 text-[10px] opacity-70" style={{ borderLeft: `2px solid ${ink.green}` }}>
                      {(m.reply_to.text && m.reply_to.text.length > 60) ? m.reply_to.text.slice(0, 60) + "…" : (m.reply_to.text || "")}
                    </div>
                  )}
                  <AttachmentView m={m} />
                  {m.text}
                </div>
                {mine && (
                  <button onClick={() => focusReply({ id: m.id, text: m.text, label: "Command" })} style={{ color: ink.muted }}>
                    <CornerUpLeft size={13} />
                  </button>
                )}
              </div>
              <div className="text-[10px] mt-1" style={{ color: ink.muted }}>{fmtTime(m.created_at)}</div>
            </div>
          );
        })}
      </div>

      {replyingTo && (
        <div className="mb-2 px-3 py-2 rounded-sm flex items-center justify-between" style={{ background: ink.panel2, border: `1px solid ${ink.line}` }}>
          <div className="text-[11px] min-w-0">
            <div className="uppercase tracking-widest mb-0.5" style={{ color: ink.green }}>Replying to {replyingTo.label}</div>
            <div className="truncate" style={{ color: ink.muted }}>{replyingTo.text}</div>
          </div>
          <button onClick={() => setReplyingTo(null)} style={{ color: ink.muted }}><X size={14} /></button>
        </div>
      )}

      {pendingFile && (
        <div className="mb-2 px-3 py-2 rounded-sm flex items-center justify-between" style={{ background: ink.panel2, border: `1px solid ${ink.line}` }}>
          <div className="text-[11px] min-w-0 flex items-center gap-2">
            <FileText size={13} color={ink.green} />
            <div className="min-w-0">
              <div className="truncate max-w-[180px]">{pendingFile.name}</div>
              <div style={{ color: ink.muted }}>{fmtSize(pendingFile.size)}</div>
            </div>
          </div>
          <button onClick={() => setPendingFile(null)} style={{ color: ink.muted }}><X size={14} /></button>
        </div>
      )}
      {fileError && (
        <div className="mb-2 text-[11px] flex items-center gap-1" style={{ color: ink.stamp }}>
          <AlertTriangle size={11} /> {fileError}
        </div>
      )}

      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv" onChange={pickFile} className="hidden" />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={pickFile} className="hidden" />
        {recorder.isRecording ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: ink.panel2, border: `1px solid ${ink.stamp}` }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ink.stamp }} />
            <span className="text-xs" style={{ color: ink.text }}>Merekam… {fmtDuration(recorder.seconds)}</span>
            <button onClick={() => recorder.cancel()} className="ml-auto text-[10px] uppercase tracking-widest" style={{ color: ink.muted }}>Batal</button>
            <button onClick={() => recorder.stop()} className="px-2 py-1 rounded-sm" style={{ background: ink.stamp }}>
              <Square size={12} color="#fff" />
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => fileInputRef.current?.click()} className="px-2.5 rounded-sm" style={{ border: `1px solid ${ink.line}`, color: ink.muted }}>
              <Paperclip size={14} />
            </button>
            <button onClick={handleCameraClick} className="px-2.5 rounded-sm" style={{ border: `1px solid ${ink.line}`, color: ink.muted }}>
              <Camera size={14} />
            </button>
            <button onClick={() => recorder.start()} className="px-2.5 rounded-sm" style={{ border: `1px solid ${ink.line}`, color: ink.muted }}>
              <Mic size={14} />
            </button>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={pendingFile ? "Caption (opsional)..." : `Message ${agent.name}...`}
              className="flex-1 px-3 py-2 text-xs rounded-sm outline-none"
              style={{ background: ink.bg, border: `1px solid ${ink.line}`, color: ink.text }}
            />
            <button onClick={submit} disabled={uploading} className="px-3 rounded-sm" style={{ background: ink.green, color: ink.bg, opacity: uploading ? 0.6 : 1 }}>
              {uploading ? <span className="text-[10px]">…</span> : <Send size={14} />}
            </button>
          </>
        )}
      </div>
      {webcamOpen && (
        <WebcamCaptureModal
          onCapture={(file) => { setPendingFile(file); setWebcamOpen(false); inputRef.current?.focus(); }}
          onClose={() => setWebcamOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   CHAT WIDGET (the special feature)
--------------------------------------------------------------- */
function ChatWidget({ agents, clearAgentView, open, setOpen }) {
  const [agentId, setAgentId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [idCode, setIdCode] = useState("");
  const [idError, setIdError] = useState(false);
  const idInputRef = useRef(null);

  const agent = agents.find((a) => a.id === agentId) || null;

  useEffect(() => {
    if (open && !agent) idInputRef.current?.focus();
  }, [open, agent]);

  function tryIdentify() {
    const match = agents.find((a) => a.code === idCode);
    if (match) {
      setAgentId(match.id);
      setIdCode("");
      setIdError(false);
    } else {
      setIdError(true);
      setIdCode("");
      setTimeout(() => setIdError(false), 700);
    }
  }

  async function handleClose() {
    if (agent) {
      setClearing(true);
      await clearAgentView(agent.id); // clears this agent's view only — admin keeps full history
      setTimeout(() => {
        setClearing(false);
        setOpen(false);
        setAgentId("");
      }, 400);
    } else {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ background: ink.green, display: open ? "none" : "flex" }}
      >
        <Radio size={22} color={ink.bg} />
      </button>

      {open && (
        <div
          className="fixed bottom-5 right-5 w-[min(92vw,360px)] rounded-md overflow-hidden shadow-2xl z-50 flex flex-col"
          style={{ background: ink.panel, border: `1px solid ${ink.line}`, height: 520 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: ink.line, background: ink.panel2 }}>
            <div className="flex items-center gap-2">
              <Radio size={14} color={ink.green} />
              <span className="text-[11px] uppercase tracking-[0.2em]">Comms Terminal</span>
            </div>
            <button onClick={handleClose}><X size={16} color={ink.muted} /></button>
          </div>

          {clearing ? (
            <div className="flex-1 flex items-center justify-center text-xs uppercase tracking-[0.2em]" style={{ color: ink.stamp }}>
              Clearing local view…
            </div>
          ) : !agent ? (
            <div className="flex-1 p-5 flex flex-col justify-center">
              <div className="text-[11px] uppercase tracking-widest mb-3 flex items-center gap-1" style={{ color: ink.muted }}>
                <KeyRound size={12} /> Enter your code
              </div>
              <input
                ref={idInputRef}
                value={idCode}
                onChange={(e) => setIdCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                onKeyDown={(e) => e.key === "Enter" && tryIdentify()}
                className="w-full px-3 py-2 text-sm rounded-sm outline-none tracking-[0.4em] text-center mb-3"
                style={{ background: ink.bg, border: `1px solid ${idError ? ink.stamp : ink.line}`, color: ink.text }}
                placeholder="—  —  —"
              />
              {idError && (
                <div className="text-[11px] mb-3 flex items-center gap-1" style={{ color: ink.stamp }}>
                  <AlertTriangle size={12} /> Kode tidak dikenali
                </div>
              )}
              <button
                onClick={tryIdentify}
                className="w-full py-2 rounded-sm text-xs uppercase tracking-widest font-bold"
                style={{ background: ink.green, color: ink.bg }}
              >
                Enter
              </button>
            </div>
          ) : (
            <AgentThread agent={agent} onSwitch={() => setAgentId("")} />
          )}
        </div>
      )}
    </>
  );
}

function AgentThread({ agent, onSwitch }) {
  const { messages, send } = useAgentMessages(agent.id);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [unlocked, setUnlocked] = useState({}); // { [msgId]: true } — resets whenever this thread remounts (i.e. on close/reopen)
  const [replyingTo, setReplyingTo] = useState(null); // { id, text, label }
  const [justUnlockedFlash, setJustUnlockedFlash] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [webcamOpen, setWebcamOpen] = useState(false);

  function handleCameraClick() {
    if (isMobileDevice()) {
      cameraInputRef.current?.click();
    } else {
      setWebcamOpen(true);
    }
  }

  const recorder = useVoiceRecorder(
    (file) => setPendingFile(file),
    (msg) => flashError(msg)
  );

  const clearedAt = agent.cleared_at || null;
  const visible = clearedAt ? messages.filter((m) => new Date(m.created_at) > new Date(clearedAt)) : messages;
  const lockedCount = visible.filter((m) => m.sender !== "agent" && !unlocked[m.id]).length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [visible.length]);

  // Autofocus the composer as soon as an agent identity is chosen.
  useEffect(() => {
    inputRef.current?.focus();
  }, [agent.id]);

  function focusReply(target) {
    setReplyingTo(target);
    inputRef.current?.focus();
  }

  function flashError(msg) {
    setSendError(msg);
    setTimeout(() => setSendError(""), 1600);
  }

  function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      flashError("File maksimal 10MB");
      return;
    }
    setPendingFile(file);
    inputRef.current?.focus();
  }

  // Single input handles three cases:
  //  1. "<message> <3-digit code>"  -> send that message/file (code stripped, verified)
  //  2. "<3-digit code>" alone      -> if a file is attached, sends it with no caption;
  //                                     otherwise unlocks every locked incoming message at once
  //  3. anything else / missing code at the end -> "No code" error
  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    const tokens = trimmed.split(/\s+/);
    const last = tokens[tokens.length - 1];
    const looksLikeCode = /^\d{3}$/.test(last);

    if (!looksLikeCode) {
      flashError("No code — akhiri pesan dengan kode kamu");
      return;
    }

    if (tokens.length === 1) {
      if (last !== agent.code) {
        flashError("Kode salah");
        return;
      }
      if (pendingFile) {
        // pure code with a file attached -> send the file, no caption
        setUploading(true);
        const { error } = await send("agent", "", replyingTo, pendingFile);
        setUploading(false);
        if (error) { flashError(error.message); return; }
        setText("");
        setReplyingTo(null);
        setPendingFile(null);
        return;
      }
      // pure code, no file -> unlock action
      setUnlocked((u) => {
        const next = { ...u };
        visible.forEach((m) => {
          if (m.sender !== "agent") next[m.id] = true;
        });
        return next;
      });
      setJustUnlockedFlash(true);
      setTimeout(() => setJustUnlockedFlash(false), 700);
      setText("");
      return;
    }

    // message + trailing code
    if (last !== agent.code) {
      flashError("Kode salah");
      return;
    }
    const messageText = tokens.slice(0, -1).join(" ");
    setUploading(true);
    const { error } = await send("agent", messageText, replyingTo, pendingFile);
    setUploading(false);
    if (error) { flashError(error.message); return; }
    setText("");
    setReplyingTo(null);
    setPendingFile(null);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2 flex items-center justify-between border-b" style={{ borderColor: ink.line }}>
        <span className="text-[11px]" style={{ color: ink.muted }}>
          Signed in as <b style={{ color: ink.text }}>{agent.name}</b> · ID {agent.id.slice(0, 6)}
        </span>
        <button onClick={onSwitch} className="text-[10px] uppercase tracking-widest" style={{ color: ink.muted }}>Switch</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {visible.length === 0 && <div className="text-xs" style={{ color: ink.muted }}>No transmissions yet.</div>}
        {visible.map((m) => {
          const mine = m.sender === "agent";
          if (mine) {
            return (
              <div key={m.id} className="max-w-[80%] ml-auto text-right">
                <div className="flex items-end gap-1 justify-end">
                  <button onClick={() => focusReply({ id: m.id, text: m.text, label: "diri sendiri" })} style={{ color: ink.muted }}>
                    <CornerUpLeft size={13} />
                  </button>
                  <div className="inline-block px-3 py-2 rounded-md text-xs" style={{ background: ink.greenDim, border: `1px solid ${ink.line}` }}>
                    {m.reply_to && (
                      <div className="mb-1 pl-2 text-left text-[10px] opacity-70" style={{ borderLeft: `2px solid ${ink.bg}` }}>
                        {(m.reply_to.text && m.reply_to.text.length > 60) ? m.reply_to.text.slice(0, 60) + "…" : (m.reply_to.text || "")}
                      </div>
                    )}
                    <AttachmentView m={m} />
                    {m.text}
                  </div>
                </div>
                <div className="text-[10px] mt-1" style={{ color: ink.muted }}>{fmtTime(m.created_at)}</div>
              </div>
            );
          }
          return (
            <div key={m.id} className="max-w-[85%]">
              {unlocked[m.id] ? (
                <div className="flex items-end gap-1" style={{ opacity: justUnlockedFlash ? 0.5 : 1, transition: "opacity 0.35s ease" }}>
                  <div className="inline-block px-3 py-2 rounded-md text-xs" style={{ background: ink.panel2, border: `1px solid ${ink.line}` }}>
                    {m.reply_to && (
                      <div className="mb-1 pl-2 text-[10px] opacity-70" style={{ borderLeft: `2px solid ${ink.green}` }}>
                        {(m.reply_to.text && m.reply_to.text.length > 60) ? m.reply_to.text.slice(0, 60) + "…" : (m.reply_to.text || "")}
                      </div>
                    )}
                    <AttachmentView m={m} />
                    {m.text}
                  </div>
                  <button onClick={() => focusReply({ id: m.id, text: m.text, label: "Command" })} style={{ color: ink.muted }}>
                    <CornerUpLeft size={13} />
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-md flex items-center gap-2 text-[11px]" style={{ background: ink.panel2, border: `1px solid ${ink.line}`, color: ink.muted }}>
                  <Lock size={12} /> New message
                </div>
              )}
              <div className="text-[10px] mt-1" style={{ color: ink.muted }}>{fmtTime(m.created_at)}</div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t space-y-1.5" style={{ borderColor: ink.line }}>
        {replyingTo && (
          <div className="px-3 py-2 rounded-sm flex items-center justify-between" style={{ background: ink.panel2, border: `1px solid ${ink.line}` }}>
            <div className="text-[11px] min-w-0">
              <div className="uppercase tracking-widest mb-0.5" style={{ color: ink.green }}>Replying to {replyingTo.label}</div>
              <div className="truncate" style={{ color: ink.muted }}>{replyingTo.text}</div>
            </div>
            <button onClick={() => setReplyingTo(null)} style={{ color: ink.muted }}><X size={14} /></button>
          </div>
        )}
        {pendingFile && (
          <div className="px-3 py-2 rounded-sm flex items-center justify-between" style={{ background: ink.panel2, border: `1px solid ${ink.line}` }}>
            <div className="text-[11px] min-w-0 flex items-center gap-2">
              <FileText size={13} color={ink.green} />
              <div className="min-w-0">
                <div className="truncate max-w-[160px]">{pendingFile.name}</div>
                <div style={{ color: ink.muted }}>{fmtSize(pendingFile.size)} · akhiri dengan kode untuk kirim</div>
              </div>
            </div>
            <button onClick={() => setPendingFile(null)} style={{ color: ink.muted }}><X size={14} /></button>
          </div>
        )}
        {lockedCount > 0 && (
          <div className="text-[10px] flex items-center gap-1" style={{ color: ink.muted }}>
            <Lock size={10} /> {lockedCount} pesan terkunci — ketik kode saja untuk buka semua
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv" onChange={pickFile} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={pickFile} className="hidden" />
          {recorder.isRecording ? (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: ink.panel2, border: `1px solid ${ink.stamp}` }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ink.stamp }} />
              <span className="text-xs" style={{ color: ink.text }}>Merekam… {fmtDuration(recorder.seconds)}</span>
              <button onClick={() => recorder.cancel()} className="ml-auto text-[10px] uppercase tracking-widest" style={{ color: ink.muted }}>Batal</button>
              <button onClick={() => recorder.stop()} className="px-2 py-1 rounded-sm" style={{ background: ink.stamp }}>
                <Square size={12} color="#fff" />
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => fileInputRef.current?.click()} className="px-2.5 py-2 rounded-sm" style={{ border: `1px solid ${ink.line}`, color: ink.muted }}>
                <Paperclip size={14} />
              </button>
              <button onClick={handleCameraClick} className="px-2.5 py-2 rounded-sm" style={{ border: `1px solid ${ink.line}`, color: ink.muted }}>
                <Camera size={14} />
              </button>
              <button onClick={() => recorder.start()} className="px-2.5 py-2 rounded-sm" style={{ border: `1px solid ${ink.line}`, color: ink.muted }}>
                <Mic size={14} />
              </button>
              <div className="relative flex-1">
                <KeyRound size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: ink.muted }} />
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Type message..."
                  className="w-full pl-7 pr-3 py-2 text-xs rounded-sm outline-none"
                  style={{ background: ink.bg, border: `1px solid ${sendError ? ink.stamp : ink.line}`, color: ink.text }}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={uploading}
                className="px-3 py-2 rounded-sm flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold"
                style={{ background: ink.green, color: ink.bg, opacity: uploading ? 0.6 : 1 }}
              >
                {uploading ? <span className="text-[10px]">…</span> : <Send size={13} />}
              </button>
            </>
          )}
        </div>
        <div className="text-[9px] tracking-wide" style={{ color: ink.muted, opacity: 0.65 }}>
          akhiri dengan kodemu untuk kirim · kirim kode saja untuk buka pesan
        </div>
        {sendError && (
          <div className="text-[11px] flex items-center gap-1" style={{ color: ink.stamp }}>
            <AlertTriangle size={11} /> {sendError}
          </div>
        )}
      </div>
      {webcamOpen && (
        <WebcamCaptureModal
          onCapture={(file) => { setPendingFile(file); setWebcamOpen(false); inputRef.current?.focus(); }}
          onClose={() => setWebcamOpen(false)}
        />
      )}
    </div>
  );
}
