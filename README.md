# مهمة التوصيل — Delivery Management System

> نظام إدارة تشغيلي متكامل للمناديب والحضور والرواتب والطلبات، مبني بـ React + TypeScript + Supabase.

---

## الفهرس

- [نظرة عامة](#نظرة-عامة)
- [المكدس التقني](#المكدس-التقني)
- [المعمارية](#المعمارية)
- [الصفحات والمسارات](#الصفحات-والمسارات)
- [نظام الصلاحيات](#نظام-الصلاحيات)
- [هيكل المشروع](#هيكل-المشروع-الكود-المصدر-الحالي)
- [نظام التصميم](#نظام-التصميم)
- [المتغيرات البيئية](#المتغيرات-البيئية)
- [تشغيل المشروع](#تشغيل-المشروع)
- [توثيق الصيانة (docs/)](#توثيق-الصيانة-docs)

---

## نظرة عامة

**مهمة التوصيل** هو تطبيق ويب أحادي الصفحة (SPA) يُستخدم لإدارة عمليات توصيل الطلبات بشكل يومي. يوفر النظام:

- **لوحة تحكم ذكية** تعرض تحليلات الحضور، الطلبات، والأداء في الوقت الفعلي
- **إدارة الموظفين** مع بيانات الإقامة، الرخص، الكفالة، والرواتب
- **تسجيل الحضور** اليومي والشهري مع فلترة حسب المنصة
- **إدارة الرواتب** والسلف والخصومات
- **دعم ثنائي اللغة** (العربية RTL + الإنجليزية LTR) مع وضع مظلم/فاتح

---

## المكدس التقني

| الطبقة | التقنية |
|---|---|
| الواجهة | React 18 + TypeScript + Vite |
| التصميم | Tailwind CSS + shadcn/ui |
| قاعدة البيانات | PostgreSQL عبر Supabase |
| المصادقة | Supabase Auth + RLS |
| التخزين | Supabase Storage (مستندات خاصة) |
| الترجمة | i18next (العربية / الإنجليزية) |
| المنفذ | 5000 |

> **ملاحظة:** لا يوجد سيرفر خاص — Supabase يتولى كل منطق الخلفية عبر سياسات RLS.

---

## المعمارية

راجع **`docs/ARCHITECTURE.md`** لمخطط الطبقات (صفحات → hooks → services → Supabase) وقواعد React Query والأسماء المختصرة (`@app`, `@services`, `@modules`, `@shared`).

**للمطورين المستلمين:** ابدأ من **`docs/HANDOVER.md`** ثم **`docs/CONTRIBUTING.md`** — فهرس كامل في **`docs/README.md`**.

---

## الصفحات والمسارات

| المسار | الصفحة | الوصف |
|---|---|---|
| `/` | Dashboard | لوحة التحكم (تبويبي: نظرة عامة + تحليلات) |
| `/employees` | Employees | إدارة الموظفين — البيانات، الإقامة، الرخص، الكفالة |
| `/attendance` | Attendance | الحضور اليومي والشهري والأرشيف |
| `/orders` | Orders | الطلبات اليومية |
| `/salaries` | Salaries | الرواتب الشهرية |
| `/advances` | Advances | السلف والاستقطاعات |
| `/fuel` | Fuel | سجل الوقود |
| `/motorcycles` | Motorcycles | إدارة المركبات |
| `/vehicle-assignment` | Vehicle Assignment | تخصيص المركبات للموظفين |
| `/apps` | Apps | إدارة منصات التوصيل |
| `/alerts` | Alerts | تنبيهات النظام |
| `/reports` | Reports | مركز التقارير (تصدير Excel) |
| `/employee-tiers` | Employee Tiers | مستويات المناديب |
| `/violation-resolver` | Violation Resolver | حل المخالفات |
| `/settings` | SettingsHub | الإعدادات الكاملة (نظام، منشأة، مستخدمين، رواتب، سجل نشاط، الملف الشخصي) |

---

## نظام الصلاحيات

خمسة أدوار مدمجة تتحكم في وصول كل مستخدم:

| الدور | الصلاحية |
|---|---|
| `admin` | وصول كامل — إدارة المستخدمين والإعدادات |
| `hr` | الموظفون + الحضور + الرواتب + السلف |
| `finance` | الرواتب + السلف + التقارير المالية |
| `operations` | الطلبات + الحضور + المركبات |
| `viewer` | قراءة فقط لجميع الأقسام |

---

## هيكل المشروع (الكود المصدري الحالي)

الواجهة الأمامية تحت **`frontend/`** (وليس `src/` في المستودع الحالي):

| المجلد | المحتوى |
|--------|---------|
| `frontend/app/` | الراوتر، `App.tsx`، المزودين (Auth، اللغة، الثيم، إعدادات النظام) |
| `frontend/modules/` | صفحات المسارات (Dashboard، Employees، …) |
| `frontend/shared/` | مكونات مشتركة، hooks، `lib`، واجهات مساعدة |
| `frontend/services/` | طبقة الوصول لـ Supabase ومعالجة الأخطاء |

تفاصيل للصيانة: **`docs/HANDOVER.md`** و **`docs/ARCHITECTURE.md`**.

---

## نظام التصميم

### الألوان الأساسية

| الاستخدام | القيمة |
|---|---|
| Primary | `#2642e6` |
| Primary Container | `#465fff` |
| Surface (صفحة) | `#f9f9fb` |
| Surface Lowest (بطاقات) | `#ffffff` |
| Surface Low (شريط جانبي) | `#f3f3f5` |
| On-Surface (نص رئيسي) | `#1a1c1d` |
| On-Surface Variant (نص ثانوي) | `#444656` |

### قواعد التصميم

- **الخط:** IBM Plex Sans Arabic
- **البطاقات:** `bg-white rounded-2xl shadow-card` — بدون `border` (استخدم تدرجات الخلفية)
- **الظل:** `0px 10px 40px rgba(26,28,29,0.06)` → `shadow-card`
- **الشريط الجانبي:** العنصر النشط = gradient pill `linear-gradient(135deg, #2642e6, #465fff)`
- **الهيدر:** glass morphism — `rgba(255,255,255,0.85)` + `backdrop-filter: blur(12px)`

### فئات CSS المساعدة الجاهزة

```css
.ds-card          /* بطاقة قياسية */
.ta-table-wrap    /* غلاف الجداول */
.badge-success    /* شارة خضراء */
.badge-urgent     /* شارة حمراء */
.badge-warning    /* شارة صفراء */
.page-title       /* عنوان الصفحة */
.page-breadcrumb  /* مسار التنقل */
```

---

## المتغيرات البيئية

استخدم ملفات مثل `.env` / `.env.local` تحت **`frontend/`** (غير مرفوعة في Git) — انسخ من **`frontend/.env.example`**.  
التفاصيل: **`docs/ENV.md`**.  
عميل Supabase في **`frontend/services/supabase/client.ts`** ينظّف القيم (مثل إزالة الاقتباس الزائد) ويُنبّه في الإنتاج إذا كان الرابط يبدو محلياً.

---

## تشغيل المشروع

من **جذر المستودع**:

```bash
npm install
npm run dev
```

أو من **`frontend/`**: `npm install` ثم `npm run dev` (المنفذ الافتراضي **5000**).

```bash
npm run build
```

---

## توثيق الصيانة (docs/)

| الملف | الاستخدام |
|-------|-----------|
| [`docs/HANDOVER.md`](docs/HANDOVER.md) | تسليم للمطور الجديد: تشغيل، مجلدات، ملفات أولية |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | طبقات البيانات، aliases، قواعد React Query |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | قواعد قبل التعديل والمراجعة |
| [`docs/ENV.md`](docs/ENV.md) | متغيرات Supabase، محلي مقابل Vercel |
| [`docs/README.md`](docs/README.md) | فهرس التوثيق |
| [`CHANGELOG.md`](CHANGELOG.md) | سجل تغييرات موجزة للمشروع |
| [`.github/pull_request_template.md`](.github/pull_request_template.md) | قالب وصف الـ PR على GitHub |

---

<div align="center">
  <sub>مبني بـ React 18 · TypeScript · Vite · Supabase · Tailwind CSS</sub>
</div>
