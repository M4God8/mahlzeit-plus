import { useState, useRef, useEffect } from "react";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library";

export default function KameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, 300);
    addLog("Reader erstellt (hints: TRY_HARDER + EAN_13/8/CODE_128/UPC_A/E, interval: 300ms)");

    let cancelled = false;

    async function start() {
      addLog("decodeFromConstraints wird aufgerufen...");
      try {
        await reader.decodeFromConstraints(
          { video: { facingMode: "environment" }, audio: false },
          video,
          (res, err) => {
            if (cancelled) return;
            if (res) {
              const text = res.getText();
              const format = res.getBarcodeFormat?.()?.toString() ?? "?";
              addLog(`✅ ERKANNT: ${text} (Format: ${format})`);
              setResult(text);
            } else if (err) {
              const name = (err as any)?.constructor?.name ?? "Unknown";
              if (name === "NotFoundException") {
                // normal — kein Barcode im Frame
              } else {
                addLog(`⚠️ Decode-Fehler: ${name}: ${(err as any)?.message ?? ""}`);
              }
            }
          }
        );
        addLog("decodeFromConstraints Promise resolved — Decode-Loop läuft");

        const stream = video.srcObject as MediaStream;
        if (stream) {
          const track = stream.getVideoTracks()[0];
          const settings = track?.getSettings?.();
          addLog(`Kamera: ${settings?.width}x${settings?.height}, ${settings?.facingMode ?? "?"}, FPS: ${settings?.frameRate ?? "?"}`);
        } else {
          addLog("⚠️ video.srcObject ist null nach decodeFromConstraints!");
        }
      } catch (e: any) {
        addLog(`❌ FEHLER: ${e?.name ?? "?"}: ${e?.message ?? String(e)}`);
      }
    }

    start();

    return () => {
      cancelled = true;
      reader.reset();
    };
  }, []);

  return (
    <div style={{ padding: "16px", fontFamily: "monospace", fontSize: "13px" }}>
      <h2 style={{ margin: "0 0 12px" }}>Kamera-Test (isoliert)</h2>

      <video
        ref={videoRef}
        style={{ width: "100%", maxWidth: "400px", borderRadius: "12px", background: "#000" }}
        playsInline
        muted
        autoPlay
      />

      {result && (
        <div style={{ marginTop: "12px", padding: "12px", background: "#d4edda", borderRadius: "8px", fontWeight: "bold", fontSize: "18px" }}>
          Erkannt: {result}
        </div>
      )}

      <div style={{ marginTop: "12px", maxHeight: "300px", overflow: "auto", background: "#f5f5f5", padding: "8px", borderRadius: "8px" }}>
        {logs.map((l, i) => (
          <div key={i} style={{ borderBottom: "1px solid #eee", padding: "2px 0", whiteSpace: "pre-wrap" }}>
            {l}
          </div>
        ))}
        {logs.length === 0 && <div style={{ color: "#999" }}>Warte auf Logs...</div>}
      </div>
    </div>
  );
}
