// Safe {{variable}} template engine — no eval, no arbitrary JS.
//
// Supported syntax:
//   {{variable}}            — HTML-escaped substitution
//   {{nested.path}}         — dot-notation access
//   {{{variable}}}          — unescaped (use for QR data URIs and trusted HTML)
//   {{value|currency}}      — pipe formatters: currency, thb, date, number, percent
//   {{#items}}...{{/items}} — section: arrays iterate (auto-injects {{index}} 1-based),
//                             truthy booleans/objects render once
//   {{^key}}...{{/key}}     — inverted section: renders when key is falsy or empty array

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur: unknown, key) => {
    if (cur == null || typeof cur !== "object") return "";
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

function applyFormat(value: unknown, fmt: string): string {
  const n = Number(value);
  switch (fmt) {
    case "currency":
    case "thb":
      return isNaN(n)
        ? String(value ?? "")
        : new Intl.NumberFormat("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(n);
    case "date":
      try {
        return new Date(String(value ?? "")).toLocaleDateString("th-TH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return String(value ?? "");
      }
    case "number":
      return isNaN(n) ? String(value ?? "") : n.toLocaleString("th-TH");
    case "percent":
      return isNaN(n) ? String(value ?? "") : `${n}%`;
    default:
      return String(value ?? "");
  }
}

function isTruthy(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0;
  return true;
}

export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  // 1a. Positive section blocks: {{#key}}...{{/key}}
  //     Arrays → iterate (each item gets auto-injected {{index}} 1-based)
  //     Truthy non-array → render inner once with same data context
  let out = template.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key: string, inner: string) => {
      const value = getPath(data, key);
      if (Array.isArray(value)) {
        return value
          .map((item, i) =>
            renderTemplate(inner, {
              ...(item as Record<string, unknown>),
              index: i + 1,
            })
          )
          .join("");
      }
      return isTruthy(value)
        ? renderTemplate(inner, data)
        : "";
    }
  );

  // 1b. Inverted section blocks: {{^key}}...{{/key}}
  //     Renders when key is falsy or an empty array
  out = out.replace(
    /\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key: string, inner: string) => {
      const value = getPath(data, key);
      return isTruthy(value) ? "" : renderTemplate(inner, data);
    }
  );

  // 2. Unescaped triple-brace {{{path}}}
  out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_, path: string) =>
    String(getPath(data, path) ?? "")
  );

  // 3. Escaped double-brace {{path}} or {{path|format}}
  out = out.replace(/\{\{([\w.|]+)\}\}/g, (_, expr: string) => {
    const [path = "", fmt] = expr.split("|") as [string, string | undefined];
    const value = getPath(data, path);
    return fmt
      ? escapeHtml(applyFormat(value, fmt))
      : escapeHtml(String(value ?? ""));
  });

  return out;
}
