"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Square,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  RotateCcw,
  Volume2,
  VolumeX,
  Loader2,
  PhoneCall,
  ShieldAlert,
  Edit3,
  Check,
  MapPin,
  HeartPulse,
  Flame,
  CarFront,
  Droplet,
  FileText,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  VoiceEmergencyIntakeRequest,
  VoiceEmergencyIntakeResponse,
  EmergencyConfirmationResponse,
  DraftReportPreview,
  Category,
} from "@/lib/types";
import { useBackClose } from "@/lib/useBackClose";
import { Language } from "@/lib/i18n";

interface AIVoiceEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDraft?: (draft: DraftReportPreview) => void;
  categories?: Category[];
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  currentLocationText?: string | null;
}

type RecordingPhase =
  | "idle"
  | "recording"
  | "transcribed"
  | "processing"
  | "preview"
  | "confirmed"
  | "unsupported"
  | "denied";

export default function AIVoiceEmergencyModal({
  isOpen,
  onClose,
  onApplyDraft,
  currentLatitude,
  currentLongitude,
  currentLocationText,
}: AIVoiceEmergencyModalProps) {
  const [lang, setLang] = useState<Language>("en");
  const isBn = lang === "bn";

  // Recording & Transcript State
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [rawTranscript, setRawTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);

  // AI Response & Confirmation State
  const [intakeResponse, setIntakeResponse] = useState<VoiceEmergencyIntakeResponse | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<EmergencyConfirmationResponse | null>(null);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>("");

  // Hardware / Browser Refs
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync language with localStorage
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

  useBackClose(isOpen, onClose, "aiVoiceEmergencyModal");

  // Check Web Speech API Support
  const isSpeechSupported = useCallback(() => {
    if (typeof window === "undefined") return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }, []);

  // Stop TTS speech on unmount or close
  const stopTTS = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingTTS(false);
    }
  }, []);

  const speakText = useCallback(
    (textToSpeak: string) => {
      if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      stopTTS();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = isBn ? "bn-BD" : "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeakingTTS(true);
      utterance.onend = () => setIsSpeakingTTS(false);
      utterance.onerror = () => setIsSpeakingTTS(false);

      window.speechSynthesis.speak(utterance);
    },
    [isBn, ttsEnabled, stopTTS]
  );

  // Clean up stream & intervals
  const cleanupStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort error
      }
      recognitionRef.current = null;
    }
  }, []);

  // Close handler with full cleanup
  const handleModalClose = () => {
    cleanupStream();
    stopTTS();
    onClose();
  };

  // Start voice recording session
  const startRecording = async () => {
    setErrorMessage(null);
    stopTTS();

    if (!isSpeechSupported()) {
      setPhase("unsupported");
      return;
    }

    try {
      // 1. Request microphone permissions explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. Initialize browser SpeechRecognition
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = isBn ? "bn-BD" : "en-US";

      let finalCapturedText = "";

      recognition.onstart = () => {
        setPhase("recording");
        setRecordingSeconds(0);
        setInterimTranscript("");
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalCapturedText += (finalCapturedText ? " " : "") + item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }
        setTranscript(finalCapturedText);
        setRawTranscript(finalCapturedText);
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed" || event.error === "permission-denied") {
          setPhase("denied");
          setErrorMessage(
            isBn
              ? "মাইক্রোফোনের অনুমতি প্রদান করা হয়নি। ব্রাউজার সেটিংসে মাইক্রোফোন সক্রিয় করুন।"
              : "Microphone permission denied. Please allow microphone access in your browser settings."
          );
        } else if (event.error === "no-speech") {
          setErrorMessage(
            isBn
              ? "কোনো স্পষ্ট কণ্ঠস্বর শনাক্ত হয়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।"
              : "No speech was detected. Please try speaking closer to your microphone."
          );
        } else {
          setErrorMessage(
            isBn
              ? `ভয়েস রেকর্ডিং ত্রুটি: ${event.error}`
              : `Voice recognition error: ${event.error}`
          );
        }
        cleanupStream();
      };

      recognition.onend = () => {
        cleanupStream();
        if (finalCapturedText.trim()) {
          setPhase("transcribed");
        } else {
          setPhase("idle");
        }
      };

      recognition.start();
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPhase("denied");
        setErrorMessage(
          isBn
            ? "মাইক্রোফোনের অনুমতি প্রদান করা হয়নি। ব্রাউজারের অ্যাড্রেস বার থেকে মাইক্রোফোন অ্যাক্সেস দিন।"
            : "Microphone access was denied. Please allow microphone permission in your browser address bar."
        );
      } else {
        setPhase("unsupported");
        setErrorMessage(
          isBn
            ? "আপনার ডিভাইসে ভয়েস রেকর্ডিং চালু করা যায়নি।"
            : "Unable to access microphone on this device."
        );
      }
      cleanupStream();
    }
  };

  // Stop recording manually
  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
    }
    cleanupStream();
    if (transcript.trim() || interimTranscript.trim()) {
      const combined = (transcript + " " + interimTranscript).trim();
      setTranscript(combined);
      setRawTranscript(combined);
      setInterimTranscript("");
      setPhase("transcribed");
    } else {
      setPhase("idle");
    }
  };

  // Reset to initial recording state
  const resetSession = () => {
    cleanupStream();
    stopTTS();
    setPhase("idle");
    setTranscript("");
    setRawTranscript("");
    setInterimTranscript("");
    setRecordingSeconds(0);
    setIntakeResponse(null);
    setConfirmationResult(null);
    setErrorMessage(null);
  };

  // Send citizen-reviewed transcript to backend AI Voice Intake
  const processVoiceIntake = async () => {
    const clean = transcript.trim();
    if (!clean) {
      setErrorMessage(
        isBn
          ? "ট্রান্সক্রিপ্ট খালি রাখা যাবে না। অনুগ্রহ করে বলুন বা লিখুন।"
          : "Transcript cannot be empty. Please speak or type your emergency."
      );
      return;
    }

    setPhase("processing");
    setErrorMessage(null);

    try {
      const payload: VoiceEmergencyIntakeRequest = {
        transcript: clean,
        raw_transcript: rawTranscript.trim() || clean,
        audio_duration_seconds: recordingSeconds > 0 ? recordingSeconds : undefined,
        conversation_id: conversationId || undefined,
        current_latitude: currentLatitude || undefined,
        current_longitude: currentLongitude || undefined,
        current_location_text: currentLocationText || undefined,
        lang,
      };

      const res = await apiFetch<VoiceEmergencyIntakeResponse>(
        "/reports/ai-assistant/voice-intake",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setIntakeResponse(res);
      setConversationId(res.conversation_id);
      setPhase("preview");

      // Speak response aloud if TTS enabled
      if (res.speech_synthesis_hint) {
        speakText(res.speech_synthesis_hint);
      }
    } catch (err: any) {
      setPhase("transcribed");
      setErrorMessage(
        err?.message ||
          (isBn
            ? "ভয়েস রিপোর্ট বিশ্লেষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "Failed to process voice report. Please retry.")
      );
    }
  };

  // Explicit citizen confirmation to create real report in DB
  const confirmAndSubmit = async () => {
    if (!intakeResponse || confirming) return;

    setConfirming(true);
    setErrorMessage(null);

    try {
      const payload = {
        conversation_id: intakeResponse.conversation_id,
        emergency_type: intakeResponse.emergency_type || "INCIDENT",
        confirmation_token: intakeResponse.confirmation_token || undefined,
        draft_report: intakeResponse.draft_report || undefined,
        draft_blood_request: intakeResponse.draft_blood_request || undefined,
      };

      const res = await apiFetch<EmergencyConfirmationResponse>(
        "/reports/ai-assistant/confirm",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setConfirmationResult(res);
      setPhase("confirmed");

      // Optional TTS confirmation
      const successNotice = isBn
        ? "জরুরি রিপোর্ট সফলভাবে দাখিল করা হয়েছে।"
        : "Emergency report successfully created and submitted.";
      speakText(successNotice);
    } catch (err: any) {
      const detail = err?.message || err?.detail;
      if (
        err?.status === 401 ||
        detail?.includes("unauthorized") ||
        detail?.includes("Not authenticated")
      ) {
        setErrorMessage(
          isBn
            ? "রিপোর্ট জমা দিতে অনুগ্রহ করে প্রথমে আপনার নাগরিক অ্যাকাউন্টে লগইন করুন।"
            : "Please log in to your citizen account to confirm and submit this emergency report."
        );
      } else {
        setErrorMessage(
          detail ||
            (isBn
              ? "রিপোর্ট দাখিল করতে ত্রুটি হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।"
              : "Failed to confirm emergency request. Please retry.")
        );
      }
    } finally {
      setConfirming(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isBn ? "ভয়েস জরুরি সহকারী" : "AI Voice Emergency Assistant"}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[740px]">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-700 via-teal-800 to-blue-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Mic className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold leading-tight">
                  {isBn ? "এআই ভয়েস জরুরি সহকারী" : "AI Voice Emergency Assistant"}
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white font-semibold tracking-wide uppercase">
                  Phase E
                </span>
              </div>
              <p className="text-[11px] text-teal-100/90">
                {isBn
                  ? "কথা বলে রিপোর্ট করুন — যাচাই ও নিশ্চিতকরণের পর জমা হবে"
                  : "Voice Intake • Review Transcript • Confirm Before Submit"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio narration toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !ttsEnabled;
                setTtsEnabled(next);
                if (!next) stopTTS();
              }}
              title={ttsEnabled ? "Mute audio narration" : "Enable audio narration"}
              className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                ttsEnabled ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
              }`}
            >
              {ttsEnabled ? (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Language toggle */}
            <button
              type="button"
              onClick={() => {
                const nextLang = isBn ? "en" : "bn";
                setLang(nextLang);
                if (typeof window !== "undefined") {
                  localStorage.setItem("app_lang", nextLang);
                }
              }}
              className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition cursor-pointer"
            >
              {isBn ? "EN" : "বাং"}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={handleModalClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Dispatcher Disclaimer Banner */}
        <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 px-4 py-2 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
            <span>
              {isBn
                ? "জরুরি সেবা: তাৎক্ষণিক বিপদে ৯৯৯ এ কল করুন। এটি ডিসপ্যাচার নয়।"
                : "Notice: In immediate danger, call 999 directly. Nirapotta is not a dispatcher."}
            </span>
          </div>
          <a
            href="tel:999"
            className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 transition"
          >
            <PhoneCall className="h-3 w-3" aria-hidden="true" />
            <span>999</span>
          </a>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Error Message Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3.5 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5"
            >
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Phase: Browser Unsupported */}
          {phase === "unsupported" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30 p-5 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 mx-auto flex items-center justify-center font-bold">
                <MicOff className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-sm text-amber-900 dark:text-amber-100">
                {isBn ? "ভয়েস রিকগনিশন ব্রাউজারে সমর্থিত নয়" : "Voice Recognition Not Supported"}
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 max-w-sm mx-auto">
                {isBn
                  ? "আপনার বর্তমান ব্রাউজারে স্পিচ রিকগনিশন সুবিধা উপলব্ধ নেই। অনুগ্রহ করে নিচে টাইপ করে আপনার জরুরি অবস্থা বর্ণনা করুন।"
                  : "Your browser does not natively support the Web Speech API. You can still type your emergency report in the box below."}
              </p>
              <button
                type="button"
                onClick={() => setPhase("transcribed")}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isBn ? "টাইপ করে বর্ণনা করুন" : "Type Emergency Report"}</span>
              </button>
            </div>
          )}

          {/* Phase: Microphone Permission Denied */}
          {phase === "denied" && (
            <div className="rounded-2xl border border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30 p-5 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 mx-auto flex items-center justify-center font-bold">
                <MicOff className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-sm text-red-900 dark:text-red-100">
                {isBn ? "মাইক্রোফোনের অনুমতি মেলেনি" : "Microphone Access Denied"}
              </h3>
              <p className="text-xs text-red-800 dark:text-red-300 max-w-sm mx-auto">
                {isBn
                  ? "ভয়েস ইনপুট ব্যবহার করতে ব্রাউজারের অ্যাড্রেস বারের লক বা সেটিংস আইকনে ক্লিক করে মাইক্রোফোন ব্যবহারের অনুমতি দিন।"
                  : "Microphone permission is required for voice reporting. Allow microphone access in your browser address bar, or type your report below."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-800 transition inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBn ? "পুনরায় অনুমতি চান" : "Retry Microphone Access"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("transcribed")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBn ? "টাইপ করুন" : "Type Report"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Phase: Idle (Ready to record) */}
          {phase === "idle" && (
            <div className="text-center py-6 sm:py-8 space-y-5">
              <div className="relative inline-flex items-center justify-center">
                <button
                  type="button"
                  onClick={startRecording}
                  className="h-20 w-20 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center transition cursor-pointer"
                  aria-label="Start recording speech"
                >
                  <Mic className="h-10 w-10 text-white" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  {isBn ? "রেকর্ডিং শুরু করতে ক্লিক করুন" : "Tap to Speak Emergency"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  {isBn
                    ? "বাংলা বা ইংরেজিতে স্বাভাবিকভাবে বলুন। ঘটনা, স্থান এবং ক্ষয়ক্ষতির বিবরণ দিন।"
                    : "Describe what happened naturally in Bangla or English. Mention location and injuries if known."}
                </p>
              </div>

              {/* Sample voice prompts */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-zinc-400 block mb-2">
                  {isBn ? "উদাহরণস্বরূপ বলতে পারেন:" : "Suggested Examples:"}
                </span>
                <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript(
                        isBn
                          ? "মিরপুর ১০ গোলচত্বরে বাস ও সিএনজি সংঘর্ষ হয়েছে, দুজন আহত"
                          : "Bus and CNG collision near Mirpur 10 roundabout, two people injured"
                      );
                      setRawTranscript(
                        isBn
                          ? "মিরপুর ১০ গোলচত্বরে বাস ও সিএনজি সংঘর্ষ হয়েছে, দুজন আহত"
                          : "Bus and CNG collision near Mirpur 10 roundabout, two people injured"
                      );
                      setPhase("transcribed");
                    }}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-emerald-500 transition flex items-center gap-1"
                  >
                    <CarFront className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                    <span>{isBn ? "মিরপুরে বাস দুর্ঘটনা" : "Accident at Mirpur 10"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript(
                        isBn
                          ? "ঢাকা মেডিকেলে আমার রোগীর জরুরি ২ ব্যাগ O+ রক্ত লাগবে"
                          : "Need 2 bags of O+ blood tonight at Dhaka Medical College Hospital"
                      );
                      setRawTranscript(
                        isBn
                          ? "ঢাকা মেডিকেলে আমার রোগীর জরুরি ২ ব্যাগ O+ রক্ত লাগবে"
                          : "Need 2 bags of O+ blood tonight at Dhaka Medical College Hospital"
                      );
                      setPhase("transcribed");
                    }}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-rose-500 transition flex items-center gap-1"
                  >
                    <Droplet className="h-3 w-3 text-rose-500" aria-hidden="true" />
                    <span>{isBn ? "O+ রক্ত জরুরি" : "Need O+ Blood"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript(
                        isBn
                          ? "ধানমন্ডি ২৭ এ ট্রান্সফরমারে আগুন লেগেছে"
                          : "Transformer caught fire near Dhanmondi 27"
                      );
                      setRawTranscript(
                        isBn
                          ? "ধানমন্ডি ২৭ এ ট্রান্সফরমারে আগুন লেগেছে"
                          : "Transformer caught fire near Dhanmondi 27"
                      );
                      setPhase("transcribed");
                    }}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-amber-500 transition flex items-center gap-1"
                  >
                    <Flame className="h-3 w-3 text-amber-500" aria-hidden="true" />
                    <span>{isBn ? "ধানমন্ডিতে আগুন" : "Fire at Dhanmondi"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase: Recording in Progress */}
          {phase === "recording" && (
            <div className="text-center py-6 sm:py-8 space-y-5">
              <div className="relative inline-flex items-center justify-center">
                <span className="absolute h-24 w-24 rounded-full bg-red-500/20 animate-ping" />
                <button
                  type="button"
                  onClick={stopRecording}
                  className="relative h-20 w-20 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-xl shadow-red-600/40 flex items-center justify-center transition cursor-pointer"
                  aria-label="Stop recording speech"
                >
                  <Square className="h-8 w-8 text-white fill-white" aria-hidden="true" />
                </button>
              </div>

              {/* Timer & Pulsing Wave */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-mono text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                  <span>{formatTimer(recordingSeconds)}</span>
                  <span>•</span>
                  <span>{isBn ? "শুনছি..." : "Listening..."}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  {isBn
                    ? "কথা বলা শেষ হলে লাল বোতামে চাপ দিন"
                    : "Tap the red square when you are finished speaking"}
                </p>
              </div>

              {/* Live Speech Recognition Transcript Preview */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 min-h-[90px] text-left text-xs max-w-md mx-auto">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                  {isBn ? "লাইভ ট্রান্সক্রিপ্ট:" : "Live Transcription:"}
                </span>
                <p className="text-zinc-800 dark:text-zinc-200 italic">
                  {transcript || interimTranscript || (
                    <span className="text-zinc-400">
                      {isBn ? "আপনার কথা বলা শুরু করুন..." : "Start speaking now..."}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Phase: Transcribed (Review & Edit before AI processing) */}
          {phase === "transcribed" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Edit3 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <span>{isBn ? "ট্রান্সক্রিপ্ট যাচাই ও সংশোধন" : "Review & Edit Transcript"}</span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {isBn
                      ? "কোনো ভুল শব্দ থাকলে সম্পাদনা করুন, এরপর এআই দিয়ে বিশ্লেষণ করুন।"
                      : "Review the recognized text below. Edit any misheard words before processing."}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  {transcript.length}/4000
                </span>
              </div>

              {/* Editable Textarea */}
              <div className="relative">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder={
                    isBn
                      ? "আপনার জরুরি ঘটনার বিস্তারিত লিখুন..."
                      : "Describe your emergency incident here..."
                  }
                  className="w-full px-4 py-3 text-xs sm:text-sm rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Privacy Notice on transient processing */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-2.5 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>
                  {isBn
                    ? "গোপনীয়তা সুরক্ষা: অডিও ফাইল সার্ভারে সংরক্ষিত হয় না (Transient Processing)।"
                    : "Privacy Assurance: Voice audio is processed transiently; raw audio is not stored."}
                </span>
              </div>

              {/* Actions: Re-record / Cancel / Process */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetSession}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBn ? "পুনরায় বলুন" : "Re-record"}</span>
                </button>

                <button
                  type="button"
                  onClick={processVoiceIntake}
                  disabled={!transcript.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBn ? "এআই দিয়ে রিপোর্ট ড্রাফট করুন" : "Analyze & Draft Report"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Phase: Processing with AI */}
          {phase === "processing" && (
            <div className="text-center py-12 space-y-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {isBn ? "ভয়েস রিপোর্ট বিশ্লেষণ হচ্ছে..." : "Analyzing Voice Emergency..."}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {isBn
                    ? "ঘটনার বিভাগ, অবস্থান এবং প্রয়োজনীয় তথ্য আলাদা করা হচ্ছে..."
                    : "Extracting location, severity, incident category, and missing fields..."}
                </p>
              </div>
            </div>
          )}

          {/* Phase: Preview (Structured incident draft ready for confirmation) */}
          {phase === "preview" && intakeResponse && (
            <div className="space-y-4">
              {/* AI Reply Message & TTS Control */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isBn ? "এআই প্রতিক্রিয়া" : "AI Assessment"}</span>
                  </div>
                  {intakeResponse.speech_synthesis_hint && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isSpeakingTTS) {
                          stopTTS();
                        } else {
                          speakText(intakeResponse.speech_synthesis_hint || intakeResponse.reply);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline"
                    >
                      {isSpeakingTTS ? (
                        <>
                          <VolumeX className="h-3 w-3" aria-hidden="true" />
                          <span>{isBn ? "থামান" : "Stop Voice"}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3" aria-hidden="true" />
                          <span>{isBn ? "শুনুন" : "Listen"}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  {intakeResponse.reply}
                </p>
                {intakeResponse.follow_up_question && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="font-bold block">
                        {isBn ? "অতিরিক্ত তথ্যের প্রয়োজন:" : "Additional Information Needed:"}
                      </span>
                      <span>{intakeResponse.follow_up_question}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Draft Report Card (Incident) */}
              {intakeResponse.draft_report && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isBn ? "খসড়া রিপোর্ট প্রিভিউ" : "Draft Report Preview"}</span>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                      {intakeResponse.draft_report.category_name}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {intakeResponse.draft_report.title}
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3">
                      {intakeResponse.draft_report.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <MapPin className="h-3 w-3 text-red-500 shrink-0" aria-hidden="true" />
                      <span className="truncate">{intakeResponse.draft_report.location_text}</span>
                    </div>
                    {intakeResponse.draft_report.severity && (
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <HeartPulse className="h-3 w-3 text-amber-500 shrink-0" aria-hidden="true" />
                        <span>Severity: {intakeResponse.draft_report.severity}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Draft Blood Request Card */}
              {intakeResponse.draft_blood_request && (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1">
                      <Droplet className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                      <span>{isBn ? "রক্তের রিকুয়েস্ট ড্রাফট" : "Blood Request Draft"}</span>
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white">
                      {intakeResponse.draft_blood_request.blood_group} (
                      {intakeResponse.draft_blood_request.units_required} Bag)
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {intakeResponse.draft_blood_request.hospital_name}
                    </div>
                    <div className="text-zinc-500">
                      {intakeResponse.draft_blood_request.district} • Urgency:{" "}
                      {intakeResponse.draft_blood_request.urgency}
                    </div>
                  </div>
                </div>
              )}

              {/* Immediate Safety Action Plan */}
              {intakeResponse.action_plan_summary && intakeResponse.action_plan_summary.length > 0 && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 p-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 block">
                    {isBn ? "তাৎক্ষণিক করণীয়:" : "Immediate Action Plan:"}
                  </span>
                  <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                    {intakeResponse.action_plan_summary.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <Check className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons: Edit / Re-record / Confirm & Submit */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPhase("transcribed")}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition inline-flex items-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBn ? "ট্রান্সক্রিপ্ট সংশোধন" : "Edit Details"}</span>
                </button>

                <div className="flex items-center gap-2">
                  {onApplyDraft && intakeResponse.draft_report && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyDraft(intakeResponse.draft_report!);
                        handleModalClose();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition"
                    >
                      {isBn ? "ফর্মে পূরণ করুন" : "Apply to Form"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={confirmAndSubmit}
                    disabled={confirming}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {confirming ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{isBn ? "নিশ্চিত করে দাখিল করুন" : "Confirm & Submit"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase: Confirmed (Verified Report in DB) */}
          {phase === "confirmed" && confirmationResult && (
            <div className="text-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  {isBn ? "রিপোর্ট সফলভাবে দাখিল হয়েছে" : "Emergency Report Submitted"}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {confirmationResult.message}
                </p>
                <div className="text-[11px] font-mono text-zinc-400 pt-1">
                  Record ID: {confirmationResult.record_id}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-4">
                {confirmationResult.redirect_url && (
                  <Link
                    href={confirmationResult.redirect_url}
                    onClick={handleModalClose}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center gap-1.5"
                  >
                    <span>{isBn ? "রিপোর্ট দেখুন" : "View Report"}</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-200 transition"
                >
                  {isBn ? "বন্ধ করুন" : "Close"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status Footer */}
        <div className="px-5 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                phase === "recording"
                  ? "bg-red-500 animate-pulse"
                  : isSpeechSupported()
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }`}
            />
            <span>
              {phase === "recording"
                ? isBn
                  ? "মাইক্রোফোন সক্রিয়"
                  : "Microphone Active"
                : isSpeechSupported()
                ? isBn
                  ? "ভয়েস ইঞ্জিন প্রস্তুত"
                  : "Voice Engine Ready"
                : isBn
                  ? "টাইপিং মোড সক্রিয়"
                  : "Fallback Mode"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            <span>Lang: {isBn ? "বাংলা (bn-BD)" : "English (en-US)"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
