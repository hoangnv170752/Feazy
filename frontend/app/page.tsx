"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { checkHealth, registerFace, listFaces, deleteFacesByPerson, canvasToBlob, type FaceRecord } from "./lib/api";
import { useI18n, type Locale } from "./lib/i18n";

type CameraStatus = "idle" | "requesting" | "granted" | "denied" | "error";

export default function Home() {
  const { t, locale, setLocale } = useI18n();
  const [meetingCode, setMeetingCode] = useState("");
  const [now, setNow] = useState<Date>(() => new Date());
  const [showRegister, setShowRegister] = useState(false);
  const [personId, setPersonId] = useState("");
  const [label, setLabel] = useState("");
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredFaces, setRegisteredFaces] = useState<FaceRecord[]>([]);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);

  // Camera states
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    checkHealth()
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));

    listFaces(10)
      .then(setRegisteredFaces)
      .catch(() => {});
  }, []);

  // Start camera when modal opens
  const startCamera = useCallback(async () => {
    setCameraStatus("requesting");
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      setCameraStatus("granted");
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setCameraStatus("denied");
          setCameraError(t("register.errorCameraDenied"));
        } else {
          setCameraStatus("error");
          setCameraError(t("register.errorCamera", { message: err.message }));
        }
      }
    }
  }, [t]);

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (cameraStatus === "granted" && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch(console.error);
      };
    }
  }, [cameraStatus, capturedImage]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraStatus("idle");
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const blob = await canvasToBlob(canvas);
      setCapturedImage(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setMessage({ type: "error", text: "Không thể chụp ảnh" });
    }
  }, []);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  // Open register modal
  const openRegister = useCallback(() => {
    setShowRegister(true);
    setMessage(null);
    setCapturedImage(null);
    setPreviewUrl(null);
    setPersonId("");
    setLabel("");
    startCamera();
  }, [startCamera]);

  // Close register modal
  const closeRegister = useCallback(() => {
    setShowRegister(false);
    stopCamera();
    setCapturedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setMessage(null);
  }, [stopCamera, previewUrl]);

  const handleRegister = async () => {
    if (!capturedImage || !personId) {
      setMessage({ type: "error", text: t("register.errorNoCapture") });
      return;
    }

    setIsRegistering(true);
    setMessage(null);

    try {
      const result = await registerFace(capturedImage, personId, label || undefined);
      setMessage({ type: "success", text: t("register.successMsg", { confidence: (result.confidence * 100).toFixed(1) }) });
      setRegisteredFaces((prev) => [result, ...prev].slice(0, 10));
      setCapturedImage(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPersonId("");
      setLabel("");
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t("register.errorFallback") });
    } finally {
      setIsRegistering(false);
    }
  };

  // Delete face by person_id
  const handleDelete = async (personId: string) => {
    if (!confirm(`${t("sidebar.registered")}: "${personId}"?`)) return;

    setDeletingPersonId(personId);
    try {
      await deleteFacesByPerson(personId);
      setRegisteredFaces((prev) => prev.filter((f) => f.person_id !== personId));
    } catch (err) {
      alert(err instanceof Error ? err.message : t("register.errorFallback"));
    } finally {
      setDeletingPersonId(null);
    }
  };

  return (
    <div className="min-h-screen bg-base-100" data-theme="light">
      {/* Header */}
      <header className="navbar px-4 lg:px-8 border-b border-base-200">
        <div className="navbar-start">
          <button className="btn btn-ghost btn-square">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-2">
            <svg className="w-10 h-10 text-primary" viewBox="0 0 36 36" fill="currentColor">
              <path d="M18 9l-9 5.25v7.5L18 27l9-5.25v-7.5L18 9z" fill="#00897B" />
              <path d="M27 14.25L18 9v18l9-5.25v-7.5z" fill="#00695C" />
              <path d="M18 9l-9 5.25L18 19.5l9-5.25L18 9z" fill="#4DD0E1" />
            </svg>
            <span className="text-xl text-gray-600 font-normal">Feazy Meet</span>
          </div>
        </div>
        <div className="navbar-end gap-2">
          {/* Language switcher */}
          <div className="join">
            <button
              className={`join-item btn btn-xs ${locale === "vi" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setLocale("vi" as Locale)}
            >
              VI
            </button>
            <button
              className={`join-item btn btn-xs ${locale === "en" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setLocale("en" as Locale)}
            >
              EN
            </button>
          </div>
          <div className={`badge ${apiStatus === "online" ? "badge-success" : apiStatus === "offline" ? "badge-error" : "badge-warning"} gap-1`}>
            <span className={`w-2 h-2 rounded-full ${apiStatus === "online" ? "bg-green-500" : apiStatus === "offline" ? "bg-red-500" : "bg-yellow-500"}`}></span>
            API {apiStatus === "online" ? t("header.apiOnline") : apiStatus === "offline" ? t("header.apiOffline") : t("header.apiChecking")}
          </div>
          <span className="text-sm text-gray-600 hidden sm:inline" suppressHydrationWarning>
            {now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            {` • ${now.toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric" })}`}
          </span>
          <div className="avatar placeholder">
            <div className="bg-primary text-primary-content rounded-full w-8">
              <span className="text-sm">U</span>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar + Main Content */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 p-4 border-r border-base-200 min-h-[calc(100vh-64px)]">
          <ul className="menu">
            <li>
              <a className="active bg-primary/10 text-primary font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t("nav.meetings")}
              </a>
            </li>
            <li>
              <a className="text-gray-600 cursor-pointer" onClick={openRegister}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t("nav.registerFace")}
              </a>
            </li>
          </ul>

          {/* Registered faces preview */}
          {registeredFaces.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-500 mb-2">{t("sidebar.registered")}</h4>
              <div className="space-y-2">
                {registeredFaces.slice(0, 5).map((face) => (
                  <div key={face.id} className="flex items-center gap-2 text-sm group">
                    <div className="avatar placeholder">
                      <div className="bg-neutral text-neutral-content rounded-full w-6">
                        <span className="text-xs">{(face.label || face.person_id)[0].toUpperCase()}</span>
                      </div>
                    </div>
                    <span className="truncate flex-1">{face.label || face.person_id}</span>
                    <button
                      className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 text-error"
                      onClick={() => handleDelete(face.person_id)}
                      disabled={deletingPersonId === face.person_id}
                    >
                      {deletingPersonId === face.person_id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          {/* Hero Section */}
          <div className="max-w-4xl w-full text-center mb-8">
            <h1 className="text-4xl lg:text-5xl font-normal text-gray-800 mb-4 leading-tight">
              {t("hero.title1")}
              <br />
              {t("hero.title2")}
            </h1>
            <p className="text-lg text-gray-600 mb-8">{t("hero.subtitle")}</p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <div className="dropdown dropdown-bottom">
                <button tabIndex={0} className="btn btn-primary gap-2 rounded-full px-6">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t("actions.newMeeting")}
                </button>
                <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-10 w-64 p-2 shadow-lg mt-2">
                  <li>
                    <Link href="/meeting">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t("actions.startWithFace")}
                    </Link>
                  </li>
                  <li>
                    <a onClick={openRegister} className="cursor-pointer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      {t("actions.registerFirst")}
                    </a>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2">
                <div className="join border border-base-300 rounded-full">
                  <span className="join-item flex items-center pl-4 bg-base-100">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder={t("actions.personIdPlaceholder")}
                    className="input join-item bg-base-100 focus:outline-none w-56"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                  />
                </div>
                <Link href={meetingCode ? `/meeting?verify=${encodeURIComponent(meetingCode)}` : "#"} className={`btn btn-ghost ${meetingCode ? "text-primary" : "text-gray-400 pointer-events-none"}`}>
                  {t("actions.join")}
                </Link>
              </div>
            </div>

            <div className="divider max-w-xl mx-auto"></div>
          </div>

          {/* Feature Cards */}
          <div className="max-w-4xl w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card bg-base-100 shadow-md">
                <div className="card-body items-center text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-medium">Video Call</h3>
                  <p className="text-sm text-gray-500">{t("features.videoCallDesc")}</p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-md">
                <div className="card-body items-center text-center">
                  <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="font-medium">Face Verification</h3>
                  <p className="text-sm text-gray-500">{t("features.faceVerifyDesc")}</p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-md">
                <div className="card-body items-center text-center">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="font-medium">Face Search</h3>
                  <p className="text-sm text-gray-500">{t("features.faceSearchDesc")}</p>
                </div>
              </div>
            </div>

            {/* Learn more link */}
            <div className="text-center mt-8">
              <a href="#" className="link link-hover text-gray-600 text-sm">
                {t("learnMore")}
              </a>{" "}
              <span className="text-gray-600 text-sm">{t("learnMoreAbout")}</span>
            </div>
          </div>
        </main>
      </div>

      {/* Register Face Modal with Camera */}
      {showRegister && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{t("register.title")}</h2>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={closeRegister}>
                ✕
              </button>
            </div>

            {message && (
              <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"} py-2 mb-4`}>
                <span>{message.text}</span>
              </div>
            )}

            {/* Camera / Preview area */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video mb-4">
              {cameraStatus === "requesting" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <span className="loading loading-spinner loading-lg"></span>
                    <p className="mt-2">{t("register.requesting")}</p>
                  </div>
                </div>
              )}

              {(cameraStatus === "denied" || cameraStatus === "error") && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white p-4">
                    <svg className="w-12 h-12 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p>{cameraError}</p>
                    <button className="btn btn-sm btn-primary mt-2" onClick={startCamera}>
                      {t("register.retry")}
                    </button>
                  </div>
                </div>
              )}

              {/* Video element - always rendered but hidden when not needed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraStatus === "granted" && !capturedImage ? "" : "hidden"}`}
              />

              {previewUrl && (
                <img src={previewUrl} alt="Captured" className="w-full h-full object-cover" />
              )}

              {/* Hidden canvas */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Capture / Retake buttons */}
            <div className="flex justify-center gap-2 mb-4">
              {cameraStatus === "granted" && !capturedImage && (
                <button className="btn btn-primary gap-2" onClick={capturePhoto}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t("register.capture")}
                </button>
              )}

              {capturedImage && (
                <button className="btn btn-outline gap-2" onClick={retakePhoto}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t("register.retake")}
                </button>
              )}
            </div>

            {/* Form fields */}
            <div className="space-y-3">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text">{t("register.personId")}</span>
                </label>
                <input
                  type="text"
                  placeholder={t("register.personIdPlaceholder")}
                  className="input input-bordered"
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text">{t("register.displayName")}</span>
                </label>
                <input
                  type="text"
                  placeholder={t("register.displayNamePlaceholder")}
                  className="input input-bordered"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeRegister}>
                {t("register.cancel")}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRegister}
                disabled={isRegistering || !capturedImage || !personId}
              >
                {isRegistering ? <span className="loading loading-spinner loading-sm"></span> : t("register.submit")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeRegister}></div>
        </div>
      )}
    </div>
  );
}
