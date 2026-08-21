import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------
   useAgents — live roster of all agents, synced via Supabase Realtime.
--------------------------------------------------------------- */
export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(err.message);
        if (data) setAgents(data);
        setLoaded(true);
      });

    let channel;
    try {
      channel = supabase
        .channel(`agents-all-${Math.random().toString(36).slice(2, 9)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "agents" },
          (payload) => {
            setAgents((prev) => {
              if (payload.eventType === "INSERT") {
                if (prev.some((a) => a.id === payload.new.id)) return prev;
                return [...prev, payload.new];
              }
              if (payload.eventType === "UPDATE") {
                return prev.map((a) => (a.id === payload.new.id ? payload.new : a));
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((a) => a.id !== payload.old.id);
              }
              return prev;
            });
          }
        )
        .subscribe();
    } catch (e) {
      setError(e?.message || String(e));
    }

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function addAgent(name, code) {
    const { data, error: err } = await supabase
      .from("agents")
      .insert({ name, code })
      .select()
      .single();
    if (!err && data) {
      setAgents((prev) => (prev.some((a) => a.id === data.id) ? prev : [...prev, data]));
    }
    return { data, error: err };
  }

  async function editAgent(id, updates) {
    const { data, error: err } = await supabase
      .from("agents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (!err && data) {
      setAgents((prev) => prev.map((a) => (a.id === id ? data : a)));
    }
    return { data, error: err };
  }

  async function removeAgent(id) {
    const { error: err } = await supabase.from("agents").delete().eq("id", id);
    if (!err) setAgents((prev) => prev.filter((a) => a.id !== id));
    return { error: err };
  }

  async function clearAgentView(id) {
    const nowIso = new Date().toISOString();
    const { error: err } = await supabase.from("agents").update({ cleared_at: nowIso }).eq("id", id);
    if (!err) setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, cleared_at: nowIso } : a)));
    return { error: err };
  }

  return { agents, loaded, error, addAgent, editAgent, removeAgent, clearAgentView };
}

/* ---------------------------------------------------------------
   useAgentMessages — live message thread for one agent's private
   line, synced via Supabase Realtime. Both the admin console and
   the agent widget use this for the same agent_id, so anything
   sent from either side appears on the other almost instantly.
--------------------------------------------------------------- */
export function useAgentMessages(agentId) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agentId) {
      setMessages([]);
      return;
    }
    let active = true;

    supabase
      .from("messages")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(err.message);
        if (data) setMessages(data);
      });

    let channel;
    try {
      channel = supabase
        .channel(`messages-${agentId}-${Math.random().toString(36).slice(2, 9)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `agent_id=eq.${agentId}` },
          (payload) => {
            setMessages((prev) => {
              if (payload.eventType === "INSERT") {
                if (prev.some((m) => m.id === payload.new.id)) return prev;
                return [...prev, payload.new].sort(
                  (a, b) => new Date(a.created_at) - new Date(b.created_at)
                );
              }
              if (payload.eventType === "UPDATE") {
                return prev.map((m) => (m.id === payload.new.id ? payload.new : m));
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((m) => m.id !== payload.old.id);
              }
              return prev;
            });
          }
        )
        .subscribe();
    } catch (e) {
      setError(e?.message || String(e));
    }

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [agentId]);

  async function send(sender, text, replyTo) {
    const { data, error: err } = await supabase
      .from("messages")
      .insert({
        agent_id: agentId,
        sender, // 'admin' | 'agent'
        text,
        reply_to: replyTo ? { id: replyTo.id, text: replyTo.text, label: replyTo.label } : null,
      })
      .select()
      .single();
    if (!err && data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    }
    return { error: err };
  }

  return { messages, error, send };
}
