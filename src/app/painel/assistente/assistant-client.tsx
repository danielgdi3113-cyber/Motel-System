"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Copy, FileText, KeyRound, Loader2, Printer, Square } from "lucide-react";
import type { AssistantEvent, DisplayItem } from "@/lib/assistant/agent";
import { saveApiKeyAction } from "@/actions/assistant";
import { ActionForm, Submit } from "@/components/form";
import { Markdown } from "@/components/markdown";
import { Card, Input, cn } from "@/components/ui";

const SUGGESTIONS = [
  "Me dá o relatório completo da última semana",
  "Como está o motel agora?",
  "Compare este mês com o mês passado",
  "Quais produtos estão abaixo do estoque mínimo?",
  "Quem está devendo e quanto?",
  "Teve diferença de caixa nos últimos 7 dias?",
];

type Item = DisplayItem & { streaming?: boolean };

export function AssistantChat({ chatId: initialChatId, initialItems, userName }: { chatId: string | null; initialItems: DisplayItem[]; userName: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatId = useRef(initialChatId);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, status]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setStatus("Pensando…");
    // Relatórios ficam no fim da resposta, depois da análise
    const reports: Item[] = [];
    setItems((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "", streaming: true }]);

    const appendText = (delta: string) =>
      setItems((prev) => {
        const next = [...prev];
        const idx = next.findLastIndex((x) => x.role === "assistant" && x.streaming);
        if (idx >= 0) next[idx] = { ...next[idx], text: (next[idx] as { text: string }).text + delta } as Item;
        return next;
      });

    abort.current = new AbortController();
    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.current, message: text }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "NO_KEY") router.refresh();
        throw new Error(data.error ?? "Não foi possível falar com o assistente.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AssistantEvent;
          if (e.type === "chat" && !chatId.current) {
            chatId.current = e.id;
            window.history.replaceState(null, "", `/painel/assistente?c=${e.id}`);
          } else if (e.type === "text") {
            setStatus(null);
            appendText(e.delta);
          } else if (e.type === "tool") {
            setStatus(e.label + "…");
            appendText("");
          } else if (e.type === "report") {
            reports.push({ role: "report", title: e.title, markdown: e.markdown });
          } else if (e.type === "error") {
            setError(e.message);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setItems((prev) => [
        ...prev.filter((x) => !(x.role === "assistant" && x.streaming && !x.text.trim())).map((x) => ({ ...x, streaming: false })),
        ...reports,
      ]);
      setBusy(false);
      setStatus(null);
      abort.current = null;
      router.refresh(); // atualiza a lista de conversas
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-accent">
              <Bot className="size-7" />
            </div>
            <h1 className="text-2xl font-semibold">Olá, {userName}! Como posso ajudar?</h1>
            <p className="mt-2 max-w-md text-sm text-muted">
              Pergunte qualquer coisa sobre o motel: relatórios, faturamento, caixa, estoque, clientes, pendências ou o que a equipe fez.
            </p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-accent hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5 pb-4">
            {items.map((item, i) =>
              item.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-sm">{item.text}</div>
                </div>
              ) : item.role === "assistant" ? (
                <div key={i} className="flex gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-accent">
                    <Bot className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <Markdown>{item.text || " "}</Markdown>
                  </div>
                </div>
              ) : (
                <ReportCard key={i} title={item.title} markdown={item.markdown} />
              ),
            )}
            {status && (
              <div className="flex items-center gap-2 pl-11 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" /> {status}
              </div>
            )}
            {error && <div className="ml-11 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
            <div ref={bottom} />
          </div>
        )}
      </div>

      <form
        className="no-print mx-auto mt-3 w-full max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-accent">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Pergunte sobre o motel… (ex.: relatório de ontem)"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-600"
          />
          {busy ? (
            <button type="button" onClick={() => abort.current?.abort()} className="grid size-10 place-items-center rounded-xl bg-surface-2 hover:bg-line" aria-label="Parar">
              <Square className="size-4" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="grid size-10 place-items-center rounded-xl bg-gradient-accent disabled:opacity-40" aria-label="Enviar">
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted">
          O assistente consulta os dados do sistema e não altera nada. Os números dos relatórios são calculados pelo sistema.
        </p>
      </form>
    </div>
  );
}

function ReportCard({ title, markdown }: { title: string; markdown: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function print() {
    const el = ref.current;
    if (!el) return;
    el.classList.add("print-area");
    document.body.classList.add("printing");
    const done = () => {
      el.classList.remove("print-area");
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  return (
    <div ref={ref} className="ml-11 rounded-2xl border border-line bg-surface">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-accent" /> {title}
        </div>
        <div className="flex gap-1">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(markdown);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-white"
          >
            <Copy className="size-3.5" /> {copied ? "Copiado!" : "Copiar"}
          </button>
          <button onClick={print} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs hover:bg-line">
            <Printer className="size-3.5" /> Imprimir / PDF
          </button>
        </div>
      </div>
      <div className="px-5 py-4">
        <Markdown>{markdown}</Markdown>
      </div>
    </div>
  );
}

export function KeySetup({ keyHint, fromEnv }: { keyHint: string | null; fromEnv: boolean }) {
  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-gradient-accent">
          <KeyRound className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Ativar o Assistente IA</h1>
          <p className="text-sm text-muted">O assistente usa o Claude, da Anthropic. É preciso uma chave de API (paga por uso).</p>
        </div>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">
        <li>
          Crie uma conta em{" "}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-accent underline">
            console.anthropic.com
          </a>
          .
        </li>
        <li>
          Em <strong>Billing</strong>, adicione créditos (US$ 5 já dão para muitos relatórios).
        </li>
        <li>
          Em <strong>API Keys</strong>, clique em <strong>Create Key</strong> e copie a chave (começa com <code>sk-ant-</code>).
        </li>
        <li>Cole abaixo e salve.</li>
      </ol>
      {fromEnv ? (
        <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          A chave já está configurada no servidor (variável ANTHROPIC_API_KEY).
        </p>
      ) : (
        <ActionForm action={saveApiKeyAction} resetOnSuccess>
          <Input label="Chave da API" name="apiKey" type="password" placeholder={keyHint ? `Atual: ${keyHint} — cole uma nova para trocar` : "sk-ant-..."} autoComplete="off" />
          <div className="flex items-center gap-3">
            <Submit>Salvar chave</Submit>
            {keyHint && (
              <Link href="/painel/assistente" className="text-sm text-muted hover:text-white">
                Voltar ao assistente
              </Link>
            )}
          </div>
          <p className="text-xs text-muted">A chave fica guardada no banco do sistema e só administradores podem trocá-la. Para removê-la, salve o campo vazio.</p>
        </ActionForm>
      )}
    </Card>
  );
}
