import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  Webhook, Plus, Loader2, Trash2, Send, RefreshCw, Copy, Check,
  Eye, EyeOff, Globe, ScrollText, CircleAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Endpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
}

interface DeliveryLog {
  id: string;
  url: string;
  event_type: string;
  payload: unknown;
  response_status: number | null;
  created_at: string;
}

const EVENT_DESCRIPTIONS: Record<string, string> = {
  'invoice.created': 'A new invoice is created',
  'invoice.paid': 'An invoice is paid (any gateway)',
  'payment_link.paid': 'A payment link receives a payment',
  'test.ping': 'Manual test deliveries',
};

function statusBadgeClass(status: number | null): string {
  if (status === null) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
  }
  if (status >= 200 && status < 300) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  }
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
}

export default function Webhooks() {
  const { session } = useAuth();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-endpoint form
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Per-endpoint UI state
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const authHeaders = useCallback((): Record<string, string> => (
    session ? { Authorization: `Bearer ${session.access_token}` } : {}
  ), [session]);

  const fetchEndpoints = useCallback(() => {
    if (!session) return;
    fetch('/api/webhooks/endpoints', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        setEndpoints((d.data ?? []) as Endpoint[]);
        setEventTypes((d.eventTypes ?? []) as string[]);
      })
      .catch(() => setError('Failed to load webhook endpoints'))
      .finally(() => setLoading(false));
  }, [session, authHeaders]);

  const fetchLogs = useCallback(() => {
    if (!session) return;
    setLogsLoading(true);
    fetch('/api/webhooks/logs?limit=50', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setLogs((d.data ?? []) as DeliveryLog[]))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [session, authHeaders]);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function handleCreate() {
    if (!session) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/webhooks/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          url: formUrl.trim(),
          ...(formDescription.trim() ? { description: formDescription.trim() } : {}),
          events: formEvents,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setFormError(d.error ?? 'Failed to create endpoint');
        return;
      }
      setEndpoints(prev => [d.data as Endpoint, ...prev]);
      setRevealedSecret((d.data as Endpoint).id);
      setShowForm(false);
      setFormUrl('');
      setFormDescription('');
      setFormEvents([]);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(ep: Endpoint) {
    if (!session) return;
    const next = !ep.is_active;
    setEndpoints(prev => prev.map(e => e.id === ep.id ? { ...e, is_active: next } : e));
    const res = await fetch(`/api/webhooks/endpoints/${ep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ is_active: next }),
    });
    if (!res.ok) {
      setEndpoints(prev => prev.map(e => e.id === ep.id ? { ...e, is_active: ep.is_active } : e));
    }
  }

  async function handleDelete(ep: Endpoint) {
    if (!session) return;
    if (!window.confirm(`Delete webhook endpoint?\n${ep.url}`)) return;
    const res = await fetch(`/api/webhooks/endpoints/${ep.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) setEndpoints(prev => prev.filter(e => e.id !== ep.id));
  }

  async function handleTest(ep: Endpoint) {
    if (!session) return;
    setTesting(ep.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhooks/endpoints/${ep.id}/test`, {
        method: 'POST',
        headers: authHeaders(),
      });
      setTestResult({ id: ep.id, ok: res.ok });
      fetchLogs();
    } finally {
      setTesting(null);
      setTimeout(() => setTestResult(null), 4000);
    }
  }

  async function handleRetry(log: DeliveryLog) {
    if (!session) return;
    setRetrying(log.id);
    try {
      await fetch(`/api/webhooks/retry/${log.id}`, { method: 'POST', headers: authHeaders() });
      fetchLogs();
    } finally {
      setRetrying(null);
    }
  }

  function handleCopySecret(ep: Endpoint) {
    navigator.clipboard.writeText(ep.secret).catch(() => {});
    setCopied(ep.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const activeCount = endpoints.filter(e => e.is_active).length;
  const completedLogs = logs.filter(l => l.response_status !== null);
  const successCount = completedLogs.filter(l => l.response_status! >= 200 && l.response_status! < 300).length;
  const deliveryRate = completedLogs.length > 0
    ? `${((successCount / completedLogs.length) * 100).toFixed(0)}%`
    : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Webhooks</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Get notified at your own endpoint when invoices are created and payments come in.
            Every delivery is signed with <code className="font-mono text-xs">X-FinTrust-Signature</code>.
          </p>
        </div>
        <Button onClick={() => { setShowForm(v => !v); setFormError(null); }} className="w-full sm:w-auto shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Endpoint
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 rounded-lg px-4 py-3">
          <CircleAlert className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Active Endpoints</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {activeCount} <span className="text-base font-medium text-slate-400">/ {endpoints.length}</span>
            </span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Recent Deliveries</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">{logsLoading ? '—' : logs.length}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Delivery Success</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">{logsLoading ? '—' : deliveryRate}</span>
          </CardContent>
        </Card>
      </div>

      {/* Add endpoint form */}
      {showForm && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Globe className="w-5 h-5 text-emerald-600" /> New Endpoint</CardTitle>
            <CardDescription>
              Must be a publicly reachable http(s) URL. Localhost and private hosts are rejected — use a tunnel (e.g. ngrok) for local testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                placeholder="https://example.com/webhooks/fintrust"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-desc">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                id="wh-desc"
                placeholder="Production ERP sync"
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Events <span className="text-slate-400 font-normal">(none selected = all events)</span></Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {eventTypes.map(ev => (
                  <label key={ev} className="flex items-start gap-2.5 border border-slate-200 dark:border-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <Checkbox
                      checked={formEvents.includes(ev)}
                      onCheckedChange={(checked) => {
                        setFormEvents(prev => checked === true ? [...prev, ev] : prev.filter(x => x !== ev));
                      }}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100">{ev}</span>
                      <span className="text-xs text-slate-500">{EVENT_DESCRIPTIONS[ev] ?? ''}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <CircleAlert className="w-4 h-4 shrink-0" /> {formError}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving || !formUrl.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create Endpoint
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoints */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Webhook className="w-5 h-5 text-emerald-600" /> Endpoints</CardTitle>
          <CardDescription>
            Verify deliveries by recomputing HMAC-SHA256 of the raw body with your signing secret and comparing it to <code className="font-mono text-xs">X-FinTrust-Signature</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {endpoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Webhook className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No endpoints yet</p>
              <p className="text-xs mt-1">Add an endpoint to start receiving invoice and payment events.</p>
            </div>
          ) : (
            endpoints.map(ep => (
              <div key={ep.id} className={`border rounded-xl p-4 transition-colors ${ep.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 opacity-70'}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100 break-all">{ep.url}</span>
                      <Badge variant="outline" className={ep.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'}>
                        {ep.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    {ep.description && <p className="text-xs text-slate-500 mt-1">{ep.description}</p>}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {ep.events.length === 0
                        ? <Badge variant="outline" className="font-mono text-[11px]">all events</Badge>
                        : ep.events.map(ev => <Badge key={ev} variant="outline" className="font-mono text-[11px]">{ev}</Badge>)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3">
                      <code className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 rounded px-2 py-1 break-all">
                        {revealedSecret === ep.id ? ep.secret : `whsec_${'•'.repeat(20)}`}
                      </code>
                      <button
                        onClick={() => setRevealedSecret(revealedSecret === ep.id ? null : ep.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title={revealedSecret === ep.id ? 'Hide secret' : 'Reveal secret'}
                      >
                        {revealedSecret === ep.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopySecret(ep)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Copy secret"
                      >
                        {copied === ep.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {testResult?.id === ep.id && (
                      <span className={`text-xs font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                        {testResult.ok ? 'Test sent' : 'Test failed'}
                      </span>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleTest(ep)} disabled={testing === ep.id || !ep.is_active}>
                      {testing === ep.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                      Test
                    </Button>
                    <Switch checked={ep.is_active} onCheckedChange={() => handleToggle(ep)} aria-label="Toggle endpoint" />
                    <button
                      onClick={() => handleDelete(ep)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete endpoint"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Delivery log */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><ScrollText className="w-5 h-5 text-emerald-600" /> Recent Deliveries</CardTitle>
            <CardDescription>Latest 50 webhook deliveries with their response status.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={logsLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="px-6">Event</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <ScrollText className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No deliveries yet</p>
                      <p className="text-xs mt-1">Deliveries appear here once an event fires or you send a test.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="px-6"><Badge variant="outline" className="font-mono text-[11px]">{log.event_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 max-w-[260px] truncate" title={log.url}>{log.url}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-mono ${statusBadgeClass(log.response_status)}`}>
                        {log.response_status === null ? 'pending' : log.response_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="outline" size="sm" onClick={() => handleRetry(log)} disabled={retrying === log.id}>
                        {retrying === log.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
