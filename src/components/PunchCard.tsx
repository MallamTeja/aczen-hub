import { useEffect, useRef, useState } from "react";
import { useUser } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Clock, LogIn, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateVerificationCode(length = 5) {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * CODE_CHARS.length);
    result += CODE_CHARS[index];
  }
  return result;
}

export default function PunchCard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<"IN" | "OUT" | null>(null);
  const [lastPunchTime, setLastPunchTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState(() => generateVerificationCode());
  const [verificationInput, setVerificationInput] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (user) fetchLastPunch();
  }, [user]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      stopCameraStream();
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const videoEl = videoRef.current;
    videoEl.srcObject = streamRef.current;

    const handleLoadedData = async () => {
      try {
        await videoEl.play();
        setCameraReady(true);
      } catch {
        setCameraError("Camera opened but preview could not start.");
        stopCameraStream();
      }
    };

    videoEl.addEventListener("loadeddata", handleLoadedData);
    return () => {
      videoEl.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [cameraActive]);

  async function fetchLastPunch() {
    const { data } = await supabase
      .from("punches")
      .select("*")
      .eq("clerk_user_id", user!.id)
      .order("timestamp", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setCurrentStatus(data[0].status as "IN" | "OUT");
      setLastPunchTime(data[0].timestamp);
    }
  }

  async function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported in this browser.");
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => reject(new Error("Location permission denied.")),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraReady(false);
  }

  async function startLiveCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported in this browser.");
      return;
    }

    try {
      setCameraError(null);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
      } catch {
        // Fallback for browsers/devices that don't support facingMode well.
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setCameraError("Unable to access camera. Please allow camera permission.");
    }
  }

  async function captureSnapshot() {
    if (!videoRef.current || !canvasRef.current) return;
    if (!cameraReady) {
      setCameraError("Camera is still loading. Please wait a second and try again.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;

      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      setPhotoPreviewUrl(URL.createObjectURL(blob));
      stopCameraStream();
    }, "image/jpeg", 0.9);
  }

  async function handlePunch() {
    if (!user) return;
    if (verificationInput !== verificationCode) {
      toast({
        title: "Invalid code",
        description: "Enter the exact verification code shown above.",
        variant: "destructive",
      });
      return;
    }

    if (!photoPreviewUrl) {
      if (!cameraActive) {
        await startLiveCamera();
      }
      toast({
        title: "Photo required",
        description: "Take a live camera snapshot before punching in or out.",
      });
      return;
    }

    setLoading(true);
    const newStatus = currentStatus === "IN" ? "OUT" : "IN";
    let coords: { latitude: number; longitude: number };

    try {
      coords = await getCurrentPosition();
    } catch (error) {
      setLoading(false);
      toast({
        title: "Location required",
        description: error instanceof Error ? error.message : "Unable to capture location.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("punches").insert({
      clerk_user_id: user.id,
      status: newStatus,
      verification_code: verificationCode,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to punch. Try again.", variant: "destructive" });
    } else {
      setCurrentStatus(newStatus);
      setLastPunchTime(new Date().toISOString());
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      setPhotoPreviewUrl(null);
      setCameraError(null);
      setVerificationCode(generateVerificationCode());
      setVerificationInput("");
      toast({ title: `Punched ${newStatus}`, description: `You have successfully punched ${newStatus.toLowerCase()}.` });
    }
    setLoading(false);
  }

  const isIn = currentStatus === "IN";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Punch In / Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${isIn ? "bg-success animate-pulse-gentle" : "bg-muted-foreground/30"}`} />
          <span className="text-sm font-medium">
            {currentStatus === null ? "No punches today" : isIn ? "Currently Punched In" : "Currently Punched Out"}
          </span>
        </div>

        {lastPunchTime && (
          <p className="text-xs text-muted-foreground">
            Last punch: {new Date(lastPunchTime).toLocaleString()}
          </p>
        )}

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verification Code</p>
              <p className="font-mono text-lg font-semibold">{verificationCode}</p>
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setVerificationCode(generateVerificationCode())}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Input
            value={verificationInput}
            onChange={(event) => {
              const sanitized = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
              setVerificationInput(sanitized);
            }}
            placeholder="Enter verification code"
            className="font-mono uppercase"
          />

          <canvas ref={canvasRef} className="hidden" />

          {cameraActive ? (
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline muted className="h-40 w-full rounded-md object-cover bg-black" />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/55 text-xs text-white">
                  Starting camera...
                </div>
              )}
            </div>
          ) : photoPreviewUrl ? (
            <img src={photoPreviewUrl} alt="Punch verification" className="h-40 w-full rounded-md object-cover" />
          ) : (
            <div className="flex h-40 w-full flex-col items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
              <Camera className="mb-2 h-5 w-5" />
              <p className="text-xs">No photo captured yet</p>
            </div>
          )}

          {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}

          {!cameraActive && (
            <Button type="button" variant="outline" className="w-full" onClick={startLiveCamera}>
              <Camera className="mr-2 h-4 w-4" />
              {photoPreviewUrl ? "Open Camera to Retake" : "Open Live Camera"}
            </Button>
          )}

          {cameraActive && (
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={captureSnapshot}>
                <Camera className="mr-2 h-4 w-4" />
                Take Snapshot
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={stopCameraStream}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        <Button
          onClick={handlePunch}
          disabled={loading}
          className="w-full"
          variant={isIn ? "destructive" : "default"}
        >
          {isIn ? <LogOut className="h-4 w-4 mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
          {loading ? "Processing..." : isIn ? "Punch Out" : "Punch In"}
        </Button>
      </CardContent>
    </Card>
  );
}
