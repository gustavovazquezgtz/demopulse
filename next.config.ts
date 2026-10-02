import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 1:1 audio recordings upload through a server action as FormData.
      // Capped at 4.5mb to stay safely under common serverless
      // request-body limits in production — the recorder UI stops
      // recording (and the client validates file uploads) before hitting
      // this, and a session supports multiple recordings so a long 1:1
      // can be captured in several shorter segments instead of one giant
      // file.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
