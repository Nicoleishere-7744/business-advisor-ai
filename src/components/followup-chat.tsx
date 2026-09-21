"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Alert, Button, Card, CardHeader, Spinner, Textarea } from "@/components/ui";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/constants";

// چت پیگیری روی گزارش

type Message = { id: string; role: string; content: string };

export function FollowUpChat({
  consultationId,
  initialMessages,
  limit,
}: {
  consultationId: string;
  initialMessages: Message[];
  limit: number;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const asked = messages.filter((message) => message.role === "user").length;
  const remaining = Math.max(0, limit - asked);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const question = input.trim();
    if (question.length < 3) {
      setError("سوال خود را کامل‌تر بنویسید.");
      return;
    }

    setPending(true);
    const optimistic: Message = { id: `temp-${Date.now()}`, role: "user", content: question };
    setMessages((current) => [...current, optimistic]);
    setInput("");

    try {
      const response = await fetch(`/api/consultations/${consultationId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "ارسال سوال ناموفق بود.");
        // پیام خوش‌بینانه را برمی‌گردانیم تا کاربر بتواند دوباره تلاش کند
        setMessages((current) => current.filter((message) => message.id !== optimistic.id));
        setInput(question);
        return;
      }

      setMessages((current) => [
        ...current,
        { id: data.messageId, role: "assistant", content: data.answer },
      ]);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setInput(question);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="no-print">
      <CardHeader
        title="سوال پیگیری"
        description={
          remaining > 0
            ? `می‌توانید ${remaining} سوال دیگر درباره این گزارش بپرسید.`
            : "سقف سوال‌های پیگیری این مشاوره تکمیل شده است."
        }
      />

      {messages.length > 0 ? (
        <div className="mb-5 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "rounded-2xl bg-primary-soft px-4 py-3 text-sm"
                  : "rounded-2xl bg-surface-muted px-4 py-3"
              }
            >
              <p className="mb-1.5 text-xs font-medium text-muted">
                {message.role === "user" ? "سوال شما" : "پاسخ مشاور"}
              </p>
              {message.role === "user" ? (
                <p className="leading-7">{message.content}</p>
              ) : (
                <div className="report-prose text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {remaining > 0 ? (
        <form onSubmit={send} className="space-y-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            placeholder="مثلاً: برای اجرای پیشنهاد اول، از کجا شروع کنم؟"
            disabled={pending}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            {pending ? "در حال پاسخ‌گویی…" : "ارسال سوال"}
          </Button>
        </form>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : null}
    </Card>
  );
}
