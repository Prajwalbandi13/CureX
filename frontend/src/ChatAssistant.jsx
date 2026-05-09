import React, { useEffect, useMemo, useState } from "react";

function DoctorBotIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect x="14" y="10" width="36" height="30" rx="12" fill="#0f766e" />
      <rect x="22" y="40" width="20" height="8" rx="4" fill="#0f766e" />
      <rect x="18" y="48" width="28" height="6" rx="3" fill="#115e59" />
      <circle cx="25" cy="25" r="4" fill="#ecfeff" />
      <circle cx="39" cy="25" r="4" fill="#ecfeff" />
      <rect x="24" y="31" width="16" height="3" rx="1.5" fill="#99f6e4" />
      <rect x="30" y="4" width="4" height="10" rx="2" fill="#f59e0b" />
      <circle cx="32" cy="4" r="4" fill="#fb923c" />
      <path d="M8 22h6" stroke="#14b8a6" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 22h6" stroke="#14b8a6" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 57h16" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 18v10" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

const API_BASE = "http://127.0.0.1:8000";

function ChatAssistant({ patient, history, currentResult, darkMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [initializedKey, setInitializedKey] = useState("");

  const contextKey = useMemo(
    () =>
      JSON.stringify({
        email: patient?.email,
        name: patient?.name,
        historyCount: history?.length || 0,
        disease: currentResult?.["Predicted Disease"] || "",
        confidence: currentResult?.Confidence || "",
      }),
    [patient?.email, patient?.name, history?.length, currentResult]
  );

  const palette = darkMode
    ? {
        panel: "bg-slate-900 border-slate-700 text-slate-100",
        subpanel: "bg-slate-800 border-slate-700",
        muted: "text-slate-400",
        input: "bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500",
        botBubble: "bg-teal-950 border-teal-800 text-teal-50",
        userBubble: "bg-cyan-600 text-white border-cyan-500",
        chip: "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700",
      }
    : {
        panel: "bg-white border-teal-200 text-slate-800",
        subpanel: "bg-teal-50 border-teal-100",
        muted: "text-slate-500",
        input: "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
        botBubble: "bg-teal-50 border-teal-100 text-slate-800",
        userBubble: "bg-cyan-600 text-white border-cyan-500",
        chip: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
      };

  async function sendMessage(question, options = {}) {
    const trimmed = question.trim();
    if (!trimmed || !patient) return;

    const existingMessages = options.messageSnapshot || messages;
    const nextMessages = options.skipAppendUser
      ? existingMessages
      : [...existingMessages, { role: "user", content: trimmed }];

    if (!options.skipAppendUser) {
      setMessages(nextMessages);
    }

    setLoading(true);
    setChatError("");

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_name: patient.name,
          patient_email: patient.email,
          age: patient.age,
          previous_disease: patient.previousDisease || "",
          symptoms: patient.symptoms || [],
          current_result: currentResult,
          user_message: trimmed,
          messages: nextMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Chat failed with ${response.status}`);
      }

      const data = await response.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply || "No response available." }]);
      setSuggestedQuestions(Array.isArray(data.suggested_questions) ? data.suggested_questions.slice(0, 3) : []);
      setInput("");
    } catch (err) {
      console.error(err);
      setChatError(err.message || "CureBot could not respond right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen || !patient || initializedKey === contextKey) return;

    const currentDisease = currentResult?.["Predicted Disease"];
    const intro = currentDisease
      ? `The patient just received a CureX result for ${currentDisease}. Give a short welcome and 3 follow-up questions based on the current result.`
      : "The patient opened CureBot before running a new detection. Give a short welcome and 3 follow-up questions based on past scan history and next-step preparation.";

    setMessages([]);
    setSuggestedQuestions([]);
    setInitializedKey(contextKey);
    sendMessage(intro, { skipAppendUser: true, messageSnapshot: [] });
  }, [isOpen, patient, initializedKey, contextKey, currentResult]);

  const canSend = input.trim() && !loading;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 left-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 via-cyan-500 to-emerald-500 text-white shadow-2xl ring-4 ring-white/70 transition-transform hover:scale-105"
        aria-label={isOpen ? "Close CureBot" : "Open CureBot"}
      >
        <DoctorBotIcon className="h-10 w-10" />
      </button>

      <aside
        className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-md transform flex-col border-l shadow-2xl transition-transform duration-300 ${palette.panel} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-inherit px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-emerald-500 shadow-lg">
              <DoctorBotIcon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">CureBot</h2>
              <p className={`text-xs ${palette.muted}`}>Healthcare-only support powered by Gemini</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-full px-3 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            Close
          </button>
        </div>

        <div className={`mx-4 mt-4 rounded-2xl border p-3 text-xs leading-relaxed ${palette.subpanel}`}>
          {currentResult?.["Predicted Disease"] ? (
            <p>
              Current focus: <strong>{currentResult["Predicted Disease"]}</strong> at {currentResult.Confidence || "N/A"}% confidence. Ask about symptoms, urgency, next tests, or follow-up care.
            </p>
          ) : (
            <p>
              No current detection yet. DoctorBot will use past history, previous disease, and reported symptoms to guide the conversation.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && loading && (
            <div className={`rounded-2xl border p-4 text-sm ${palette.botBubble}`}>
              Preparing your healthcare assistant...
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                message.role === "assistant"
                  ? `${palette.botBubble}`
                  : `${palette.userBubble} ml-auto`
              }`}
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                {message.role === "assistant" ? "CureBot" : "You"}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}

          {chatError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{chatError}</p>}
        </div>

        {!!suggestedQuestions.length && (
          <div className="border-t border-inherit px-4 py-3">
            <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${palette.muted}`}>Follow-up Questions</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={loading}
                  onClick={() => sendMessage(question)}
                  className={`rounded-full border px-3 py-2 text-left text-xs transition-colors ${palette.chip}`}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSend) return;
            sendMessage(input);
          }}
          className="border-t border-inherit px-4 py-4"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about symptoms, X-ray results, risk, or follow-up care"
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200 ${palette.input}`}
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
          <p className={`mt-2 text-[11px] ${palette.muted}`}>
            CureBot is restricted to healthcare topics and provides educational support only.
          </p>
        </form>
      </aside>
    </>
  );
}

export default ChatAssistant;

