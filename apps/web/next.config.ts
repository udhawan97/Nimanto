import type { NextConfig } from "next";

const repository = process.env.NIMANTO_GITHUB_PAGES === "true" ? "/Nimanto" : "";

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: repository,
  ...(repository ? { assetPrefix: repository } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
