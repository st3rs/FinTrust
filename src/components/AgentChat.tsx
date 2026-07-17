import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, X, Send, Loader2, ChevronDown, Sparkles, MousePointerClick, MessageCircleQuestion } from 'lucide-react';
import type { PageAgentCore } from 'page-agent';
import { useAuth } from '../lib/auth-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function sendChat(
  messages: Message[],
  accessToken: string
): Promise<{ reply: string; toolsUsed: string[] }> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Suggested starter prompts
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  'สรุปกระแสเงินสดเดือนนี้',
  'มี invoice ค้างชำระอะไรบ้าง?',
  'ร่างอีเมลทวงหนี้ให้ลูกค้า',
  "What's my total unpaid amount?",
];

const ACT_SUGGESTIONS = [
  'เปิดหน้าสร้าง invoice ใหม่',
  'สร้าง invoice ให้ Acme Corp ค่าออกแบบ 15,000 บาท',
  'ไปที่หน้า Customers แล้วเพิ่มลูกค้าใหม่ชื่อ Sabai Digital',
  'สอนวิธีสร้าง invoice แรกให้หน่อย',
];

// ---------------------------------------------------------------------------
// PageAgent (in-page GUI agent) — lazy singleton
//
// The LLM traffic goes through our server proxy (/api/llm/v1) which verifies
// the Supabase JWT; the frontend never sees a real LLM key. The "apiKey"
// passed here is the user's own access token.
// ---------------------------------------------------------------------------

let pageAgentInstance: PageAgentCore | null = null;

async function getPageAgent(accessToken: string): Promise<PageAgentCore> {
  if (pageAgentInstance) return pageAgentInstance;
  // PageAgentCore = headless agent (no floating panel UI) — our chat IS the UI.
  const [{ PageAgentCore }, { PageController }] = await Promise.all([
    import('page-agent'),
    import('@page-agent/page-controller'),
  ]);
  pageAgentInstance = new PageAgentCore({
    // Model name is a placeholder — the proxy forces the server-side model.
    model: 'fintrust-proxy',
    baseURL: `${window.location.origin}/api/llm/v1`,
    apiKey: accessToken,
    language: 'en-US',
    pageController: new PageController({
      // Keep the agent's hands off our own chat widget, or it gets confused
      // reading its own conversation and loading states.
      interactiveBlacklist: [
        () => document.getElementById('fintrust-agent-chat') as HTMLElement,
      ],
    }),
  });
  return pageAgentInstance;
}

// Safety guardrail + autonomy instruction appended to every action task.
const ACT_GUARDRAIL =
  '\n\nข้อกำหนด: (1) ทำงานต่อเนื่องจนจบโดยไม่ต้องหยุดถามยืนยันระหว่างทาง — ถ้าต้องเปลี่ยนหน้า (navigate) ก็ทำได้เลย (2) ห้ามกดปุ่มลบ (Delete), ปุ่มยืนยันการชำระเงิน หรือปุ่มส่งอีเมล/ข้อความออกภายนอกโดยเด็ดขาด — เฉพาะกรณีเหล่านี้เท่านั้นให้หยุดที่ขั้นตอนก่อนหน้าแล้วสรุปให้ผู้ใช้กดเอง (3) เมื่อจบงาน สรุปสั้นๆ ว่าทำอะไรไปบ้างและค้างอะไรไว้';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentChat() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'ask' | 'act'>('ask');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const accessToken = session?.access_token;

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading || !accessToken) return;

    setInput('');
    setError(null);

    const userMsg: Message = { role: 'user', content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      if (mode === 'act') {
        // GUI agent: performs the task by clicking/typing on the page itself.
        const agent = await getPageAgent(accessToken);
        const result = await agent.execute(content + ACT_GUARDRAIL);
        const summary = result.success
          ? `✅ ${result.data || 'ทำงานเสร็จแล้วครับ'}`
          : `⚠️ ทำไม่สำเร็จ: ${result.data || 'ไม่ทราบสาเหตุ'}`;
        setMessages([...nextMessages, { role: 'assistant', content: summary }]);
      } else {
        const result = await sendChat(nextMessages, accessToken);
        setMessages([
          ...nextMessages,
          { role: 'assistant', content: result.reply, toolsUsed: result.toolsUsed },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div id="fintrust-agent-chat">
      {/* ── Floating trigger button ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open AI consultant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center"
      >
        {open ? <ChevronDown className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
        {!open && messages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
        )}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[22rem] sm:w-[26rem] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden transition-all duration-300 ease-out origin-bottom-right ${
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">FinTrust AI</p>
            <p className="text-[11px] opacity-75 leading-tight">ที่ปรึกษาการเงินส่วนตัว</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="opacity-75 hover:opacity-100 transition-opacity"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode toggle: ask (backend data chat) vs act (in-page GUI agent) */}
        <div className="flex gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <button
            onClick={() => setMode('ask')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg py-1.5 transition-colors ${
              mode === 'ask'
                ? 'bg-primary/10 text-primary'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <MessageCircleQuestion className="w-3.5 h-3.5" /> ถามข้อมูล
          </button>
          <button
            onClick={() => setMode('act')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg py-1.5 transition-colors ${
              mode === 'act'
                ? 'bg-primary/10 text-primary'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" /> สั่งทำ
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  สวัสดีครับ! ผมคือ FinTrust AI
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ถามเรื่อง invoice, ลูกค้า, หรือกระแสเงินสดได้เลย
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-2">
                {(mode === 'act' ? ACT_SUGGESTIONS : SUGGESTIONS).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-left text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary dark:hover:text-primary transition-colors leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <p className="text-[10px] opacity-50 mt-1">
                    ใช้ข้อมูลจริง: {msg.toolsUsed.join(', ')}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-xs text-slate-500">
                  {mode === 'act' ? 'กำลังทำงานบนหน้าจอ…' : 'กำลังค้นหาข้อมูล…'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2 text-center">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-3 shrink-0">
          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700 focus-within:border-primary transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'act'
                  ? 'บอกงานที่ให้ทำบนหน้าจอ… (Enter ส่ง)'
                  : 'พิมพ์คำถามหรือคำสั่ง… (Enter ส่ง)'
              }
              rows={1}
              disabled={loading || !accessToken}
              className="flex-1 bg-transparent resize-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 max-h-32"
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading || !accessToken}
              aria-label="Send"
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-1.5">
            AI อาจผิดพลาดได้ — ตรวจสอบตัวเลขสำคัญเสมอ
          </p>
        </div>
      </div>
    </div>
  );
}
