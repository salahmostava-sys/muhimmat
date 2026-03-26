# مهمة التوصيل — Delivery Management System

> نظام إدارة تشغيلي متكامل للمناديب والحضور والرواتب والطلبات، مبني بـ React + TypeScript + Supabase.

---

## الفهرس

- [نظرة عامة](#نظرة-عامة)
- [المكدس التقني](#المكدس-التقني)
- [المعمارية](#المعمارية)
- [الصفحات والمسارات](#الصفحات-والمسارات)
- [نظام الصلاحيات](#نظام-الصلاحيات)
- [هيكل المشروع](#هيكل-المشروع)
- [نظام التصميم](#نظام-التصميم)
- [المتغيرات البيئية](#المتغيرات-البيئية)
- [تشغيل المشروع](#تشغيل-المشروع)

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

راجع ملف `ARCHITECTURE.md` لمخطط النظام وطبقات الصلاحيات والاعتماد الكامل على Supabase كـ Backend وحيد.

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

## هيكل المشروع

```
src/
├── App.tsx                          # الراوتر الرئيسي + تحميل كسول للصفحات
├── main.tsx                         # نقطة الدخول
├── index.css                        # Tailwind + متغيرات نظام التصميم
│
├── components/
│   ├── AppLayout.tsx                # التخطيط العام مع الشريط الجانبي
│   ├── AppSidebar.tsx               # الشريط الجانبي القابل للطي (64px / 260px)
│   ├── attendance/                  # مكونات الحضور
│   ├── employees/                   # مكونات الموظفين
│   ├── settings/                    # مكونات الإعدادات
│   └── ui/                          # مكونات shadcn/ui الأساسية
│
├── context/
│   ├── AuthContext.tsx              # المصادقة + الدور
│   ├── LanguageContext.tsx          # تبديل العربية/الإنجليزية
│   ├── ThemeContext.tsx             # الوضع المظلم/الفاتح
│   └── SystemSettingsContext.tsx   # اسم المشروع والشعار من DB
│
├── hooks/
│   ├── usePermissions.ts           # فحص الصلاحيات بناءً على الدور
│   ├── useSignedUrl.ts             # روابط موقّعة لـ Supabase Storage
│   └── use-toast.ts                # نظام الإشعارات
│
├── pages/                           # صفحات كاملة (تحميل كسول)
│   ├── Dashboard.tsx
│   ├── Employees.tsx
│   ├── Attendance.tsx
│   ├── SettingsHub.tsx
│   └── settings-hub/               # محتوى تبويبات الإعدادات
│
├── integrations/supabase/
│   ├── client.ts                   # عميل Supabase (مع كشف ذكي للمتغيرات)
│   └── types.ts                    # أنواع TypeScript المُولَّدة تلقائياً من DB
│
└── i18n/
    └── index.ts                    # إعداد i18next (ترجمات العربية/الإنجليزية)
```

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

```

> يكتشف `src/integrations/supabase/client.ts` تلقائياً إذا تم تبديل المتغيرين بالخطأ ويصحّح الترتيب.

---

## تشغيل المشروع

```bash
# تثبيت الاعتماديات
npm install

# تشغيل خادم التطوير (المنفذ 5000)
npm run dev

# بناء الإنتاج
npm run build
```

---

<div align="center">
  <sub>مبني بـ React 18 · TypeScript · Vite · Supabase · Tailwind CSS</sub>
</div>
