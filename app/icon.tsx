import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <div style={{ fontSize: 48, color: "#fff7ea", lineHeight: 1 }}>$</div>
      </div>
    ),
    size,
  );
}
