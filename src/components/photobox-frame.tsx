"use client";

import { forwardRef } from "react";
import CourtIcon from "./court-icon";

export const FRAME_IDS = ["maya", "zasar", "plaid", "sticker"] as const;
export type FrameId = (typeof FRAME_IDS)[number];
export const CUSTOM_FRAME_IDS = ["custom1", "custom2", "custom3", "custom4"] as const;
export type CustomFrameId = (typeof CUSTOM_FRAME_IDS)[number];
export type AnyFrameId = FrameId | CustomFrameId;

export const FRAME_LABELS: Record<FrameId, string> = {
  maya: "Neon Court",
  zasar: "Emas Klasik",
  plaid: "Polaroid",
  sticker: "Sticker Pop",
};

interface PhotoboxFrameProps {
  frameId: AnyFrameId;
  photo: string | null;
  title: string;
  dateLabel: string;
  pbName: string;
  customFrame?: string | null;
  pan?: { x: number; y: number };
  zoom?: number;
}

const W = 640;
const H = 640;

export const PhotoboxFrame = forwardRef<HTMLDivElement, PhotoboxFrameProps>(function PhotoboxFrame(
  { frameId, photo, title, dateLabel, pbName, customFrame, pan = { x: 0, y: 0 }, zoom = 1.2 },
  ref
) {
  const p = pan || { x: 0, y: 0 };
  const z = zoom || 1.2;

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `translate(${p.x}px, ${p.y}px) scale(${z})`,
  };

  const base: React.CSSProperties = {
    width: W,
    height: H,
    position: "relative",
    overflow: "hidden",
    fontFamily: "system-ui, sans-serif",
    background: "#0b0f1a",
  };

  const isCustom = CUSTOM_FRAME_IDS.includes(frameId as CustomFrameId);

  return (
    <div ref={ref} style={base} className="photobox-frame">
      {isCustom ? (
        <CustomFrameLayer photo={photo} customFrame={customFrame} imgStyle={imgStyle} title={title} />
      ) : frameId === "maya" ? (
        <MayaFrame photo={photo} title={title} dateLabel={dateLabel} pbName={pbName} imgStyle={imgStyle} />
      ) : frameId === "zasar" ? (
        <ZasarFrame photo={photo} title={title} dateLabel={dateLabel} pbName={pbName} imgStyle={imgStyle} />
      ) : frameId === "plaid" ? (
        <PlaidFrame photo={photo} title={title} dateLabel={dateLabel} pbName={pbName} imgStyle={imgStyle} />
      ) : (
        <StickerFrame photo={photo} title={title} dateLabel={dateLabel} pbName={pbName} imgStyle={imgStyle} />
      )}
    </div>
  );
});

function CustomFrameLayer({ photo, customFrame, imgStyle, title }: { photo: string | null; customFrame?: string | null; imgStyle: React.CSSProperties; title: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {photo ? (
        <img src={photo} alt="Foto mabar" draggable={false} style={imgStyle} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#1a2030", color: "#667" }}>
          <span style={{ fontSize: 28 }}>📷</span>
        </div>
      )}
      {customFrame && (
        <img
          src={customFrame}
          alt={title}
          draggable={false}
          style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "fill", pointerEvents: "none" }}
        />
      )}
    </div>
  );
}

function PhotoWindow({ photo, windowStyle, imgStyle }: { photo: string | null; windowStyle: React.CSSProperties; imgStyle: React.CSSProperties }) {
  return (
    <div style={windowStyle} className="rounded-xl">
      {photo ? (
        <img src={photo} alt="Foto mabar" draggable={false} style={imgStyle} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#1a2030", color: "#667" }}>
          <span style={{ fontSize: 28 }}>📷</span>
        </div>
      )}
    </div>
  );
}

function Header({ title, dateLabel, pbName }: { title: string; dateLabel: string; pbName: string }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 6, textAlign: "center", zIndex: 5 }}>
      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 12, textTransform: "uppercase", color: "#fff" }}>MABAR</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#c9d4e8", marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 15, color: "#8b96ad", marginTop: 4 }}>
        {dateLabel} · {pbName}
      </div>
    </div>
  );
}

function Footer({ pbName }: { pbName: string }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", padding: "16px 0", zIndex: 5 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#c9d4e8", fontSize: 18, fontWeight: 600 }}>
        <CourtIcon size={22} color="#7dd3fc" />
        {pbName}
      </div>
    </div>
  );
}

function MayaFrame({ photo, title, dateLabel, pbName, imgStyle }: { photo: string | null; title: string; dateLabel: string; pbName: string; imgStyle: React.CSSProperties }) {
  const bg: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 45%,#0f172a 100%)",
  };
  const glow: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.25), transparent 45%), radial-gradient(circle at 80% 75%, rgba(168,85,247,0.3), transparent 45%)",
  };
  const borderStyle: React.CSSProperties = {
    position: "absolute",
    left: 20,
    right: 20,
    top: 70,
    bottom: 60,
    border: "8px solid rgba(34,211,238,0.8)",
    borderRadius: 28,
    boxShadow: "0 0 40px rgba(34,211,238,0.5), inset 0 0 40px rgba(34,211,238,0.2)",
  };
  return (
    <>
      <div style={bg} />
      <div style={glow} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 2px, transparent 2px)", backgroundSize: "28px 28px" }} />
      <div style={borderStyle} />
      <div style={{ position: "absolute", left: 40, top: 100, right: 40, bottom: 110 }}>
        <PhotoWindow photo={photo} windowStyle={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 16, border: "4px solid rgba(255,255,255,0.2)" }} imgStyle={imgStyle} />
      </div>
      <Header title={title} dateLabel={dateLabel} pbName={pbName} />
      <Footer pbName={pbName} />
      <div style={{ position: "absolute", left: 30, bottom: 80, fontSize: 56 }}>🏸</div>
      <div style={{ position: "absolute", right: 30, top: 75, fontSize: 44 }}>🏸</div>
    </>
  );
}

function ZasarFrame({ photo, title, dateLabel, pbName, imgStyle }: { photo: string | null; title: string; dateLabel: string; pbName: string; imgStyle: React.CSSProperties }) {
  const bg: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(160deg,#3f2d20 0%,#7a4a2a 50%,#3f2d20 100%)",
  };
  const innerBorder: React.CSSProperties = {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    bottom: 16,
    border: "12px solid #f5d78e",
    borderRadius: 14,
  };
  return (
    <>
      <div style={bg} />
      <div style={innerBorder} />
      <div style={{ position: "absolute", left: 36, right: 36, top: 36, bottom: 36, border: "4px solid rgba(245,215,142,0.6)", borderRadius: 8 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 26, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#2b1c12", color: "#f5d78e", fontSize: 32, fontWeight: 900, letterSpacing: 10, textTransform: "uppercase", padding: "10px 36px", borderRadius: 6 }}>MABAR</div>
      </div>
      <div style={{ position: "absolute", left: 60, top: 100, right: 60, bottom: 140 }}>
        <PhotoWindow photo={photo} windowStyle={{ position: "absolute", inset: 0, overflow: "hidden", border: "6px solid #f5d78e", borderRadius: 6 }} imgStyle={imgStyle} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 36, textAlign: "center", color: "#f5d78e" }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 3 }}>{title}</div>
        <div style={{ fontSize: 16, marginTop: 6, color: "#e8cf9b" }}>{dateLabel} · {pbName}</div>
      </div>
    </>
  );
}

function PlaidFrame({ photo, title, dateLabel, pbName, imgStyle }: { photo: string | null; title: string; dateLabel: string; pbName: string; imgStyle: React.CSSProperties }) {
  const bg: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(#e8e4da 0%,#f6f3ec 100%)",
  };
  const tape: React.CSSProperties = {
    position: "absolute",
    top: 20,
    left: "50%",
    width: 160,
    height: 40,
    marginLeft: -80,
    background: "rgba(214,199,145,0.9)",
    transform: "rotate(-3deg)",
    boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
  };
  return (
    <>
      <div style={bg} />
      <div style={tape} />
      <div style={{ position: "absolute", left: 40, top: 70, right: 40, bottom: 120, border: "10px solid #fff", boxShadow: "0 10px 32px rgba(0,0,0,0.22)", borderRadius: 6 }}>
        <PhotoWindow photo={photo} windowStyle={{ position: "absolute", inset: 0, overflow: "hidden", background: "#e3e0d6" }} imgStyle={imgStyle} />
      </div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 36, textAlign: "left" }}>
        <div style={{ fontFamily: "'Comic Sans MS','Segoe Print',cursive", fontSize: 36, fontWeight: 700, color: "#3a3a3a", transform: "rotate(-2deg)" }}>Mabar {dateLabel}</div>
      </div>
      <div style={{ position: "absolute", left: 50, right: 50, bottom: 40, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#4a4a4a" }}>
        <div style={{ fontFamily: "'Segoe Print',cursive", fontSize: 20, fontWeight: 700 }}>{title}</div>
        <div style={{ fontFamily: "'Segoe Print',cursive", fontSize: 18 }}>{pbName}</div>
      </div>
    </>
  );
}

function StickerFrame({ photo, title, dateLabel, pbName, imgStyle }: { photo: string | null; title: string; dateLabel: string; pbName: string; imgStyle: React.CSSProperties }) {
  const bg: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg,#ff4d6d 0%,#ff9e40 55%,#ffd166 100%)",
  };
  const circle: React.CSSProperties = {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.95)",
    border: "14px solid #fff",
    boxShadow: "0 12px 36px rgba(0,0,0,0.3)",
    overflow: "hidden",
  };
  return (
    <>
      <div style={bg} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: "radial-gradient(#fff 4px, transparent 4px)", backgroundSize: "36px 36px" }} />
      <div style={{ position: "absolute", left: "50%", top: 50, transform: "translateX(-50%)", background: "#fff", color: "#ff4d6d", fontSize: 36, fontWeight: 900, letterSpacing: 8, padding: "10px 32px", borderRadius: 999, boxShadow: "0 8px 22px rgba(0,0,0,0.25)" }}>MABAR</div>
      <div style={{ ...circle, left: "50%", top: 120, marginLeft: -140 }}>
        <PhotoWindow photo={photo} windowStyle={{ position: "absolute", inset: 0, overflow: "hidden" }} imgStyle={imgStyle} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 420, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 32, fontWeight: 900, textShadow: "0 3px 8px rgba(0,0,0,0.35)" }}>{title}</div>
        <div style={{ fontSize: 18, marginTop: 8, fontWeight: 600, textShadow: "0 2px 6px rgba(0,0,0,0.35)" }}>{dateLabel} · {pbName}</div>
      </div>
      <div style={{ position: "absolute", left: 24, bottom: 24, fontSize: 60, transform: "rotate(-15deg)" }}>🏸</div>
      <div style={{ position: "absolute", right: 28, bottom: 32, fontSize: 52, transform: "rotate(12deg)" }}>🏸</div>
    </>
  );
}