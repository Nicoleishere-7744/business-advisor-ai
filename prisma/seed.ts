import { PrismaClient } from "@prisma/client";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE } from "../src/lib/ai/prompt";
import { normalizePhone } from "../src/lib/phone";
import { SETTING_KEYS } from "../src/lib/constants";

// داده اولیه: ادمین‌ها، فیلدهای فرم، پرامپت پیش‌فرض، مدل‌های AI و تنظیمات پایه.
// این اسکریپت idempotent است و می‌توان چند بار اجرایش کرد.

const prisma = new PrismaClient();

const FORM_FIELDS = [
  {
    key: "business_name",
    label: "نام کسب‌وکار",
    type: "text",
    placeholder: "مثلاً: فروشگاه اینترنتی آوا",
    required: true,
    maxLength: 120,
    order: 1,
  },
  {
    key: "industry",
    label: "صنعت / حوزه فعالیت",
    type: "select",
    required: true,
    order: 2,
    options: [
      "خرده‌فروشی و فروشگاه اینترنتی",
      "خدمات و مشاوره",
      "تولید و صنعت",
      "نرم‌افزار و فناوری",
      "غذا و رستوران",
      "آموزش",
      "سلامت و زیبایی",
      "گردشگری",
      "ساختمان و املاک",
      "سایر",
    ],
  },
  {
    key: "stage",
    label: "مرحله رشد کسب‌وکار",
    type: "select",
    required: true,
    order: 3,
    options: [
      "ایده اولیه (هنوز شروع نکرده‌ام)",
      "تازه شروع شده (کمتر از یک سال)",
      "در حال رشد (۱ تا ۳ سال)",
      "تثبیت‌شده (بیش از ۳ سال)",
      "در حال افت یا توقف رشد",
    ],
  },
  {
    key: "team_size",
    label: "تعداد کارکنان",
    type: "number",
    placeholder: "مثلاً: 5",
    required: true,
    minValue: 0,
    maxValue: 100000,
    order: 4,
  },
  {
    key: "target_market",
    label: "بازار و مشتری هدف",
    type: "textarea",
    placeholder: "مشتری اصلی شما چه کسی است؟ در چه شهر یا بازاری فعالیت می‌کنید؟",
    required: true,
    minLength: 10,
    maxLength: 1000,
    order: 5,
  },
  {
    key: "monthly_revenue",
    label: "درآمد ماهانه تقریبی (تومان)",
    type: "select",
    required: true,
    order: 6,
    options: [
      "هنوز درآمدی ندارم",
      "زیر ۱۰ میلیون",
      "۱۰ تا ۵۰ میلیون",
      "۵۰ تا ۲۰۰ میلیون",
      "۲۰۰ میلیون تا ۱ میلیارد",
      "بیش از ۱ میلیارد",
    ],
  },
  {
    key: "sales_channels",
    label: "کانال‌های فروش و بازاریابی فعلی",
    type: "multiselect",
    required: true,
    order: 7,
    helpText: "هر تعداد که استفاده می‌کنید را انتخاب کنید.",
    options: [
      "فروشگاه حضوری",
      "وب‌سایت اختصاصی",
      "اینستاگرام",
      "تلگرام",
      "دیجی‌کالا و مارکت‌پلیس‌ها",
      "تبلیغات گوگل",
      "معرفی مشتریان قبلی",
      "فروش سازمانی / B2B",
      "هیچ‌کدام",
    ],
  },
  {
    key: "competitors",
    label: "رقبای اصلی",
    type: "textarea",
    placeholder: "نام یا توضیح مختصر رقبای اصلی و نقطه تمایز آن‌ها",
    required: false,
    maxLength: 1000,
    order: 8,
  },
  {
    key: "main_challenge",
    label: "بزرگ‌ترین چالش فعلی",
    type: "textarea",
    placeholder: "مهم‌ترین مشکلی که الان جلوی رشد شما را گرفته چیست؟",
    required: true,
    minLength: 15,
    maxLength: 1500,
    order: 9,
  },
  {
    key: "six_month_goal",
    label: "هدف شش ماه آینده",
    type: "textarea",
    placeholder: "دوست دارید تا شش ماه آینده به چه چیزی برسید؟ (ترجیحاً با عدد)",
    required: true,
    minLength: 10,
    maxLength: 1000,
    order: 10,
  },
] as const;

const AI_MODELS = [
  {
    modelSlug: "openai/gpt-4o-mini",
    displayName: "GPT-4o mini",
    description: "کم‌هزینه و سریع — پیش‌فرض فعلی",
    temperature: 0.7,
    maxTokens: 4000,
    isDefault: true,
    order: 1,
  },
  {
    modelSlug: "anthropic/claude-sonnet-5",
    displayName: "Claude Sonnet 5",
    description: "کیفیت تحلیل بالاتر با هزینه بیشتر",
    temperature: 0.7,
    maxTokens: 6000,
    isDefault: false,
    order: 2,
  },
  {
    modelSlug: "google/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    description: "سریع و ارزان",
    temperature: 0.7,
    maxTokens: 4000,
    isDefault: false,
    order: 3,
  },
];

async function seedAdmins() {
  const raw = process.env.ADMIN_PHONES ?? "";
  const phones = raw
    .split(",")
    .map((item) => normalizePhone(item.trim()))
    .filter((item): item is string => item !== null);

  if (phones.length === 0) {
    console.log("• ADMIN_PHONES خالی است؛ هیچ ادمینی ساخته نشد.");
    return;
  }

  for (const phone of phones) {
    await prisma.user.upsert({
      where: { phone },
      create: { phone, role: "admin", fullName: "مدیر سیستم" },
      update: { role: "admin" },
    });
    console.log(`• ادمین آماده شد: ${phone}`);
  }
}

async function seedFormFields() {
  for (const field of FORM_FIELDS) {
    const options = "options" in field && field.options ? [...field.options] : null;
    const data = {
      label: field.label,
      type: field.type,
      placeholder: "placeholder" in field ? field.placeholder : null,
      helpText: "helpText" in field ? field.helpText : null,
      optionsJson: options
        ? JSON.stringify(options.map((option) => ({ value: option, label: option })))
        : null,
      required: field.required,
      minLength: "minLength" in field ? field.minLength : null,
      maxLength: "maxLength" in field ? field.maxLength : null,
      minValue: "minValue" in field ? field.minValue : null,
      maxValue: "maxValue" in field ? field.maxValue : null,
      order: field.order,
      isActive: true,
    };

    await prisma.formField.upsert({
      where: { key: field.key },
      create: { key: field.key, ...data },
      // فقط فیلدهای تازه ساخته می‌شوند؛ ویرایش‌های ادمین بازنویسی نمی‌شود
      update: {},
    });
  }
  console.log(`• ${FORM_FIELDS.length} فیلد فرم آماده شد.`);
}

async function seedPrompt() {
  const existing = await prisma.promptTemplate.findFirst();
  if (existing) {
    console.log("• قالب پرامپت از قبل وجود دارد؛ دست‌نخورده ماند.");
    return;
  }
  await prisma.promptTemplate.create({
    data: {
      name: "قالب پیش‌فرض مشاوره کسب‌وکار",
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userTemplate: DEFAULT_USER_TEMPLATE,
      isActive: true,
    },
  });
  console.log("• قالب پرامپت پیش‌فرض ساخته شد.");
}

async function seedModels() {
  for (const model of AI_MODELS) {
    await prisma.aiModelConfig.upsert({
      where: { modelSlug: model.modelSlug },
      create: model,
      update: {},
    });
  }
  console.log(`• ${AI_MODELS.length} مدل هوش مصنوعی آماده شد.`);
}

async function seedSettings() {
  const defaults: Array<[string, string]> = [
    [SETTING_KEYS.consultationPriceRial, "2900000"],
    [SETTING_KEYS.followupMessageLimit, "5"],
    [SETTING_KEYS.platformName, "مشاور کسب‌وکار"],
    [SETTING_KEYS.supportPhone, ""],
  ];

  for (const [key, value] of defaults) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value, isSecret: false },
      update: {},
    });
  }
  console.log("• تنظیمات پایه آماده شد.");
}

async function main() {
  console.log("شروع seed …");
  await seedAdmins();
  await seedFormFields();
  await seedPrompt();
  await seedModels();
  await seedSettings();
  console.log("seed با موفقیت تمام شد.");
}

main()
  .catch((error) => {
    console.error("seed ناموفق بود:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
