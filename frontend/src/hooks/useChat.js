import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws";

export function useChat() {
  const ws = useRef(null);
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const typingTimer = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const intentionalClose = useRef(false);

  const connect = useCallback(() => {
    if (ws.current) {
      intentionalClose.current = true;
      ws.current.onclose = null;
      ws.current.close();
    }
    intentionalClose.current = false;
    reconnectAttempts.current = 0;
    setStatus("connecting");
    setMessages([]);
    setSuggestions([]);
    setConnectionLost(false);
    _openSocket();
  }, []);

  function _openSocket() {
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      console.log("WS connected");
      reconnectAttempts.current = 0;
      setConnectionLost(false);
    };

    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (e) { return; }

      switch (data.type) {
        case "ping":
          socket.send(JSON.stringify({ type: "pong" }));
          break;
        case "connected":
          break;
        case "waiting":
          setStatus("waiting");
          break;
        case "matched":
          setStatus("chatting");
          setSuggestions([]);
          setMessages([{ type: "system", text: "Connected! Say hello to your stranger.", id: Date.now() }]);
          break;
        case "message":
          setMessages((prev) => [...prev, { type: "message", from: data.from, text: data.text, id: Date.now() + Math.random() }]);
          setPartnerTyping(false);
          if (data.from === "you") setSuggestions([]);
          break;
        case "ai_suggestions":
          if (Array.isArray(data.suggestions) && data.suggestions.length > 0)
            setSuggestions(data.suggestions);
          break;
        case "typing":
          setPartnerTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setPartnerTyping(false), 2500);
          break;
        case "partner_disconnected": {
          setStatus("disconnected");
          const icons = { timeout: "Timed out", disconnected: "Lost connection", skipped: "Skipped", left: "Left" };
          setMessages((prev) => [...prev, { type: "system", text: data.message, id: Date.now() }]);
          setSuggestions([]);
          break;
        }
        case "skipped":
          setStatus("waiting");
          setMessages([]);
          setSuggestions([]);
          break;
        case "error":
          console.error("Server error:", data.message);
          break;
        default:
          break;
      }
    };

    socket.onclose = (e) => {
      if (intentionalClose.current) return;
      setConnectionLost(true);
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 15000);
      reconnectAttempts.current += 1;
      console.log("Reconnecting in", delay, "ms");
      reconnectTimer.current = setTimeout(() => {
        if (!intentionalClose.current) _openSocket();
      }, delay);
    };

    socket.onerror = () => { console.error("WS error"); };
  }

  const sendMessage = useCallback((text) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: "message", text }));
  }, []);

  const sendTyping = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: "typing" }));
  }, []);

  const skip = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: "skip" }));
    setStatus("waiting");
    setMessages([]);
    setSuggestions([]);
  }, []);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    clearTimeout(reconnectTimer.current);
    if (ws.current) ws.current.close();
    setStatus("idle");
    setMessages([]);
    setSuggestions([]);
    setConnectionLost(false);
  }, []);

  useEffect(() => {
    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, []);

  return { status, messages, suggestions, partnerTyping, connectionLost, connect, sendMessage, sendTyping, skip, disconnect };
}
