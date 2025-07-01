import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

// Helper to ensure we have a chat room for the user
async function getOrCreateRoom() {
  // Try to get rooms
  try {
    const rooms = await api("/api/rooms", { method: "GET" });
    if (rooms.length > 0) return rooms[0].roomId;
  } catch (_) {}
  // Otherwise create a default room
  const room = await api("/api/room", {
    method: "POST",
    body: JSON.stringify({ name: "default" }),
  });
  return room.roomId;
}

export default function AiChat({ currentImage = null }) {
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 0,
      text: "Hello! I'm HEALense AI, an assistant that helps users understand images and answer follow-up questions. How can I help you?",
      sender: "ai",
    },
  ]); // {id, text, sender}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef();

  useEffect(() => {
    (async () => {
      const id = await getOrCreateRoom();
      setRoomId(id);
    })();
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function uploadImageIfNeeded() {
    if (!currentImage) return null;
    try {
      const res = await fetch(currentImage);
      const blob = await res.blob();
      const uploadResp = await fetch(`/api/image`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
        credentials: "include",
      });
      if (!uploadResp.ok) throw new Error("Image upload failed");
      const { key } = await uploadResp.json();
      return key;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !roomId) return;

    const userMsg = { id: Date.now(), text: input, sender: "user" };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    let imageKey = null;
    if (currentImage) {
      imageKey = await uploadImageIfNeeded();
    }

    try {
      const resp = await fetch(`/api/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, content: userMsg.text, imageKey }),
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());

      // Process SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split("\n");
        buffer = lines.pop(); // last partial line saved
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.replace(/^data: /, "");
            assistantText += chunk;
            setMessages((prev) => {
              // If assistant message already exists (last), append
              if (prev.length && prev[prev.length - 1].sender === "ai" && prev[prev.length - 1].streaming) {
                const updated = [...prev];
                updated[updated.length - 1].text = assistantText;
                return updated;
              }
              // else add new placeholder
              return [...prev, { id: Date.now() + Math.random(), text: assistantText, sender: "ai", streaming: true }];
            });
          }
        }
      }
      // Mark streaming complete
      setMessages((prev) => {
        if (prev.length && prev[prev.length - 1].sender === "ai") {
          const updated = [...prev];
          delete updated[updated.length - 1].streaming;
          return updated;
        }
        return prev;
      });
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { id: Date.now() + 2, text: `Error: ${err.message}`, sender: "ai" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full h-full bg-gray-900/80 rounded-lg p-4 flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                m.sender === "user" ? "bg-blue-600 text-white" : "bg-gray-800 text-white"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-white rounded-lg p-3">Thinking...</div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="flex-1 rounded px-3 py-2 bg-gray-800 text-white"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
      </form>
    </div>
  );
} 