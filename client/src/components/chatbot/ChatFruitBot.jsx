import React, { useEffect, useRef, useState } from "react";
import "./ChatFruitBot.css"; // 👉 nhớ tạo file CSS cùng thư mục

// Nếu FE và BE cùng domain/port, bạn có thể dùng: "/api/fruitbot/chat"
const ENDPOINT =
  import.meta?.env?.VITE_FRUITBOT_ENDPOINT ||
  "http://localhost:3000/api/fruitbot/chat";

export default function ChatFruitBot() {
  const [open, setOpen] = useState(true); // mở sẵn khi demo
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: "Chào bạn 👋 Mình là FruitBot. Mô tả: ngọt/chua, không hạt, tầm giá nhé!" }
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await r.json();

      const blocks = [];
      if (data.reply) blocks.push({ role: "bot", text: data.reply });

      if (Array.isArray(data.results) && data.results.length) {
        blocks.push({
          role: "card",
          items: data.results.map((x) => ({
            title: x.name,
            subtitle: `${x.price.toLocaleString()}đ / 0.5kg`,
            desc: x.reason || "",
            id: x.id,
            cta: "Thêm vào giỏ"
          }))
        });
      }

      if (Array.isArray(data.quickReplies)) {
        blocks.push({ role: "quick", options: data.quickReplies });
      }

      setMessages((prev) => [...prev, ...blocks]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "bot", text: "Mạng lỗi 😅 thử lại giúp mình nhé." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = (q) => send(q);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fruitbot-fab"
        aria-label="FruitBot"
      >
        🍊
      </button>

      {open && (
        <div className="fruitbot-panel">
          {/* Header */}
          <div className="fruitbot-header">
            <div>FruitBot • Tư vấn trái cây</div>
            <button onClick={() => setOpen(false)} className="fruitbot-closeBtn">
              ×
            </button>
          </div>

          {/* Body */}
          <div className="fruitbot-body">
            {messages.map((m, idx) => {
              if (m.role === "card") {
                return (
                  <div key={idx} className="fruitbot-cardContainer">
                    {m.items.map((it, j) => (
                      <div key={j} className="fruitbot-card">
                        <div className="title">{it.title}</div>
                        <div className="subtitle">{it.subtitle}</div>
                        {it.desc && <div className="desc">{it.desc}</div>}
                        <button
                          className="fruitbot-ctaBtn"
                          onClick={() => alert(`(Demo) Đã thêm ${it.title} vào giỏ!`)}
                        >
                          {it.cta}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              }

              if (m.role === "quick") {
                return (
                  <div key={idx} className="fruitbot-quickContainer">
                    {m.options.map((o, i) => (
                      <button
                        key={i}
                        className="fruitbot-quick"
                        onClick={() => handleQuick(o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                );
              }

              const isUser = m.role === "user";
              return (
                <div
                  key={idx}
                  className={`fruitbot-row ${isUser ? "user" : "bot"}`}
                >
                  <div
                    className={`fruitbot-bubble ${
                      isUser ? "bubble-user" : "bubble-bot"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}

            {loading && <div className="loading">Đang gợi ý…</div>}
            <div ref={bottomRef} />
          </div>

          {/* Footer */}
          <div className="fruitbot-footer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="VD: ngọt, không hạt, ~70k"
              className="fruitbot-input"
            />
            <button onClick={() => send(input)} className="fruitbot-sendBtn">
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
