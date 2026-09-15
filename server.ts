import "./lib/env.js";
import express from "express";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import app from "./api/index.js";

const port = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

async function start(): Promise<void> {
  if (isProduction) {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`FinTrust listening on http://localhost:${port}`);
  });
}

void start();
