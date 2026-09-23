import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出：纯客户端应用（无 API 路由/服务端特性），构建产物在 out/
  output: "export",
  // /studio 生成 studio/index.html，静态主机才能解析子路由
  trailingSlash: true,
  // 允许通过 127.0.0.1 访问 dev 资源（内置预览面板用 127.0.0.1 打开），
  // 否则 HMR 的 WebSocket 会被 Next 以 cross-origin 为由拒绝。
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
