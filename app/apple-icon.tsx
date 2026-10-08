import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3b4bdc, #ff4f9a 55%, #f5a14a)",
        }}
      >
        <div style={{ fontSize: 132, color: "#fff7ea", lineHeight: 1 }}>$</div>
      </div>
    ),
    size,
  );
}
