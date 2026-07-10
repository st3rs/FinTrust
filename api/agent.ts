/**
 * FinTrust AI Consultant Agent
 *
 * Agentic loop powered by OpenAI (function calling pattern).
 * Tools read from Supabase scoped to the authenticated user — no cross-tenant leakage.
 *
 * Entry point: runAgentChat()
 */

import OpenAI from "openai";
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
// OpenAI client (lazy-init so missing key throws at call time, not import)
// ---------------------------------------------------------------------------

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function calling format)
// ---------------------------------------------------------------------------

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_invoices",
      description:
        "List invoices for the user. Can filter by status and/or client name. Returns up to 20 most recent.",
      parameters: {
        type: "object",
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
  },
  {
    type: "function",
    function: {
      name: "get_invoice_detail",
      description: "Get full details of a single invoice by its ID.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: {
            type: "string",
            description: "UUID of the invoice.",
          },
        },
        required: ["invoice_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clients",
      description:
        "List clients/customers for the user. Returns name, email, total billed, and last invoice date.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max results (1-20). Defaults to 10.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cash_flow_summary",
      description:
        "Summarize revenue: total paid, total unpaid, total overdue, and count per status. Useful for financial overview questions.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_overdue_invoices",
      description:
        "Return all UNPAID invoices whose due_date is in the past. Sorted by oldest due date first.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_reminder_email",
      description:
        "Draft a polite payment reminder email for a specific invoice. Returns subject + body copy ready to send.",
      parameters: {
        type: "object",
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
  },
];

// ---------------------------------------------------------------------------
// Tool executor — runs the tool the model chose and returns a result string
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

      if (error || !data) return "Invoice not found or access denied.";
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
          closing: "Please arrange payment at your earliest convenience to avoid further action.",
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

Please process payment at your earliest convenience.

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
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are FinTrust AI, an intelligent financial consultant and assistant embedded inside the InvoicePro Dashboard.

Your role:
- Help freelancers and agencies manage their invoices, clients, and cash flow
- Answer questions about outstanding payments, overdue invoices, and revenue trends
- Draft professional payment reminder emails
- Give practical, actionable financial advice based on the user's real data

You have access to the user's live invoice and client data through tools. Always fetch real data before answering — never guess or fabricate numbers.

Guidelines:
- Be concise, professional, and friendly
- Format currency clearly (e.g., "THB 15,000" or "USD 1,540")
- When you spot overdue invoices, proactively mention them
- If asked to send emails, clarify that you can draft them but the user must send them manually
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

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
  ];

  // Agentic loop — runs until the model stops calling tools
  for (let iteration = 0; iteration < 10; iteration++) {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];

    // Model is done — return final text
    if (choice.finish_reason === "stop") {
      return {
        reply: choice.message.content ?? "",
        toolsUsed,
      };
    }

    // Model wants to call tools
    if (choice.finish_reason === "tool_calls") {
      const assistantMsg = choice.message;
      chatMessages.push(assistantMsg);

      // Execute each tool call
      for (const toolCall of assistantMsg.tool_calls ?? []) {
        toolsUsed.push(toolCall.function.name);

        const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await executeTool(toolCall.function.name, input, userId);

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      continue;
    }

    break;
  }

  return {
    reply: "I was unable to complete this request. Please try again.",
    toolsUsed,
  };
}
