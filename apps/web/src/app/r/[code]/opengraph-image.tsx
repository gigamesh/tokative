import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tokative Referral — 7 days of Pro, free";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e0f7fa 0%, #fce4ec 50%, #e8eaf6 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          <span style={{ color: "#26c6da" }}>Tok</span>
          <span style={{ color: "#78909c" }}>a</span>
          <span style={{ color: "#ab47bc" }}>t</span>
          <span style={{ color: "#ec407a" }}>ive</span>
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 600,
            color: "#37474f",
            marginTop: 20,
          }}
        >
          You&apos;re invited — 7 days of Pro, free
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#78909c",
            marginTop: 16,
          }}
        >
          Manage TikTok engagement at scale
        </div>
      </div>
    ),
    { ...size },
  );
}
