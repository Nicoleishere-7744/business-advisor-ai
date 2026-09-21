"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Alert, Button, Card, Spinner } from "@/components/ui";

// نمایش گزارش مشاوره؛ اگر هنوز تولید نشده باشد، تولید را شروع و استریم می‌کند.

type Props = {
  consultationId: string;
  initialReport: string | null;
  initialStatus: string;
  initialError: string | null;
  /// آیا باید بلافاصله تولید شروع شود؟ (مثلاً درست بعد از پرداخت موفق)
  autoStart: boolean;
};

export function ReportView({
  consultationId,
  initialReport,
  initialStatus,
  initialError,
  autoStart,
}: Props) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  const [streaming, setStreaming] = useState(false);
  const startedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const generate = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    setStreaming(true);
    setError(null);
    setReport("");
    setStatus("generating");

    try {
      const response = await fetch(`/api/consultations/${consultationId}/generate`, {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "تولید گزارش ناموفق بود.");
        setStatus("failed");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setReport(accumulated);
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }

      setStatus("completed");
      // وضعیت واقعی و امکان چت پیگیری از سرور تازه‌سازی می‌شود
      router.refresh();
    } catch {
      setError("ارتباط با سرور در حین تولید گزارش قطع شد. صفحه را دوباره باز کنید.");
    } finally {
      setStreaming(false);
    }
  }, [consultationId, router]);

  useEffect(() => {
    if (autoStart) void generate();
  }, [autoStart, generate]);

  if (status === "completed" && report) {
    return (
      <Card>
        <article className="report-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </article>
      </Card>
    );
  }

  if (streaming || status === "generating") {
    return (
      <Card>
        <div className="no-print mb-5 flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
          <Spinner />
          در حال تولید گزارش… می‌توانید همین‌جا منتظر بمانید. اگر صفحه را ببندید، گزارش در
          پس‌زمینه کامل می‌شود.
        </div>
        <article className="report-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </article>
        <div ref={endRef} />
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4 py-6 text-center">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p className="text-sm text-muted">
          {status === "failed"
            ? "تولید گزارش قبلاً ناموفق بود. می‌توانید بدون پرداخت مجدد دوباره تلاش کنید."
            : "پرداخت شما تأیید شده است. برای دریافت گزارش، تولید را شروع کنید."}
        </p>
        <Button
          onClick={() => {
            startedRef.current = false;
            void generate();
          }}
        >
          {status === "failed" ? "تلاش دوباره" : "تولید گزارش"}
        </Button>
      </div>
    </Card>
  );
}
