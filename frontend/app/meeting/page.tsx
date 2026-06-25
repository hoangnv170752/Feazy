"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyFace, searchFace, registerFace, canvasToBlob, type SearchResult, type VerifyResult } from "../lib/api";

type CameraStatus = "idle" | "requesting" | "granted" | "denied" | "error";

interface DetectionResult {
  type: "verify" | "search" | "register";
  timestamp: Date;
  data: VerifyResult | SearchResult[] | { success: boolean; message: string };
}

export default function MeetingPage() {
  const searchParams = useSearchParams();
  const verifyPersonId = searchParams.get("verify");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
  const [activeTab, setActiveTab] = useState<"verify" | "search" | "register">(verifyPersonId ? "verify" : "search");
  const [personIdInput, setPersonIdInput] = useState(verifyPersonId || "");
  const [registerLabel, setRegisterLabel] = useState("");
  const [autoDetect, setAutoDetect] = useState(false);
  const autoDetectRef = useRef(false);

  // Request camera permission
  const requestCamera = useCallback(async () => {
    setCameraStatus("requesting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus("granted");
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setCameraStatus("denied");
          setError("Bạn đã từ chối quyền truy cập camera. Vui lòng cho phép trong cài đặt trình duyệt.");
        } else {
          setCameraStatus("error");
          setError(`Lỗi camera: ${err.message}`);
        }
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Auto request camera on mount
  useEffect(() => {
    requestCamera();
  }, [requestCamera]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle mic
  const toggleMic = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, []);

  // Capture frame from video
  const captureFrame = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current) {
        resolve(null);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(null);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      canvasToBlob(canvas).then(resolve).catch(() => resolve(null));
    });
  }, []);

  // Verify face
  const handleVerify = useCallback(async () => {
    if (!personIdInput.trim()) {
      setError("Vui lòng nhập Person ID");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blob = await captureFrame();
      if (!blob) {
        setError("Không thể chụp ảnh từ camera");
        return;
      }

      const result = await verifyFace(blob, personIdInput.trim());
      setDetectionResults((prev) => [
        { type: "verify", timestamp: new Date(), data: result },
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực thất bại");
    } finally {
      setIsProcessing(false);
    }
  }, [personIdInput, captureFrame]);

  // Search face
  const handleSearch = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const blob = await captureFrame();
      if (!blob) {
        setError("Không thể chụp ảnh từ camera");
        return;
      }

      const results = await searchFace(blob, 5);
      setDetectionResults((prev) => [
        { type: "search", timestamp: new Date(), data: results },
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tìm kiếm thất bại");
    } finally {
      setIsProcessing(false);
    }
  }, [captureFrame]);

  // Register face from camera
  const handleRegister = useCallback(async () => {
    if (!personIdInput.trim()) {
      setError("Vui lòng nhập Person ID");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blob = await captureFrame();
      if (!blob) {
        setError("Không thể chụp ảnh từ camera");
        return;
      }

      await registerFace(blob, personIdInput.trim(), registerLabel || undefined);
      setDetectionResults((prev) => [
        {
          type: "register",
          timestamp: new Date(),
          data: { success: true, message: `Đã đăng ký ${registerLabel || personIdInput}` },
        },
        ...prev.slice(0, 9),
      ]);
      setPersonIdInput("");
      setRegisterLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setIsProcessing(false);
    }
  }, [personIdInput, registerLabel, captureFrame]);

  // Auto detect interval
  useEffect(() => {
    autoDetectRef.current = autoDetect;
  }, [autoDetect]);

  useEffect(() => {
    if (!autoDetect || cameraStatus !== "granted") return;

    const interval = setInterval(() => {
      if (autoDetectRef.current && !isProcessing) {
        if (activeTab === "verify" && personIdInput) {
          handleVerify();
        } else if (activeTab === "search") {
          handleSearch();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [autoDetect, cameraStatus, activeTab, personIdInput, isProcessing, handleVerify, handleSearch]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col" data-theme="dark">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800">
        <div className="flex items-center gap-2">
          <Link href="/" className="btn btn-ghost btn-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <span className="text-white font-medium">Feazy Meet</span>
        </div>
        <div className="text-gray-400 text-sm" suppressHydrationWarning>
          {new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
        {/* Video area */}
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 bg-gray-800 rounded-xl overflow-hidden min-h-[400px]">
            {cameraStatus === "idle" || cameraStatus === "requesting" ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <p className="text-gray-400 mt-4">Đang yêu cầu quyền truy cập camera...</p>
                </div>
              </div>
            ) : cameraStatus === "denied" || cameraStatus === "error" ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-md px-4">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                    </svg>
                  </div>
                  <h3 className="text-white text-lg font-medium mb-2">Không thể truy cập camera</h3>
                  <p className="text-gray-400 text-sm mb-4">{error}</p>
                  <button className="btn btn-primary" onClick={requestCamera}>
                    Thử lại
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`} />
                {!isCameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="avatar placeholder">
                      <div className="bg-neutral text-neutral-content rounded-full w-24">
                        <span className="text-3xl">U</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Processing overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                      <p className="text-white mt-2">Đang xử lý...</p>
                    </div>
                  </div>
                )}

                {/* Face detection indicator */}
                {autoDetect && (
                  <div className="absolute top-4 left-4 badge badge-primary gap-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    Auto Detect
                  </div>
                )}
              </>
            )}

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Control bar */}
          <div className="flex items-center justify-center gap-4 py-4">
            <button className={`btn btn-circle ${isMicOn ? "btn-neutral" : "btn-error"}`} onClick={toggleMic} disabled={cameraStatus !== "granted"}>
              {isMicOn ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
            </button>

            <button className={`btn btn-circle ${isCameraOn ? "btn-neutral" : "btn-error"}`} onClick={toggleCamera} disabled={cameraStatus !== "granted"}>
              {isCameraOn ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              )}
            </button>

            <Link href="/" className="btn btn-circle btn-error">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-96 bg-gray-800 rounded-xl p-4 flex flex-col">
          {/* Tabs */}
          <div className="tabs tabs-boxed bg-gray-700 mb-4">
            <a className={`tab ${activeTab === "verify" ? "tab-active" : ""}`} onClick={() => setActiveTab("verify")}>
              Xác thực
            </a>
            <a className={`tab ${activeTab === "search" ? "tab-active" : ""}`} onClick={() => setActiveTab("search")}>
              Tìm kiếm
            </a>
            <a className={`tab ${activeTab === "register" ? "tab-active" : ""}`} onClick={() => setActiveTab("register")}>
              Đăng ký
            </a>
          </div>

          {/* Tab content */}
          <div className="flex-1 flex flex-col">
            {error && (
              <div className="alert alert-error mb-4 py-2">
                <span className="text-sm">{error}</span>
              </div>
            )}

            {activeTab === "verify" && (
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-gray-300">Person ID</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập Person ID để xác thực"
                    className="input input-bordered bg-gray-700"
                    value={personIdInput}
                    onChange={(e) => setPersonIdInput(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary w-full" onClick={handleVerify} disabled={isProcessing || cameraStatus !== "granted" || !personIdInput}>
                  {isProcessing ? <span className="loading loading-spinner loading-sm"></span> : "Xác thực khuôn mặt"}
                </button>
              </div>
            )}

            {activeTab === "search" && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">Tìm kiếm khuôn mặt trong database. Hệ thống sẽ trả về những người giống nhất.</p>
                <button className="btn btn-primary w-full" onClick={handleSearch} disabled={isProcessing || cameraStatus !== "granted"}>
                  {isProcessing ? <span className="loading loading-spinner loading-sm"></span> : "Tìm kiếm khuôn mặt"}
                </button>
              </div>
            )}

            {activeTab === "register" && (
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-gray-300">Person ID *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: user_123"
                    className="input input-bordered bg-gray-700"
                    value={personIdInput}
                    onChange={(e) => setPersonIdInput(e.target.value)}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-gray-300">Tên hiển thị</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    className="input input-bordered bg-gray-700"
                    value={registerLabel}
                    onChange={(e) => setRegisterLabel(e.target.value)}
                  />
                </div>
                <button className="btn btn-success w-full" onClick={handleRegister} disabled={isProcessing || cameraStatus !== "granted" || !personIdInput}>
                  {isProcessing ? <span className="loading loading-spinner loading-sm"></span> : "Đăng ký từ camera"}
                </button>
              </div>
            )}

            {/* Auto detect toggle */}
            {(activeTab === "verify" || activeTab === "search") && (
              <div className="form-control mt-4">
                <label className="label cursor-pointer">
                  <span className="label-text text-gray-300">Tự động phát hiện (mỗi 3s)</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={autoDetect}
                    onChange={(e) => setAutoDetect(e.target.checked)}
                    disabled={cameraStatus !== "granted"}
                  />
                </label>
              </div>
            )}

            {/* Results */}
            <div className="divider text-gray-500">Kết quả</div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {detectionResults.length === 0 ? (
                <p className="text-gray-500 text-center text-sm">Chưa có kết quả</p>
              ) : (
                detectionResults.map((result, idx) => (
                  <div key={idx} className={`card bg-gray-700 p-3 ${idx === 0 ? "ring-2 ring-primary" : ""}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${result.type === "verify" ? "badge-info" : result.type === "search" ? "badge-warning" : "badge-success"}`}>
                        {result.type === "verify" ? "Xác thực" : result.type === "search" ? "Tìm kiếm" : "Đăng ký"}
                      </span>
                      <span className="text-xs text-gray-400">{result.timestamp.toLocaleTimeString("vi-VN")}</span>
                    </div>

                    {result.type === "verify" && (
                      <div>
                        {(result.data as VerifyResult).verified ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Xác thực thành công!</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Không khớp</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Distance: {(result.data as VerifyResult).distance.toFixed(3)} (threshold: {(result.data as VerifyResult).threshold})
                        </p>
                      </div>
                    )}

                    {result.type === "search" && (
                      <div className="space-y-1">
                        {(result.data as SearchResult[]).length === 0 ? (
                          <p className="text-gray-400 text-sm">Không tìm thấy kết quả</p>
                        ) : (
                          (result.data as SearchResult[]).map((r, i) => (
                            <div key={i} className={`flex items-center justify-between text-sm ${r.verified ? "text-green-400" : "text-gray-300"}`}>
                              <span>{r.label || r.person_id}</span>
                              <span className="text-xs">{(1 - r.distance).toFixed(1)}% match</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {result.type === "register" && (
                      <p className="text-green-400 text-sm">{(result.data as { message: string }).message}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
