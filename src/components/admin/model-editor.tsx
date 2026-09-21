"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  HelpText,
  Input,
  Label,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/admin/action-form";
import { deleteModel, fetchOpenRouterModels, saveModel } from "@/app/admin/actions";

// افزودن/ویرایش مدل هوش مصنوعی + واکشی فهرست مدل‌های OpenRouter

type ModelRow = {
  id: string;
  modelSlug: string;
  displayName: string;
  description: string | null;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  isDefault: boolean;
  order: number;
};

const EMPTY: ModelRow = {
  id: "",
  modelSlug: "",
  displayName: "",
  description: null,
  temperature: 0.7,
  maxTokens: 4000,
  isActive: true,
  isDefault: false,
  order: 0,
};

export function ModelEditor({ models }: { models: ModelRow[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [saveState, saveAction] = useActionState(saveModel, null);
  const [deleteState, deleteAction] = useActionState(deleteModel, null);
  const [remoteModels, setRemoteModels] = useState<Array<{ id: string; name: string }>>([]);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [loadingRemote, startLoadingRemote] = useTransition();

  const editing = models.find((model) => model.id === selectedId) ?? EMPTY;
  // با تغییر مدل انتخاب‌شده، فرم باید مقادیر جدید را نشان بدهد
  const formKey = editing.id || "new";

  function loadRemoteModels() {
    setRemoteError(null);
    startLoadingRemote(async () => {
      const result = await fetchOpenRouterModels();
      if (result.ok) {
        setRemoteModels(result.models);
      } else {
        setRemoteError(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title={editing.id ? "ویرایش مدل" : "افزودن مدل جدید"}
        description="شناسه مدل باید دقیقاً همان slug مربوط به OpenRouter باشد."
        action={
          <Select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="w-56"
          >
            <option value="">+ مدل جدید</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </Select>
        }
      />

      <div className="mb-5 rounded-xl bg-surface-muted p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={loadRemoteModels} disabled={loadingRemote}>
            {loadingRemote ? <Spinner /> : null}
            دریافت فهرست مدل‌ها از OpenRouter
          </Button>
          {remoteModels.length > 0 ? (
            <span className="text-xs text-muted">{remoteModels.length} مدل دریافت شد</span>
          ) : null}
        </div>
        {remoteError ? (
          <Alert tone="danger" className="mt-3">
            {remoteError}
          </Alert>
        ) : null}
        {remoteModels.length > 0 ? (
          <>
            <datalist id="openrouter-models">
              {remoteModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </datalist>
            <HelpText>
              حالا در فیلد «شناسه مدل» تایپ کن؛ پیشنهادها از همین فهرست نمایش داده می‌شوند.
            </HelpText>
          </>
        ) : null}
      </div>

      <form key={formKey} action={saveAction} className="space-y-5">
        <input type="hidden" name="id" value={editing.id} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="modelSlug">شناسه مدل (slug)</Label>
            <Input
              id="modelSlug"
              name="modelSlug"
              list="openrouter-models"
              defaultValue={editing.modelSlug}
              dir="ltr"
              className="text-left"
              placeholder="anthropic/claude-sonnet-5"
              readOnly={Boolean(editing.id)}
            />
            {editing.id ? <HelpText>شناسه مدل ذخیره‌شده قابل تغییر نیست.</HelpText> : null}
          </div>
          <div>
            <Label htmlFor="displayName">نام نمایشی</Label>
            <Input id="displayName" name="displayName" defaultValue={editing.displayName} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">توضیح کوتاه</Label>
            <Textarea
              id="description"
              name="description"
              className="min-h-20"
              defaultValue={editing.description ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              name="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              defaultValue={editing.temperature}
              dir="ltr"
              className="text-left"
            />
          </div>
          <div>
            <Label htmlFor="maxTokens">حداکثر توکن پاسخ</Label>
            <Input
              id="maxTokens"
              name="maxTokens"
              type="number"
              min="256"
              defaultValue={editing.maxTokens}
              dir="ltr"
              className="text-left"
            />
          </div>
          <div>
            <Label htmlFor="order">ترتیب نمایش</Label>
            <Input
              id="order"
              name="order"
              type="number"
              defaultValue={editing.order}
              dir="ltr"
              className="text-left"
            />
          </div>
          <div className="flex items-end gap-6 pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={editing.isActive} />
              فعال
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDefault" defaultChecked={editing.isDefault} />
              پیش‌فرض
            </label>
          </div>
        </div>

        {saveState ? (
          <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert>
        ) : null}

        <SubmitButton>{editing.id ? "ذخیره تغییرات" : "افزودن مدل"}</SubmitButton>
      </form>

      {editing.id && !editing.isDefault ? (
        <form action={deleteAction} className="mt-6 border-t border-border pt-6">
          <input type="hidden" name="id" value={editing.id} />
          {deleteState ? (
            <Alert tone={deleteState.ok ? "success" : "danger"} className="mb-4">
              {deleteState.message}
            </Alert>
          ) : null}
          <SubmitButton variant="danger" size="sm" confirm="این مدل حذف شود؟">
            حذف مدل
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
