import { defineConfig, loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    test: {
      environment: "node",
      globals: true,
    },
  };
});
