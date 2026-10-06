import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
