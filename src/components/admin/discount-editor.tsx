"use client";

import { useActionState, useState } from "react";
import { Alert, Card, CardHeader, HelpText, Input, Label, Select } from "@/components/ui";
import { SubmitButton } from "@/components/admin/action-form";
import { deleteDiscount, saveDiscount } from "@/app/admin/actions";

// ساخت و ویرایش کد تخفیف

type DiscountRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  minAmount: number;
  maxUses: number | null;
  expiresAt: string;
  isActive: boolean;
};

const EMPTY: DiscountRow = {
  id: "",
  code: "",
  type: "percent",
  value: 20,
  minAmount: 0,
  maxUses: null,
  expiresAt: "",
  isActive: true,
};

export function DiscountEditor({ discounts }: { discounts: DiscountRow[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [saveState, saveAction] = useActionState(saveDiscount, null);
  const [deleteState, deleteAction] = useActionState(deleteDiscount, null);

  const editing = discounts.find((discount) => discount.id === selectedId) ?? EMPTY;
  const [type, setType] = useState(editing.type);

  function select(id: string) {
    setSelectedId(id);
    setType(discounts.find((discount) => discount.id === id)?.type ?? "percent");
  }

  return (
    <Card>
      <CardHeader
        title={editing.id ? `ویرایش کد ${editing.code}` : "کد تخفیف جدید"}
        action={
          <Select value={selectedId} onChange={(event) => select(event.target.value)} className="w-56">
            <option value="">+ کد جدید</option>
            {discounts.map((discount) => (
              <option key={discount.id} value={discount.id}>
                {discount.code}
              </option>
            ))}
          </Select>
        }
      />

      <form key={editing.id || "new"} action={saveAction} className="space-y-5">
        <input type="hidden" name="id" value={editing.id} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="code">کد</Label>
            <Input
              id="code"
              name="code"
              defaultValue={editing.code}
              dir="ltr"
              className="text-left uppercase"
              placeholder="WELCOME"
              readOnly={Boolean(editing.id)}
            />
            {editing.id ? <HelpText>کد ساخته‌شده قابل تغییر نیست.</HelpText> : null}
          </div>
          <div>
            <Label htmlFor="type">نوع تخفیف</Label>
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="percent">درصدی</option>
              <option value="amount">مبلغ ثابت (ریال)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="value">{type === "percent" ? "درصد تخفیف" : "مبلغ تخفیف (ریال)"}</Label>
            <Input
              id="value"
              name="value"
              type="number"
              defaultValue={editing.value}
              dir="ltr"
              className="text-left"
            />
          </div>
          <div>
            <Label htmlFor="minAmount">حداقل مبلغ سفارش (ریال)</Label>
            <Input
              id="minAmount"
              name="minAmount"
              type="number"
              defaultValue={editing.minAmount}
              dir="ltr"
              className="text-left"
            />
          </div>
          <div>
            <Label htmlFor="maxUses">سقف تعداد استفاده</Label>
            <Input
              id="maxUses"
              name="maxUses"
              type="number"
              defaultValue={editing.maxUses ?? ""}
              dir="ltr"
              className="text-left"
              placeholder="خالی = نامحدود"
            />
          </div>
          <div>
            <Label htmlFor="expiresAt">تاریخ انقضا</Label>
            <Input
              id="expiresAt"
              name="expiresAt"
              type="date"
              defaultValue={editing.expiresAt}
              dir="ltr"
              className="text-left"
            />
            <HelpText>خالی یعنی بدون انقضا.</HelpText>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={editing.isActive} />
          فعال
        </label>

        {saveState ? (
          <Alert tone={saveState.ok ? "success" : "danger"}>{saveState.message}</Alert>
        ) : null}

        <SubmitButton>{editing.id ? "ذخیره تغییرات" : "ساخت کد"}</SubmitButton>
      </form>

      {editing.id ? (
        <form action={deleteAction} className="mt-6 border-t border-border pt-6">
          <input type="hidden" name="id" value={editing.id} />
          {deleteState ? (
            <Alert tone={deleteState.ok ? "success" : "danger"} className="mb-4">
              {deleteState.message}
            </Alert>
          ) : null}
          <SubmitButton variant="danger" size="sm" confirm="این کد تخفیف حذف شود؟">
            حذف کد
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
