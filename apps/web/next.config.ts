import type { NextConfig } from "next";
import path from "node:path";

const apiUrl = process.env.PROCEDURALS_API_URL ?? "http://127.0.0.1:8080";
const repositoryRoot = path.resolve(__dirname, "../..");
const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};
export default nextConfig;
