import { useState, useEffect, useRef } from "react";
import {
  X, Send, Shield, UserPlus, Trash2,
  Pencil, KeyRound, LogOut, Radio, AlertTriangle, ChevronLeft, Eye, EyeOff, Lock, CornerUpLeft,
} from "lucide-react";

/* ---------------------------------------------------------------
   CONFIG
--------------------------------------------------------------- */
const ADMIN_PASSWORD = "SHADOW9"; // change this before real use
const ADMIN_ID = "ADMIN";

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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function now() {
  return new Date().toISOString();
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ---------------------------------------------------------------
   ROOT APP
   All data lives here as plain React state, shared live between the
   public site, the admin console, and the chat widget. This avoids
   depending on a persistent-storage backend that wasn't behaving
   reliably in this environment — everything updates instantly and
   in sync, at the cost of resetting on a full page reload.
--------------------------------------------------------------- */
export default function App() {
  const [agents, setAgents] = useState([]);
  const [inbox, setInbox] = useState({}); // { [agentId]: Message[] }
  const [clearedMap, setClearedMap] = useState({}); // { [agentId]: isoTimestamp }
  const [view, setView] = useState("site"); // 'site' | 'admin'
  const [widgetOpen, setWidgetOpen] = useState(false);

  function addAgent(agent) {
    setAgents((prev) => [...prev, agent]);
  }
  function editAgent(id, updates) {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }
  function removeAgent(id) {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    setInbox((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function sendMessage(agentId, from, text, replyTo) {
    const msg = { id: uid(), from, to: from === ADMIN_ID ? agentId : ADMIN_ID, text, ts: now(), replyTo: replyTo || null };
    setInbox((prev) => ({ ...prev, [agentId]: [...(prev[agentId] || []), msg] }));
  }
  function clearAgentView(agentId) {
    setClearedMap((prev) => ({ ...prev, [agentId]: now() }));
  }

  return (
    <div
      style={{ ...mono, background: ink.bg, color: ink.text, height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
      className="relative w-full"
    >
      {view === "site" && <SiteHome onAdmin={() => setView("admin")} />}
      {view === "admin" && (
        <AdminConsole
          agents={agents}
          inbox={inbox}
          addAgent={addAgent}
          editAgent={editAgent}
          removeAgent={removeAgent}
          sendMessage={sendMessage}
          onExit={() => setView("site")}
        />
      )}

      <ChatWidget
        agents={agents}
        inbox={inbox}
        clearedMap={clearedMap}
        sendMessage={sendMessage}
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
function AdminConsole({ agents, inbox, addAgent, editAgent, removeAgent, sendMessage, onExit }) {
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
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      agents={agents}
      inbox={inbox}
      addAgent={addAgent}
      editAgent={editAgent}
      removeAgent={removeAgent}
      sendMessage={sendMessage}
      onExit={onExit}
    />
  );
}

function AdminDashboard({ agents, inbox, addAgent, editAgent, removeAgent, sendMessage, onExit }) {
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

  function handleAddAgent() {
    const err = validCode(newCode, null);
    if (!newName.trim()) return setFormError("Name required");
    if (err) return setFormError(err);
    addAgent({ id: uid(), name: newName.trim(), code: newCode });
    setNewName(""); setNewCode(""); setFormError("");
  }

  function handleRemoveAgent(id) {
    removeAgent(id);
    if (selected === id) setSelected(null);
  }

  function saveEdit(id) {
    const err = validCode(editCode, id);
    if (!editName.trim()) return;
    if (err) return;
    editAgent(id, { name: editName.trim(), code: editCode });
    setEditingId(null);
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
            <AdminInboxView
              agent={selectedAgent}
              messages={inbox[selectedAgent.id] || []}
              sendMessage={sendMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminInboxView({ agent, messages, sendMessage }) {
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // { id, text, label }
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

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

  function send() {
    if (!text.trim()) return;
    sendMessage(agent.id, ADMIN_ID, text.trim(), replyingTo);
    setText("");
    setReplyingTo(null);
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
          const mine = m.from === ADMIN_ID;
          return (
            <div key={m.id} className={`max-w-sm group ${mine ? "ml-auto text-right" : ""}`}>
              <div className={`flex items-end gap-1 ${mine ? "justify-end" : ""}`}>
                {!mine && (
                  <button onClick={() => focusReply({ id: m.id, text: m.text, label: agent.name })} style={{ color: ink.muted }}>
                    <CornerUpLeft size={13} />
                  </button>
                )}
                <div className="inline-block px-3 py-2 rounded-md text-xs" style={{ background: mine ? ink.greenDim : ink.panel2, border: `1px solid ${ink.line}` }}>
                  {m.replyTo && (
                    <div className="mb-1 pl-2 text-[10px] opacity-70" style={{ borderLeft: `2px solid ${ink.green}` }}>
                      {m.replyTo.text.length > 60 ? m.replyTo.text.slice(0, 60) + "…" : m.replyTo.text}
                    </div>
                  )}
                  {m.text}
                </div>
                {mine && (
                  <button onClick={() => focusReply({ id: m.id, text: m.text, label: "Command" })} style={{ color: ink.muted }}>
                    <CornerUpLeft size={13} />
                  </button>
                )}
              </div>
              <div className="text-[10px] mt-1" style={{ color: ink.muted }}>{fmtTime(m.ts)}</div>
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

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Message ${agent.name}...`}
          className="flex-1 px-3 py-2 text-xs rounded-sm outline-none"
          style={{ background: ink.bg, border: `1px solid ${ink.line}`, color: ink.text }}
        />
        <button onClick={send} className="px-3 rounded-sm" style={{ background: ink.green, color: ink.bg }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   CHAT WIDGET (the special feature)
--------------------------------------------------------------- */
function ChatWidget({ agents, inbox, clearedMap, sendMessage, clearAgentView, open, setOpen }) {
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

  function handleClose() {
    if (agent) {
      setClearing(true);
      clearAgentView(agent.id); // clears this agent's view only — admin keeps full history
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
            <AgentThread
              agent={agent}
              messages={inbox[agent.id] || []}
              clearedAt={clearedMap[agent.id] || null}
              sendMessage={sendMessage}
              onSwitch={() => setAgentId("")}
            />
          )}
        </div>
      )}
    </>
  );
}

function AgentThread({ agent, messages, clearedAt, sendMessage, onSwitch }) {
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [unlocked, setUnlocked] = useState({}); // { [msgId]: true } — resets whenever this thread remounts (i.e. on close/reopen)
  const [replyingTo, setReplyingTo] = useState(null); // { id, text, label }
  const [justUnlockedFlash, setJustUnlockedFlash] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const visible = clearedAt ? messages.filter((m) => new Date(m.ts) > new Date(clearedAt)) : messages;
  const lockedCount = visible.filter((m) => m.from !== agent.id && !unlocked[m.id]).length;

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

  // Single input handles three cases:
  //  1. "<message> <3-digit code>"  -> send that message (code stripped, verified against agent's code)
  //  2. "<3-digit code>" alone      -> unlock every currently locked incoming message at once
  //  3. anything else / missing code at the end -> "No code" error
  function handleSubmit() {
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
      // pure code -> unlock action
      if (last !== agent.code) {
        flashError("Kode salah");
        return;
      }
      setUnlocked((u) => {
        const next = { ...u };
        visible.forEach((m) => {
          if (m.from !== agent.id) next[m.id] = true;
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
    sendMessage(agent.id, agent.id, messageText, replyingTo);
    setText("");
    setReplyingTo(null);
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
          const mine = m.from === agent.id;
          if (mine) {
            return (
              <div key={m.id} className="max-w-[80%] ml-auto text-right">
                <div className="flex items-end gap-1 justify-end">
                  <button onClick={() => focusReply({ id: m.id, text: m.text, label: "diri sendiri" })} style={{ color: ink.muted }}>
                    <CornerUpLeft size={13} />
                  </button>
                  <div className="inline-block px-3 py-2 rounded-md text-xs" style={{ background: ink.greenDim, border: `1px solid ${ink.line}` }}>
                    {m.replyTo && (
                      <div className="mb-1 pl-2 text-left text-[10px] opacity-70" style={{ borderLeft: `2px solid ${ink.bg}` }}>
                        {m.replyTo.text.length > 60 ? m.replyTo.text.slice(0, 60) + "…" : m.replyTo.text}
                      </div>
                    )}
                    {m.text}
                  </div>
                </div>
                <div className="text-[10px] mt-1" style={{ color: ink.muted }}>{fmtTime(m.ts)}</div>
              </div>
            );
          }
          return (
            <div key={m.id} className="max-w-[85%]">
              {unlocked[m.id] ? (
                <div className="flex items-end gap-1" style={{ opacity: justUnlockedFlash ? 0.5 : 1, transition: "opacity 0.35s ease" }}>
                  <div className="inline-block px-3 py-2 rounded-md text-xs" style={{ background: ink.panel2, border: `1px solid ${ink.line}` }}>
                    {m.replyTo && (
                      <div className="mb-1 pl-2 text-[10px] opacity-70" style={{ borderLeft: `2px solid ${ink.green}` }}>
                        {m.replyTo.text.length > 60 ? m.replyTo.text.slice(0, 60) + "…" : m.replyTo.text}
                      </div>
                    )}
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
              <div className="text-[10px] mt-1" style={{ color: ink.muted }}>{fmtTime(m.ts)}</div>
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
        {lockedCount > 0 && (
          <div className="text-[10px] flex items-center gap-1" style={{ color: ink.muted }}>
            <Lock size={10} /> {lockedCount} pesan terkunci — ketik kode saja untuk buka semua
          </div>
        )}
        <div className="flex gap-2 items-center">
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
            className="px-3 py-2 rounded-sm flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold"
            style={{ background: ink.green, color: ink.bg }}
          >
            <Send size={13} />
          </button>
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
    </div>
  );
}
