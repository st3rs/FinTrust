import type { RenderOptions } from "../types.js";

// Paper sizes in inches (Gotenberg expects inch strings)
const PAPER_SIZES: Record<string, { width: string; height: string }> = {
  A4: { width: "8.27", height: "11.69" },
  Letter: { width: "8.5", height: "11" },
};

// Convert "15mm" → inches string for Gotenberg
function mmToInches(mm: string): string {
  const n = parseFloat(mm);
  return isNaN(n) ? "0.59" : (n / 25.4).toFixed(3);
}

export async function htmlToPdf(
  html: string,
  options?: RenderOptions
): Promise<Buffer> {
  const gotenbergUrl = process.env["GOTENBERG_URL"];
  if (!gotenbergUrl) throw new Error("Missing GOTENBERG_URL");

  const paper = PAPER_SIZES[options?.paperSize ?? "A4"] ?? PAPER_SIZES["A4"]!;

  const form = new FormData();
  form.append(
    "index.html",
    new Blob([html], { type: "text/html" }),
    "index.html"
  );
  form.append("paperWidth", paper.width);
  form.append("paperHeight", paper.height);
  form.append("marginTop", mmToInches(options?.marginTop ?? "15mm"));
  form.append("marginBottom", mmToInches(options?.marginBottom ?? "15mm"));
  form.append("marginLeft", mmToInches(options?.marginLeft ?? "15mm"));
  form.append("marginRight", mmToInches(options?.marginRight ?? "15mm"));
  form.append("landscape", String(options?.landscape ?? false));
  form.append("scale", String(options?.scale ?? 1));
  // No waitDelay: the Sarabun Thai font is baked into the Gotenberg image
  // (services/docgen/gotenberg/Dockerfile), so there is no remote asset to wait
  // for. An optional override remains for templates that DO load remote assets.
  const waitDelay = process.env["GOTENBERG_WAIT_DELAY"];
  if (waitDelay) form.append("waitDelay", waitDelay);

  const res = await fetch(
    `${gotenbergUrl}/forms/chromium/convert/html`,
    { method: "POST", body: form }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Gotenberg ${res.status}: ${text}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
