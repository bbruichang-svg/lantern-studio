import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许通过 127.0.0.1 访问 dev 资源（内置预览面板用 127.0.0.1 打开），
  // 否则 HMR 的 WebSocket 会被 Next 以 cross-origin 为由拒绝。
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
