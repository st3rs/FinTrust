import "dotenv/config";
import express from "express";
import { requireAuth } from "./middleware/auth.js";
import renderRouter from "./routes/render.js";
import documentsRouter from "./routes/documents.js";
import qrRouter from "./routes/qr.js";

const app = express();
const PORT = Number(process.env["PORT"]) || 8080;

app.use(express.json({ limit: "4mb" }));

// ── Health check — unauthenticated ────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── Authenticated v1 API ──────────────────────────────────────────────────────
const v1 = express.Router();
v1.use(requireAuth as express.RequestHandler);

v1.use("/render", renderRouter);
v1.use("/documents", documentsRouter);
v1.use("/qr", qrRouter);

app.use("/v1", v1);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅  docgen service running → http://localhost:${PORT}`);
});
