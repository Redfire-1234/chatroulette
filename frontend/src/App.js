import React, { useState, useRef, useEffect } from "react";
import { useChat } from "./hooks/useChat";
import "./index.css";

function App() {
  const { status, messages, suggestions, partnerTyping, connectionLost, connect, sendMessage, sendTyping, skip, disconnect } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const typingRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || status !== "chatting") return;
    sendMessage(text);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => sendTyping(), 300);
  };

  const handleSuggestion = (text) => {
    sendMessage(text);
  };

  return (
    <div className="app">
      <div className="noise-overlay" />

      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">STRANGR</span>
          <span className="logo-badge">ANONYMOUS</span>
        </div>
        <div className="header-status">
          <span className={`status-dot ${status}`} />
          <span className="status-label">
            {status === "idle" && "offline"}
            {status === "connecting" && "connecting..."}
            {status === "waiting" && "searching..."}
            {status === "chatting" && "live"}
            {status === "disconnected" && "ended"}
          </span>
        </div>
      </header>

      {/* Connection Lost Banner */}
      {connectionLost && (
        <div className="banner-reconnecting">
          <span className="banner-dot" />
          Reconnecting... Your internet may be unstable.
        </div>
      )}

      {/* Main Content */}
      <main className="main">
        {/* Landing Screen */}
        {status === "idle" && (
          <div className="landing">
            <div className="landing-glow" />
            <div className="landing-content">
              <h1 className="landing-title">
                Talk to a<br />
                <em>stranger</em>
              </h1>
              <p className="landing-sub">
                Anonymous. Random. Real-time.<br />
                AI-powered smart replies included.
              </p>
              <div className="landing-features">
                <div className="feature">
                  <span>👤</span> No account needed
                </div>
                <div className="feature">
                  <span>🔀</span> Random matching
                </div>
                <div className="feature">
                  <span>🤖</span> AI reply suggestions
                </div>
                <div className="feature">
                  <span>⚡</span> Real-time WebSockets
                </div>
              </div>
              <button className="btn-start" onClick={connect}>
                <span className="btn-start-inner">Start Chat</span>
              </button>
            </div>
          </div>
        )}

        {/* Searching Screen */}
        {status === "waiting" && (
          <div className="searching">
            <div className="radar">
              <div className="radar-ring r1" />
              <div className="radar-ring r2" />
              <div className="radar-ring r3" />
              <div className="radar-dot" />
            </div>
            <h2 className="searching-title">Finding your stranger</h2>
            <p className="searching-sub">This takes just a moment...</p>
            <button className="btn-cancel" onClick={disconnect}>Cancel</button>
          </div>
        )}

        {/* Chat Screen */}
        {(status === "chatting" || status === "disconnected") && (
          <div className="chat-layout">
            {/* Messages */}
            <div className="messages-container">
              <div className="messages">
                {messages.map((msg, i) => (
                  <div key={msg.id || i} className={`msg-wrapper ${msg.type === "system" ? "system" : msg.from}`}>
                    {msg.type === "system" ? (
                      <div className="msg-system">{msg.text}</div>
                    ) : (
                      <div className={`msg-bubble ${msg.from}`}>
                        <span className="msg-sender">{msg.from === "you" ? "You" : "Stranger"}</span>
                        <p className="msg-text">{msg.text}</p>
                      </div>
                    )}
                  </div>
                ))}

                {partnerTyping && (
                  <div className="msg-wrapper stranger">
                    <div className="msg-bubble stranger typing-bubble">
                      <span className="msg-sender">Stranger</span>
                      <div className="typing-dots">
                        <span /><span /><span />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* AI Suggestions */}
            {suggestions.length > 0 && status === "chatting" && (
              <div className="suggestions-bar">
                <span className="suggestions-label">🤖 AI replies:</span>
                <div className="suggestions-list">
                  {suggestions.map((s, i) => (
                    <button key={i} className="suggestion-btn" onClick={() => handleSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="input-area">
              {status === "chatting" ? (
                <>
                  <textarea
                    className="chat-input"
                    placeholder="Type a message..."
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <button className="btn-send" onClick={handleSend} disabled={!input.trim()}>
                    ➤
                  </button>
                  <button className="btn-skip" onClick={skip} title="Skip to next stranger">
                    ⏭ Skip
                  </button>
                </>
              ) : (
                <div className="ended-bar">
                  <span>Chat ended</span>
                  <button className="btn-new" onClick={connect}>Find New Stranger</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connecting */}
        {status === "connecting" && (
          <div className="searching">
            <div className="spinner" />
            <h2 className="searching-title">Connecting...</h2>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
