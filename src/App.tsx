import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Mic,
  MicOff,
  Send,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  Terminal,
  RotateCcw,
  Maximize2,
  Minimize2,
  Phone,
  Clock
} from "lucide-react";
import { getSessionId, resetSessionId } from "./utils/sessionId.js";
import BookingForm from "./BookingForm";
import ManageBookingForm from "./ManageBookingForm";

interface Message {
  id: string;
  sender: "patient" | "assistant";
  text: string;
  time: string;
  showForm?: boolean;
  formSubmitted?: boolean;
  showManageForm?: boolean;
  manageSubmitted?: boolean;
  initialManageAction?: 'cancel' | 'reschedule';
  slots?: Array<{ label: string; slot_start?: string }>;
}

interface DebugLog {
  url: string;
  status: number | string;
  payload: any;
  response: any;
  error?: string;
  time: string;
}

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [isCenterModal, setIsCenterModal] = useState<boolean>(false);

  // Token Management: Daily conversation limit per person/device (15 messages/day)
  const DAILY_LIMIT = 15;
  const todayKey = `denttora_msgs_${new Date().toISOString().slice(0, 10)}`;
  const [dailyCount, setDailyCount] = useState<number>(() => {
    return parseInt(localStorage.getItem(todayKey) || "0", 10);
  });
  
  // Explicit language selection state: persisted in localStorage with zero auto-detection
  const [language, setLanguage] = useState<"English" | "Amharic">(() => {
    const saved = localStorage.getItem("denttora_language");
    return saved === "Amharic" ? "Amharic" : "English";
  });
  
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(() => {
    return !localStorage.getItem("denttora_language");
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "assistant",
      text: (localStorage.getItem("denttora_language") === "Amharic")
        ? "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። የጥርስ ማጽዳት፣ መሙላት፣ ወይም ቀጠሮ ማስያዝ ይፈልጋሉ? በምን ልርዳዎት?"
        : "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      showForm: false,
      formSubmitted: false
    }
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastLog, setLastLog] = useState<DebugLog | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Set explicit language without any heuristics
  const selectLanguage = (newLang: "English" | "Amharic") => {
    const changed = language !== newLang;
    setLanguage(newLang);
    setShowLanguageModal(false);
    localStorage.setItem("denttora_language", newLang);

    if (messages.length <= 1) {
      setMessages([
        {
          id: "1",
          sender: "assistant",
          text: newLang === "Amharic"
            ? "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። የጥርስ ማጽዳት፣ መሙላት፣ ወይም ቀጠሮ ማስያዝ ይፈልጋሉ? በምን ልርዳዎት?"
            : "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          showForm: false,
          formSubmitted: false
        }
      ]);
    } else if (changed) {
      const switchNote: Message = {
        id: Date.now().toString(),
        sender: "assistant",
        text: newLang === "Amharic"
          ? "🌐 ቋንቋ ወደ አማርኛ ተቀይሯል። ውይይቱን በአማርኛ መቀጠል ይችላሉ።"
          : "🌐 Language switched to English. You can now continue the conversation in English.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        showForm: false,
        formSubmitted: false
      };
      setMessages((prev) => [...prev, switchNote]);
    }
  };

  // Toggle language between English and Amharic
  const toggleLanguage = () => {
    selectLanguage(language === "English" ? "Amharic" : "English");
  };

  // Voice speech synthesis fallback strictly following user's chosen language
  const speak = (text: string) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_~`]/g, "").replace(/[•-]\s+/g, ", ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();

      if (language === "Amharic") {
        const amharicVoice = voices.find((v) => v.lang.startsWith("am") || v.lang.includes("ET"));
        if (amharicVoice) utterance.voice = amharicVoice;
        utterance.lang = "am-ET";
      } else {
        const female = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Female") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Natural"))
        );
        if (female) utterance.voice = female;
        utterance.lang = "en-US";
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech error:", e);
    }
  };

  // Play neural audio stream if provided by backend, else speak text
  const playAudioOrSpeak = (audioData: string | null | undefined, text: string) => {
    if (!voiceEnabled) return;
    if (audioData && audioData.startsWith("data:audio")) {
      try {
        const audio = new Audio(audioData);
        audio.play().catch(() => speak(text));
        return;
      } catch (err) {
        // Fall back to SpeechSynthesis
      }
    }
    speak(text);
  };

  // Record / Mic button click
  const handleMicClick = () => {
    if (isRecording) {
      setIsRecording(false);
      window.speechSynthesis.cancel();
      return;
    }

    setIsRecording(true);
    const welcome = language === "Amharic"
      ? "እንኳን ወደ ዴንቶራ ክሊኒክ በደህና መጡ! ይናገሩ፣ እያዳመጥኩ ነው..."
      : "Welcome to Denttora Dental Clinic! I am your assistant, ready to help. Please tell me what you need.";
    speak(welcome);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = language === "Amharic" ? "am-ET" : "en-US";
        recognition.interimResults = false;

        recognition.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          setIsRecording(false);
          sendMessage(transcript);
        };

        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);

        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {}
        }, 1200);
      } catch (e) {
        setIsRecording(false);
      }
    } else {
      setTimeout(() => setIsRecording(false), 3500);
    }
  };

  // Reset conversation and session
  const handleNewChat = () => {
    resetSessionId();
    fetch("/api/chat/reset", { method: "POST" }).catch(() => {});
    setMessages([
      {
        id: "1",
        sender: "assistant",
        text: language === "Amharic"
          ? "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። የጥርስ ማጽዳት፣ መሙላት፣ ወይም ቀጠሮ ማስያዝ ይፈልጋሉ? በምን ልርዳዎት?"
          : "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        showForm: false,
        formSubmitted: false
      }
    ]);
  };

  // Send message function - strictly adheres to user-selected language (NO auto-detection)
  const sendMessage = async (
    textToSend?: string,
    options?: { hidden?: boolean; originatingMessageId?: string }
  ) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (!textToSend) {
      setInput("");
    }

    if (!options?.hidden) {
      const userMsg: Message = {
        id: Date.now().toString(),
        sender: "patient",
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    // Daily limit check to protect API token usage
    if (dailyCount >= DAILY_LIMIT) {
      const limitReply = language === "Amharic"
        ? "የዛሬውን የ15 ጥያቄዎች ነፃ የውይይት ገደብ አጠናቀዋል። ለቀጠሮ እና ለቀጣይ መረጃ እባክዎ በቀጥታ ወደ ክሊኒኩ መቀበያ በ 📞 +251 911 234567 ይደውሉ።"
        : "You have reached your daily limit of 15 free questions. To book directly or ask further questions, please call our clinic front desk at 📞 +251 911 234567.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: limitReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
      playAudioOrSpeak(null, limitReply);
      return;
    }

    // Update daily count and persist
    const newCount = dailyCount + 1;
    setDailyCount(newCount);
    localStorage.setItem(todayKey, String(newCount));

    setIsLoading(true);

    // Explicit user-chosen language sent directly to n8n webhook (zero auto-detection heuristics)
    const payload = {
      message: text,
      chatInput: text,
      sessionId: getSessionId(),
      channel: "web",
      language: language,
      voiceEnabled: voiceEnabled
    };

    let reply = "";
    let showForm = false;
    let showManageForm = false;
    let manageAction: 'cancel' | 'reschedule' = 'cancel';
    let slots: Array<{ label: string; slot_start?: string }> | undefined = undefined;
    let audio: string | null = null;
    let callSuccess = false;

    try {
      // The browser calls only /api/chat (never the n8n URL), and reply text is read from "reply"
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        reply = data.reply || data.output || data.response || "";
        showForm = Boolean(data.showForm);
        showManageForm = Boolean(data.showManageForm);
        manageAction = data.manageAction || 'cancel';
        slots = data.slots || undefined;
        audio = data.audio || null;
        callSuccess = true;
        setLastLog({
          url: "/api/chat",
          status: res.status,
          payload,
          response: data,
          time: new Date().toLocaleTimeString()
        });
      } else {
        const errData = await res.json().catch(() => null);
        const serverHint = errData?.hint ? `\n\n💡 ${errData.hint}` : "";
        reply = errData?.output || errData?.reply || (
          language === "Amharic"
            ? `ይቅርታ፣ ከክሊኒኩ አገልጋይ ጋር መገናኘት አልተቻለም (HTTP ${res.status})። እባክዎ በ 📞 +251 11 555 0123 ይደውሉልን።${serverHint}`
            : `Could not connect to the n8n workflow (HTTP ${res.status}: ${errData?.error || "unreachable"}).${serverHint}`
        );
        callSuccess = true;
      }
    } catch (err: any) {
      setLastLog({
        url: "/api/chat",
        status: "FAILED",
        payload,
        response: null,
        error: err.message,
        time: new Date().toLocaleTimeString()
      });
      reply = language === "Amharic"
        ? `⚠️ የኔትወርክ ግንኙነት ስህተት አጋጥሟል (${err.message})። እባክዎ n8n ስራ ላይ መሆኑን ያረጋግጡ ወይም በ 📞 +251 11 555 0123 ይደውሉ።`
        : `⚠️ Webhook connection issue (${err.message}). If testing in n8n, verify the workflow is Active or 'Listen for test event' is active. Clinic line: 📞 +251 11 555 0123.`;
      callSuccess = true;
    }

    // Real error messaging on network hiccup or timeout - ZERO mock simulation
    if (!reply) {
      reply = language === "Amharic"
        ? "ይቅርታ፣ የኔትወርክ መቆራረጥ አጋጥሟል ወይም የአገልጋዩ ምላሽ ጊዜ ወስዶበታል (Connection hiccup / Timeout)። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ ወይም በቀጥታ ወደ ክሊኒኩ መቀበያ በ 📞 +251 11 555 0123 ይደውሉ።"
        : "Sorry, there was a network hiccup or connection timeout waiting for the clinic assistant to respond. Please try again or call our front desk directly at 📞 +251 11 555 0123.";
    }

    setIsLoading(false);

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: "assistant",
      text: reply,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      showForm: showForm,
      formSubmitted: false,
      showManageForm: showManageForm,
      manageSubmitted: false,
      initialManageAction: manageAction,
      slots: slots
    };

    setMessages((prev) => [...prev, botMsg]);
    playAudioOrSpeak(audio, reply);
  };

  return (
    <div className="min-h-screen w-screen bg-white text-slate-800 flex flex-col justify-between font-sans">
      {/* HEADER */}
      <header className="border-b border-slate-100 px-6 sm:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🦷
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">Denttora Dental Clinic</h1>
            <p className="text-xs text-slate-400">Addis Ababa, Ethiopia</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition cursor-pointer ${
              showDebug
                ? "bg-slate-900 text-cyan-300 border-slate-900"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API Inspector</span>
          </button>
        </div>
      </header>

      {/* DEBUG PANEL DRAWER (WHEN OPEN) */}
      {showDebug && (
        <div className="bg-slate-950 text-slate-200 border-b border-slate-800 p-6 text-xs font-mono space-y-4">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-cyan-400 flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Live Backend Proxy Inspector
              </span>
              <span className="text-[11px] text-slate-400">Endpoint: POST /api/chat</span>
            </div>

            {/* Workflow Sync Helper for n8n */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 rounded border border-slate-800 text-[11px]">
              <span className="text-slate-300">
                📦 <strong>n8n Amharic + English Workflow:</strong> Ready to import into your n8n canvas.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch("/workflows/Dental-Clinic-RAG-CHAT-Fixed.json");
                      const text = await res.text();
                      await navigator.clipboard.writeText(text);
                      alert("Workflow JSON copied to clipboard! In n8n, press Ctrl+V / Cmd+V on the canvas.");
                    } catch (e) {
                      window.open("/workflows/Dental-Clinic-RAG-CHAT-Fixed.json", "_blank");
                    }
                  }}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded font-medium transition cursor-pointer"
                >
                  📋 Copy JSON for n8n
                </button>
                <a
                  href="/workflows/Dental-Clinic-RAG-CHAT-Fixed.json"
                  download="Dental-Clinic-RAG-CHAT-Fixed.json"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium transition border border-slate-700"
                >
                  ⬇️ Download JSON
                </a>
              </div>
            </div>

            {/* Last Execution Inspector */}
            {lastLog ? (
              <div className="p-3 bg-slate-900/90 rounded border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Last Sent: {lastLog.time} ➔ {lastLog.url}</span>
                  <span className={lastLog.status === 200 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    Status: {lastLog.status}
                  </span>
                </div>
                {lastLog.payload && (
                  <div>
                    <span className="text-slate-500">Payload: </span>
                    <code className="text-slate-300">{JSON.stringify(lastLog.payload)}</code>
                  </div>
                )}
                {lastLog.response && (
                  <pre className="text-[11px] text-emerald-300 max-h-24 overflow-y-auto bg-slate-950 p-2 rounded">
                    {JSON.stringify(lastLog.response, null, 2)}
                  </pre>
                )}
                {lastLog.error && (
                  <div className="text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/60">
                    <strong>Error:</strong> {lastLog.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 italic">No messages sent yet. Send a message to inspect the call.</div>
            )}
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Front-Desk Virtual Reception</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
          Exceptional Dental Care for Your Family
        </h2>

        <p className="text-slate-500 max-w-lg text-sm sm:text-base leading-relaxed mb-8">
          Welcome to Denttora. Click the floating chat icon in the bottom corner to ask questions about teeth cleaning, check prices, or book an appointment.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              setIsCenterModal(false);
              setIsOpen(true);
            }}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-md shadow-teal-600/20 transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat with Assistant</span>
          </button>

          <a
            href="tel:+251911234567"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5 text-teal-600" />
            <span>Direct Call (+251 911 234567)</span>
          </a>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-4 px-6 sm:px-12 text-center text-xs text-slate-400">
        Denttora Dental Clinic • Bole Sub-city, Addis Ababa • Powered by n8n AI & Voice
      </footer>

      {/* FLOATING BOT LAUNCHER BUTTON (Bottom-Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isOpen && (
          <button
            onClick={() => {
              setIsCenterModal(false);
              setIsOpen(true);
            }}
            className="hidden sm:flex items-center gap-2 bg-white text-slate-700 text-xs font-medium px-3.5 py-2 rounded-full shadow-lg border border-slate-200/80 hover:bg-slate-50 transition hover:scale-105 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Chat or Speak with us</span>
          </button>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer ${
            isOpen
              ? "bg-slate-800 hover:bg-slate-900 shadow-slate-900/30 rotate-90"
              : "bg-teal-600 hover:bg-teal-700 shadow-teal-700/30"
          }`}
          title={isOpen ? "Close Chatbot" : "Open Chatbot"}
          aria-label={isOpen ? "Close Chatbot" : "Open Chatbot"}
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

      {/* CHAT WINDOW: STRICTLY POSITIONED ON SAME SIDE AS LAUNCHER ICON WITH GUARANTEED BODY MARGINS & CRISP BORDER */}
      {isOpen && (
        <>
          {/* Backdrop only when manually centered */}
          {isCenterModal && (
            <div
              onClick={() => setIsCenterModal(false)}
              className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            />
          )}

          <div
            className={
              isCenterModal
                ? "fixed inset-4 sm:inset-8 md:inset-12 lg:inset-16 max-w-2xl w-full h-[88vh] max-h-[720px] mx-auto my-auto z-50 bg-white rounded-3xl shadow-2xl border-2 border-slate-300 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                : "fixed bottom-[88px] sm:bottom-[92px] right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[410px] max-w-[420px] h-[min(580px,calc(100dvh-7.5rem))] max-h-[calc(100dvh-7.5rem)] z-50 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.28)] border-2 border-slate-300 ring-1 ring-slate-900/10 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
            }
          >
            {/* FIRST-RUN LANGUAGE SELECTION MODAL PROMPT */}
            {showLanguageModal && (
              <div className="absolute inset-0 z-40 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 max-w-xs w-full text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl shadow-inner border border-teal-100">
                    🦷
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">Choose Your Language</h4>
                    <p className="text-xs font-semibold text-teal-700">እባክዎ የሚመርጡትን ቋንቋ ይምረጡ</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                      Select your preferred language. The chatbot and voice engine will strictly follow your selection.
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => selectLanguage("Amharic")}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-teal-500 bg-teal-50/70 hover:bg-teal-100/80 text-left transition group cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🇪🇹</span>
                        <div>
                          <p className="text-xs font-bold text-teal-950">አማርኛ (Amharic)</p>
                          <p className="text-[10px] text-teal-700">ውይይቱን በአማርኛ ቋንቋ ይቀጥሉ</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-teal-700">ይምረጡ ➔</span>
                    </button>

                    <button
                      onClick={() => selectLanguage("English")}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-teal-500 bg-white hover:bg-teal-50/40 text-left transition group cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🇺🇸</span>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-teal-900">English</p>
                          <p className="text-[10px] text-slate-500">Continue consultation in English</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-400 group-hover:text-teal-600">Select ➔</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-2.5">
                    You can alter this anytime using the toggle in the header.
                  </p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="bg-teal-600 px-3.5 py-3 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                  🦷
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">Denttora Assistant</h3>
                  <p className="text-[10px] text-teal-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                    Online • Addis Ababa
                  </p>
                </div>
              </div>

              {/* Persistent Language Switcher & Controls */}
              <div className="flex items-center gap-1.5">
                {/* Segmented language switcher: User can alter at ANY time */}
                <div className="flex items-center bg-teal-800/90 rounded-lg p-0.5 border border-teal-500/30 text-[11px] font-medium shadow-inner">
                  <button
                    onClick={() => selectLanguage("Amharic")}
                    className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                      language === "Amharic"
                        ? "bg-white text-teal-950 font-bold shadow-xs"
                        : "text-teal-100 hover:text-white"
                    }`}
                    title="Switch to Amharic (አማርኛ)"
                  >
                    🇪🇹 አማ
                  </button>
                  <button
                    onClick={() => selectLanguage("English")}
                    className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                      language === "English"
                        ? "bg-white text-teal-950 font-bold shadow-xs"
                        : "text-teal-100 hover:text-white"
                    }`}
                    title="Switch to English"
                  >
                    🇺🇸 EN
                  </button>
                </div>

                <a
                  href="tel:+251911234567"
                  className="p-1.5 text-white/90 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer flex items-center gap-1"
                  title="Call Clinic Reception Directly (+251 911 234567)"
                >
                  <Phone className="w-3.5 h-3.5 text-teal-200" />
                </a>

                <button
                  onClick={handleNewChat}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                  title="New chat"
                  aria-label="New chat"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                  title={voiceEnabled ? "Mute Voice" : "Enable Voice"}
                >
                  {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                {/* Center Modal / Floating Widget Toggle */}
                <button
                  onClick={() => {
                    setIsCenterModal((prev) => {
                      const next = !prev;
                      localStorage.setItem("denttora_center_modal", String(next));
                      return next;
                    });
                  }}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                  title={isCenterModal ? "Collapse to Floating Widget" : "Expand to Centered Console with Margins"}
                >
                  {isCenterModal ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                  title="Minimize Chat"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

          {/* Quick Suggestion Chips */}
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {language === "Amharic" ? (
              <>
                <button
                  onClick={() => sendMessage("የጥርስ ማጽዳት አገልግሎት እፈልጋለሁ")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  የጥርስ ማጽዳት
                </button>
                <button
                  onClick={() => sendMessage("ለነገ ክፍት የቀጠሮ ሰዓቶች አሉ?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  ነገ ቀጠሮ
                </button>
                <button
                  onClick={() => sendMessage("ቀጠሮዬን መሰረዝ ወይም ቀን መቀየር እፈልጋለሁ")}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 whitespace-nowrap transition cursor-pointer"
                >
                  ቀጠሮ መሰረዝ/መቀየር
                </button>
                <button
                  onClick={() => sendMessage("የጥርስ ህክምና ዋጋ ዝርዝር ስንት ነው?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  የዋጋ ዝርዝር
                </button>
                <button
                  onClick={() => sendMessage("ክሊኒኩ የት ነው የሚገኘው?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  አድራሻ
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => sendMessage("I need a tooth cleaning")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Tooth cleaning
                </button>
                <button
                  onClick={() => sendMessage("Can I book for tomorrow morning?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Book visit
                </button>
                <button
                  onClick={() => sendMessage("I want to cancel or reschedule my appointment")}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 whitespace-nowrap transition cursor-pointer"
                >
                  Cancel / Reschedule
                </button>
                <button
                  onClick={() => sendMessage("How much are cleanings and fillings?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Price list
                </button>
                <button
                  onClick={() => sendMessage("Where is the clinic located?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Location
                </button>
              </>
            )}
          </div>

          {/* Token Management: Daily Quota & In-Clinic Payment Notice */}
          <div className="bg-slate-100/95 px-3.5 py-1.5 border-b border-slate-200/80 flex items-center justify-between text-[10px] text-slate-600 select-none">
            <span className="flex items-center gap-1 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${dailyCount >= DAILY_LIMIT ? "bg-amber-500" : "bg-emerald-500"}`}></span>
              {language === "Amharic"
                ? `የዛሬ የቀሩ ጥያቄዎች፡ ${Math.max(0, DAILY_LIMIT - dailyCount)}/${DAILY_LIMIT}`
                : `Daily quota: ${Math.max(0, DAILY_LIMIT - dailyCount)}/${DAILY_LIMIT} remaining`}
            </span>
            <span className="text-slate-400 font-normal">
              {language === "Amharic" ? "ክፍያ በአካል ክሊኒኩ ሲደርሱ" : "Pay at clinic upon arrival"}
            </span>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/60">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-2.5 ${m.sender === "patient" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0 mt-0.5">
                    🦷
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line shadow-xs ${
                    m.sender === "patient"
                      ? "bg-teal-600 text-white rounded-tr-xs"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs"
                  }`}
                >
                  {m.text}

                  {/* Render Interactive Slot Buttons (Tap-to-Select) */}
                  {m.sender === "assistant" && m.slots && m.slots.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] font-semibold text-teal-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>{language === "Amharic" ? "የሚመችዎትን ሰዓት ይጫኑ፡" : "Tap your preferred time:"}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {m.slots.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendMessage(s.label)}
                            disabled={isLoading}
                            className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-600 text-teal-900 hover:text-white rounded-lg border border-teal-200/90 text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs hover:shadow-sm"
                            title={`Select slot ${s.label}`}
                          >
                            <span>{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render BookingForm inside bot bubble with selected language */}
                  {m.sender === "assistant" && m.showForm && (
                    <BookingForm
                      alreadySubmitted={m.formSubmitted}
                      isLoading={isLoading}
                      language={language}
                      onSubmit={(formattedDetails) => {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === m.id ? { ...msg, formSubmitted: true } : msg
                          )
                        );
                        sendMessage(formattedDetails, {
                          hidden: true,
                          originatingMessageId: m.id
                        });
                      }}
                    />
                  )}

                  {/* Render Cancel / Postpone Form inside bot bubble */}
                  {m.sender === "assistant" && m.showManageForm && (
                    <ManageBookingForm
                      alreadySubmitted={m.manageSubmitted}
                      isLoading={isLoading}
                      language={language}
                      initialAction={m.initialManageAction || 'cancel'}
                      onSubmit={(formattedDetails) => {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === m.id ? { ...msg, manageSubmitted: true } : msg
                          )
                        );
                        sendMessage(formattedDetails, {
                          hidden: false,
                          originatingMessageId: m.id
                        });
                      }}
                    />
                  )}

                  <div
                    className={`text-[9px] mt-1.5 text-right ${
                      m.sender === "patient" ? "text-teal-100" : "text-slate-400"
                    }`}
                  >
                    {m.time}
                  </div>
                </div>

                {m.sender === "patient" && (
                  <div className="w-7 h-7 rounded-xl bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0 mt-0.5">
                    👤
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0 mt-0.5">
                  🦷
                </div>
                <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-400 flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar with Token Safeguard (400 char limit & daily quota disable) */}
          <div className="p-3 bg-white border-t border-slate-100 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMicClick}
                disabled={dailyCount >= DAILY_LIMIT}
                className={`p-2.5 rounded-full transition cursor-pointer disabled:opacity-40 ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
                title={isRecording ? "Stop Listening" : "Speak to Assistant"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  maxLength={400}
                  value={input}
                  disabled={dailyCount >= DAILY_LIMIT}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={
                    dailyCount >= DAILY_LIMIT
                      ? (language === "Amharic" ? "የዛሬውን ገደብ ጨርሰዋል • በ 0911234567 ይደውሉ" : "Daily quota reached • Please call +251 911 234567")
                      : isRecording
                      ? (language === "Amharic" ? "እያዳመጥኩ ነው..." : "Listening...")
                      : (language === "Amharic" ? "ጥያቄዎን እዚህ ይጻፉ..." : "Type your message...")
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-12 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 disabled:opacity-60 transition"
                />
                {input.length > 250 && (
                  <span className="absolute right-3 text-[10px] text-slate-400 font-mono">
                    {input.length}/400
                  </span>
                )}
              </div>

              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || dailyCount >= DAILY_LIMIT}
                className="p-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-full transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {dailyCount >= DAILY_LIMIT && (
              <div className="flex items-center justify-between text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                <span>
                  {language === "Amharic"
                    ? "የዛሬውን ነፃ የውይይት ገደብ አጠናቀዋል።"
                    : "You reached the daily question limit."}
                </span>
                <a
                  href="tel:+251911234567"
                  className="font-bold underline text-teal-800 flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  0911234567
                </a>
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
