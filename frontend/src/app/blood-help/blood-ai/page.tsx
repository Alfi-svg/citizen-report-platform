"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  HospitalSummary,
  HospitalListResponse,
  BloodAIChatResponse,
  BloodGroup,
} from "@/lib/types";
import { Language } from "@/lib/i18n";
import HospitalResultCard from "@/components/HospitalResultCard";
import {
  Bot,
  Send,
  Droplet,
  Sparkles,
  RefreshCw,
  Navigation,
  Building2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BD_DISTRICTS = [
  "All Districts", "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur",
  "Mymensingh", "Gazipur", "Narayanganj", "Cumilla", "Bogura", "Cox's Bazar", "Noakhali", "Feni",
  "Brahmanbaria", "Jessore", "Kushtia", "Pabna", "Dinajpur", "Tangail", "Faridpur", "Jamalpur"
];

const PRESET_QUERIES_EN = [
  "Amar B+ blood lagbe, Dhaka Medical er kache kon hospital e pabo?",
  "Find nearby hospitals with O+ blood availability",
  "Emergency blood bank phone number in Shahbag Dhaka",
  "Looking for A- blood bank in Sylhet",
];

const PRESET_QUERIES_BN = [
  "আমার A+ রক্ত লাগবে। কাছাকাছি কোন হাসপাতালে পাওয়া যাবে?",
  "ঢাকা মেডিকেল এর কাছে জরুরি রক্তের সন্ধান চাই",
  "শাহবাগ এলাকায় ও পজিটিভ ব্লাড ব্যাংক ফোন নম্বর",
  "চট্টগ্রাম মেডিকেল এ B+ রক্ত পাওয়া যাবে কি?",
];

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  extracted?: {
    blood_group?: string | null;
    district?: string | null;
    urgency?: string | null;
  };
  followUp?: string | null;
  hospitals?: HospitalSummary[];
  donors?: Array<{
    name: string;
    blood_group: string;
    phone?: string;
    district: string;
  }>;
  disclaimer?: string;
}

export default function BloodAIPage() {
  const [lang, setLang] = useState<Language>("en");

  // Sync language
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = (localStorage.getItem("app_lang") as Language) || "en";
      setLang(saved);
      const handleLangChange = () => {
        const next = (localStorage.getItem("app_lang") as Language) || "en";
        setLang(next);
      };
      window.addEventListener("languagechange", handleLangChange);
      return () => window.removeEventListener("languagechange", handleLangChange);
    }
  }, []);

  const isBn = lang === "bn";

  // Mobile view toggle
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "hospitals">("chat");

  // User location state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Filters state
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All Districts");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>("ALL");

  // Hospital search results state
  const [hospitals, setHospitals] = useState<HospitalSummary[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [hospitalError, setHospitalError] = useState<string | null>(null);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgIdCounter = useRef<number>(100);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Initial welcome message
  useEffect(() => {
    const welcomeText = isBn
      ? "স্বাগতম! আমি নিরাপদ্তা ব্লাড এআই (Blood AI)। জরুরি রক্তের গ্রুপ অনুসন্ধান, নিকটস্থ হাসপাতাল ও ব্লাড ব্যাংকের বেসলাইন স্টক এবং ভেরিফায়েড ইমার্জেন্সি নম্বরের জন্য সাহায্য করতে প্রস্তুত। আপনার জিজ্ঞাসা স্বাভাবিক ভাষায় লিখুন।"
      : "Welcome! I am Nirapotta Blood AI. I can help you locate nearby hospitals, verified blood banks, baseline blood group stock estimates, and emergency contact numbers across Bangladesh. Ask in plain English or Bangla.";

    setMessages([
      {
        id: "msg_init",
        sender: "ai",
        text: welcomeText,
        timestamp: new Date(),
        disclaimer: isBn
          ? "জরুরি সতর্কতা: বেসলাইন স্টক তথ্যের সত্যতা নিশ্চিত করতে হাসপাতালে যাওয়ার পূর্বে সরাসরি ফোনে যোগাযোগ করুন।"
          : "Emergency Notice: Listed blood units represent baseline demo estimates. Always confirm availability by phone before dispatching.",
      },
    ]);
  }, [isBn]);

  // Request HTML5 Geolocation
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus(isBn ? "আপনার ব্রাউজার লোকেশন সমর্থন করে না।" : "Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocationStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setLocating(false);
        setLocationStatus(isBn ? "বর্তমান অবস্থান যুক্ত হয়েছে" : "Current location detected");
        loadHospitals(coords.lat, coords.lng, selectedDistrict, selectedBloodGroup);
      },
      () => {
        setLocating(false);
        setLocationStatus(isBn ? "লোকেশন অনুমতি পাওয়া যায়নি। জেলা নির্বাচন করুন।" : "Location access denied. Please select district manually.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Load Hospitals from Backend
  const loadHospitals = async (
    lat?: number,
    lng?: number,
    district?: string,
    bg?: string
  ) => {
    setLoadingHospitals(true);
    setHospitalError(null);

    const query = new URLSearchParams();
    query.set("limit", "25");

    if (lat && lng) {
      query.set("lat", lat.toString());
      query.set("lng", lng.toString());
      query.set("radius_km", "40.0");
    }

    if (district && district !== "All Districts") {
      query.set("district", district);
    }

    if (bg && bg !== "ALL") {
      query.set("blood_group", bg);
    }

    try {
      const data = await apiFetch<HospitalListResponse>(`/blood/hospitals/nearby?${query.toString()}`);
      setHospitals(data.items);
    } catch (err: unknown) {
      setHospitalError(err instanceof Error ? err.message : "Failed to load hospitals");
    } finally {
      setLoadingHospitals(false);
    }
  };

  // Initial load of hospitals
  useEffect(() => {
    loadHospitals(userCoords?.lat, userCoords?.lng, selectedDistrict, selectedBloodGroup);
  }, [selectedDistrict, selectedBloodGroup, userCoords?.lat, userCoords?.lng]);

  // Handle Chat Submit
  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || inputQuery).trim();
    if (!q || isSending) return;

    setInputQuery("");
    msgIdCounter.current += 1;

    // Append user message
    const userMsgId = `user_${msgIdCounter.current}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: "user",
        text: q,
        timestamp: new Date(),
      },
    ];
    setMessages(newMessages);
    setIsSending(true);

    try {
      const payload = {
        message: q,
        conversation_id: conversationId || undefined,
        user_latitude: userCoords?.lat || undefined,
        user_longitude: userCoords?.lng || undefined,
        user_district: selectedDistrict !== "All Districts" ? selectedDistrict : undefined,
        blood_group_preference: selectedBloodGroup !== "ALL" ? selectedBloodGroup : undefined,
        lang,
      };

      const res = await apiFetch<BloodAIChatResponse>("/blood/ai/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      // If hospitals were returned, update right-panel list with relevant hospitals
      if (res.hospitals && res.hospitals.length > 0) {
        setHospitals(res.hospitals);
      }

      // If blood group was extracted, sync filter
      if (res.extracted_params?.blood_group) {
        setSelectedBloodGroup(res.extracted_params.blood_group);
      }

      // Append AI response
      msgIdCounter.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${msgIdCounter.current}`,
          sender: "ai",
          text: res.reply,
          timestamp: new Date(),
          extracted: {
            blood_group: res.extracted_params?.blood_group,
            district: res.extracted_params?.district,
            urgency: res.extracted_params?.urgency,
          },
          followUp: res.is_clarification_needed ? res.follow_up_question : null,
          hospitals: res.hospitals,
          donors: res.donors,
          disclaimer: res.disclaimer,
        },
      ]);
    } catch {
      msgIdCounter.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${msgIdCounter.current}`,
          sender: "ai",
          text: isBn
            ? "দুঃখিত, সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "Connection error. Please try asking again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const presets = isBn ? PRESET_QUERIES_BN : PRESET_QUERIES_EN;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Top Header / Sub-Nav */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-500 text-white flex items-center justify-center shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100">
                  {isBn ? "নিরাপত্তা ব্লাড এআই" : "Nirapotta Blood AI"}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  Hospital & Stock Intelligence
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isBn
                  ? "জরুরি রক্ত সন্ধান ও নিকটস্থ হাসপাতালের ভেরিফায়েড স্টক ও কন্টাক্ট ডিরেক্টরি"
                  : "Verified Bangladesh hospital blood banks, live inventory check, and emergency contacts"}
              </p>
            </div>
          </div>

          {/* Quick Sub-Navigation Links */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
            <Link
              href="/blood-help"
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 shrink-0 transition"
            >
              {isBn ? "রক্তদাতা সন্ধান" : "Find Donors"}
            </Link>
            <Link
              href="/blood-help/request"
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 shrink-0 transition flex items-center gap-1"
            >
              <Droplet className="h-3.5 w-3.5 text-rose-600" />
              <span>{isBn ? "রক্ত রিকোয়েস্ট" : "Request Blood"}</span>
            </Link>
            <Link
              href="/blood-help/map"
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 shrink-0 transition"
            >
              {isBn ? "ব্লাড ম্যাপ" : "Blood Map"}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveMobileTab("chat")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            activeMobileTab === "chat"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>{isBn ? "এআই সহকারী (চ্যাট)" : "Blood AI Chat"}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab("hospitals")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            activeMobileTab === "hospitals"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>{isBn ? `নিকটস্থ হাসপাতাল (${hospitals.length})` : `Nearby Hospitals (${hospitals.length})`}</span>
        </button>
      </div>

      {/* Main Two-Panel Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================================================================= */}
        {/* LEFT PANEL: Blood AI Conversation (7 Cols on Desktop) */}
        {/* ================================================================= */}
        <div
          className={`lg:col-span-7 flex flex-col h-[calc(100vh-140px)] rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden ${
            activeMobileTab === "hospitals" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Conversation Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {isBn ? "ভেরিফায়েড হাসপাতাল নেটওয়ার্ক কানেক্টেড" : "Verified BD Hospital Network Grounded"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setConversationId("");
                msgIdCounter.current += 1;
                setMessages([
                  {
                    id: `reset_${msgIdCounter.current}`,
                    sender: "ai",
                    text: isBn
                      ? "চ্যাট পরিষ্কার করা হয়েছে। নতুন কোনো রক্তের গ্রুপ বা হাসপাতাল সম্পর্কে জানতে লিখুন।"
                      : "Chat refreshed. How can I assist you with emergency blood or hospital search today?",
                    timestamp: new Date(),
                  },
                ]);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>{isBn ? "রিসেট চ্যাট" : "Clear Chat"}</span>
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((msg) => {
              const isAi = msg.sender === "ai";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isAi ? "" : "flex-row-reverse"}`}
                >
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black shadow-2xs ${
                      isAi
                        ? "bg-rose-600 text-white"
                        : "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    }`}
                  >
                    {isAi ? <Bot className="h-4 w-4" /> : "YOU"}
                  </div>

                  <div className={`space-y-2 max-w-[85%] ${isAi ? "" : "text-right"}`}>
                    <div
                      className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isAi
                          ? "bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 rounded-tl-xs"
                          : "bg-rose-600 text-white font-medium rounded-tr-xs"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>

                    {/* Extracted Parameters Tagging */}
                    {isAi && msg.extracted && (msg.extracted.blood_group || msg.extracted.district) && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        {msg.extracted.blood_group && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 font-extrabold border border-rose-200 dark:border-rose-900">
                            Blood Group: {msg.extracted.blood_group}
                          </span>
                        )}
                        {msg.extracted.district && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                            Location: {msg.extracted.district}
                          </span>
                        )}
                        {msg.extracted.urgency && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold">
                            Urgency: {msg.extracted.urgency}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Follow-up Quick Blood Group Selector */}
                    {isAi && msg.followUp && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2 text-left">
                        <p className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                          <span>{msg.followUp}</span>
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {BLOOD_GROUPS.map((bg) => (
                            <button
                              key={bg}
                              type="button"
                              onClick={() => handleSendMessage(`${bg} blood group`)}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-rose-600 hover:text-white border border-rose-300 dark:border-rose-800 text-zinc-800 dark:text-zinc-200 font-extrabold text-xs transition cursor-pointer shadow-2xs"
                            >
                              {bg}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Donors Match Summary */}
                    {isAi && msg.donors && msg.donors.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-left space-y-1.5">
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {isBn
                              ? `${msg.donors.length} জন সক্রিয় ভলান্টিয়ার রক্তদাতা পাওয়া গেছে:`
                              : `Found ${msg.donors.length} registered volunteer donors:`}
                          </span>
                        </p>
                        <div className="space-y-1">
                          {msg.donors.map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300">
                              <span className="font-semibold">{d.name} ({d.district})</span>
                              <span className="text-[11px] font-mono text-zinc-500">{d.phone || "In-app request"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Medical Disclaimer */}
                    {isAi && msg.disclaimer && (
                      <p className="text-[10px] text-zinc-400 italic">
                        {msg.disclaimer}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  <span>{isBn ? "ডেটাবেস অনুসন্ধান ও রক্ত মজুদ বিশ্লেষণ হচ্ছে..." : "Searching verified hospitals and live inventory..."}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Preset Queries */}
          <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-bold text-zinc-400 shrink-0 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-rose-500" />
              <span>{isBn ? "প্রস্তাবিত:" : "Try:"}</span>
            </span>
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(preset)}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-rose-400 text-zinc-700 dark:text-zinc-300 hover:text-rose-600 text-[11px] font-semibold whitespace-nowrap transition cursor-pointer shrink-0 shadow-2xs"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={
                isBn
                  ? "রক্তের গ্রুপ, হাসপাতাল বা এলাকা লিখে মেসেজ পাঠান..."
                  : "Ask about blood availability, nearby hospitals, or contact numbers..."
              }
              className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !inputQuery.trim()}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">{isBn ? "পাঠান" : "Send"}</span>
            </button>
          </form>
        </div>

        {/* ================================================================= */}
        {/* RIGHT PANEL: Nearby Hospital Finder & Live Stock (5 Cols on Desktop) */}
        {/* ================================================================= */}
        <div
          className={`lg:col-span-5 flex flex-col space-y-4 ${
            activeMobileTab === "chat" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Controls Card */}
          <div className="p-4 sm:p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-rose-600" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isBn ? "হাসপাতাল ও ব্লাড ব্যাংক ফিল্টার" : "Hospital & Stock Finder"}
                </h2>
              </div>
              <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                {hospitals.length} {isBn ? "টি প্রতিষ্ঠান" : "Facilities"}
              </span>
            </div>

            {/* Location selector / Detection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={locating}
                className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Navigation className={`h-3.5 w-3.5 text-rose-600 ${locating ? "animate-spin" : ""}`} />
                <span>{locating ? (isBn ? "খুঁজছি..." : "Locating...") : (isBn ? "আমার লোকেশন ব্যবহার করুন" : "Use My Location")}</span>
              </button>

              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                {BD_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {locationStatus && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>{locationStatus}</span>
              </p>
            )}

            {/* Blood Group Filter Pills */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                {isBn ? "রক্তের গ্রুপ অনুযায়ী স্টক ফিল্টার:" : "Filter Stock by Blood Group:"}
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedBloodGroup("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    selectedBloodGroup === "ALL"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  ALL
                </button>
                {BLOOD_GROUPS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setSelectedBloodGroup(bg)}
                    className={`px-2 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      selectedBloodGroup === bg
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-rose-50 hover:text-rose-600"
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hospital Results List */}
          <div className="space-y-3">
            {loadingHospitals && (
              <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                <RefreshCw className="h-6 w-6 text-rose-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-zinc-500">
                  {isBn ? "হাসপাতালের তথ্য লোড হচ্ছে..." : "Loading hospital directory and live stock..."}
                </p>
              </div>
            )}

            {hospitalError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{hospitalError}</span>
              </div>
            )}

            {!loadingHospitals && hospitals.length === 0 && (
              <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
                <Building2 className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  {isBn
                    ? "নির্বাচিত ফিল্টারে কোনো হাসপাতাল পাওয়া যায়নি।"
                    : "No hospital records found matching your selected filters."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDistrict("All Districts");
                    setSelectedBloodGroup("ALL");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 cursor-pointer"
                >
                  {isBn ? "ফিল্টার রিসেট করুন" : "Reset Filters"}
                </button>
              </div>
            )}

            {!loadingHospitals &&
              hospitals.map((h) => (
                <HospitalResultCard
                  key={h.id}
                  hospital={h}
                  selectedBloodGroup={selectedBloodGroup !== "ALL" ? selectedBloodGroup : null}
                  lang={lang}
                />
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
