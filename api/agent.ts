/**
 * FinTrust AI Consultant Agent
 *
 * Agentic loop powered by Claude (tool-use pattern).
 * Tools read from Supabase scoped to the authenticated user — no cross-tenant leakage.
 *
 * Entry point: runAgentChat()
 */

import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  reply: string;
  toolsUsed: string[];
}

// ---------------------------------------------------------------------------
// Anthropic client (lazy-init so missing key throws at call time, not import)
// ---------------------------------------------------------------------------

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

// ---------------------------------------------------------------------------
// Tool definitions (what Claude can call)
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_invoices",
    description:
      "List invoices for the user. Can filter by status and/or client name. Returns up to 20 most recent.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["DRAFT", "UNPAID", "PAID", "VOID"],
          description: "Filter by invoice status. Omit to get all.",
        },
        client: {
          type: "string",
          description: "Filter by client name (partial match).",
        },
        limit: {
          type: "number",
          description: "Max results (1-20). Defaults to 10.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_invoice_detail",
    description: "Get full details of a single invoice by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice_id: {
          type: "string",
          description: "UUID of the invoice.",
        },
      },
      required: ["invoice_id"],
    },
  },
  {
    name: "get_clients",
    description:
      "List clients/customers for the user. Returns name, email, total billed, and last invoice date.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max results (1-20). Defaults to 10.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_cash_flow_summary",
    description:
      "Summarize revenue: total paid, total unpaid, total overdue, and count per status. Useful for financial overview questions.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_overdue_invoices",
    description:
      "Return all UNPAID invoices whose due_date is in the past. Sorted by oldest due date first.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "draft_reminder_email",
    description:
      "Draft a polite payment reminder email for a specific invoice. Returns subject + body copy ready to send.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice_id: {
          type: "string",
          description: "UUID of the overdue invoice.",
        },
        tone: {
          type: "string",
          enum: ["friendly", "firm", "final"],
          description:
            "Tone of the reminder. 'friendly' for first reminder, 'firm' for second, 'final' for last notice.",
        },
      },
      required: ["invoice_id", "tone"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor — runs the tool Claude chose and returns a result string
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<string> {
  switch (name) {
    case "get_invoices": {
      let query = supabaseAdmin
        .from("invoices")
        .select("id, client, amount, status, date, due_date, metadata")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(Math.min(Number(input.limit ?? 10), 20));

      if (input.status) query = query.eq("status", input.status);
      if (input.client) query = query.ilike("client", `%${input.client}%`);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return "No invoices found matching the filter.";
      return JSON.stringify(data, null, 2);
    }

    case "get_invoice_detail": {
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", input.invoice_id)
        .eq("user_id", userId)
        .single();

      if (error || !data) return `Invoice not found or access denied.`;
      return JSON.stringify(data, null, 2);
    }

    case "get_clients": {
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("name, email, total_billed, created_at")
        .eq("user_id", userId)
        .order("total_billed", { ascending: false })
        .limit(Math.min(Number(input.limit ?? 10), 20));

      if (error) return `Error: ${error.message}`;
      if (!data?.length) return "No clients found.";
      return JSON.stringify(data, null, 2);
    }

    case "get_cash_flow_summary": {
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .select("status, amount")
        .eq("user_id", userId);

      if (error) return `Error: ${error.message}`;

      const summary = (data ?? []).reduce(
        (acc, inv) => {
          const amt = Number(inv.amount);
          acc.total += amt;
          if (inv.status === "PAID") acc.paid += amt;
          else if (inv.status === "UNPAID") acc.unpaid += amt;
          else if (inv.status === "DRAFT") acc.draft += amt;
          else if (inv.status === "VOID") acc.void += amt;
          acc.counts[inv.status] = (acc.counts[inv.status] ?? 0) + 1;
          return acc;
        },
        { total: 0, paid: 0, unpaid: 0, draft: 0, void: 0, counts: {} as Record<string, number> }
      );

      return JSON.stringify(summary, null, 2);
    }

    case "get_overdue_invoices": {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .select("id, client, amount, due_date, metadata")
        .eq("user_id", userId)
        .eq("status", "UNPAID")
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      if (error) return `Error: ${error.message}`;
      if (!data?.length) return "Great news — no overdue invoices!";
      return JSON.stringify(data, null, 2);
    }

    case "draft_reminder_email": {
      // Fetch invoice data first so the email can be specific
      const { data: inv, error } = await supabaseAdmin
        .from("invoices")
        .select("id, client, amount, due_date, metadata")
        .eq("id", input.invoice_id)
        .eq("user_id", userId)
        .single();

      if (error || !inv) return "Invoice not found.";

      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const invNum = meta.invoiceNumber ?? inv.id;
      const currency = (meta.currency as string) ?? "THB";
      const email = (meta.customerEmail as string) ?? "(client email)";
      const tone = input.tone as string;

      const toneMap: Record<string, { greeting: string; closing: string }> = {
        friendly: {
          greeting: "I hope this message finds you well.",
          closing: "Please let us know if you have any questions.",
        },
        firm: {
          greeting: "This is a follow-up regarding an outstanding balance.",
          closing:
            "Please arrange payment at your earliest convenience to avoid further action.",
        },
        final: {
          greeting: "This is a final notice regarding a seriously overdue payment.",
          closing:
            "Failure to settle this invoice within 7 days may result in the matter being referred to a collections agency.",
        },
      };

      const t = toneMap[tone] ?? toneMap.friendly;

      const subject = `${tone === "final" ? "FINAL NOTICE: " : ""}Payment Reminder — ${invNum}`;
      const body = `Dear ${inv.client},

${t.greeting}

We wanted to remind you that invoice **${invNum}** for **${currency} ${Number(inv.amount).toLocaleString()}** was due on **${inv.due_date}** and remains unpaid.

Please process payment at your earliest convenience. You can reach us at ${email} if you have any questions about this invoice.

${t.closing}

Best regards,
InvoicePro / FinTrust Team`;

      return JSON.stringify({ subject, body, to: email }, null, 2);
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ---------------------------------------------------------------------------
// System prompt — shapes the agent's persona
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are FinTrust AI, an intelligent financial consultant and assistant embedded inside the InvoicePro Dashboard.

Your role:
- Help freelancers and agencies manage their invoices, clients, and cash flow
- Answer questions about outstanding payments, overdue invoices, and revenue trends
- Draft professional payment reminder emails
- Give practical, actionable financial advice based on the user's real data

You have access to the user's live invoice and client data through tools. Always fetch real data before answering questions about specific amounts, clients, or dates — never guess or fabricate numbers.

Guidelines:
- Be concise, professional, and friendly
- Format currency clearly (e.g., "THB 15,000" or "USD 1,540")
- When you spot overdue invoices, proactively mention them
- If asked to send emails, clarify that you can draft them but the user must send them manually (Phase 1)
- Respond in the same language the user writes in (Thai or English)`;

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

export async function runAgentChat(
  messages: AgentMessage[],
  userId: string
): Promise<AgentResponse> {
  const client = getClient();
  const toolsUsed: string[] = [];

  // Convert our simple message format to Anthropic's format
  const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop — runs until Claude stops calling tools
  for (let iteration = 0; iteration < 10; iteration++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: claudeMessages,
    });

    // If Claude is done (no tool calls), return its final text
    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { reply: text, toolsUsed };
    }

    // Process tool calls
    if (response.stop_reason === "tool_use") {
      // Add Claude's response (with tool_use blocks) to history
      claudeMessages.push({ role: "assistant", content: response.content });

      // Execute each tool call and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        toolsUsed.push(block.name);
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          userId
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      // Feed results back for the next iteration
      claudeMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason — bail out
    break;
  }

  return {
    reply: "I was unable to complete this request. Please try again.",
    toolsUsed,
  };
}
