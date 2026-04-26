# نشر TechFlowPM على Render

هذا المشروع مجهز للنشر عبر Render Blueprint باستخدام الملف:

- `render.yaml`

الخدمات التي سيتم إنشاؤها:

1. `techflowpm-web`
   - واجهة Next.js
2. `techflowpm-api`
   - API بـ .NET 8
3. `techflowpm-sqlserver`
   - SQL Server كخدمة داخلية خاصة

## ملاحظات مهمة

- هذا الإعداد مناسب جداً للتجربة والرفع السريع.
- لبيئة إنتاج مستقرة على المدى الطويل، الأفضل استخدام SQL Server مُدار خارج Render أو نقل المشروع إلى Postgres.
- خدمة `techflowpm-sqlserver` يجب أن تكون على الأقل `standard` في Render.
  - SQL Server على Linux يحتاج حدًا أدنى `2 GB` من الذاكرة لبدء التشغيل.
  - خطة `starter` في Render توفر `512 MB` فقط، لذلك غالباً ستفشل الخدمة عند الإقلاع.
- خدمة SQL Server في هذا الإعداد تعمل كمستخدم `root` داخل الحاوية.
  - السبب هو تفادي مشاكل صلاحيات الكتابة على القرص الدائم mounted disk عند تشغيل صورة SQL Server الحديثة كمستخدم non-root.
- إذا غيّرت أسماء الخدمات، حدّث هذه القيم داخل `render.yaml`:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_SIGNALR_URL`
  - `Cors__AllowedOrigins__0`

## خطوات الرفع

1. ارفع المشروع إلى GitHub.
2. افتح Render Dashboard.
3. اختر:
   - `New`
   - `Blueprint`
4. اربط المستودع الذي يحتوي على `render.yaml`.
5. أثناء الإنشاء سيطلب منك Render قيمة:
   - `MSSQL_SA_PASSWORD`
6. استخدم كلمة مرور قوية تحقق متطلبات SQL Server.
7. أكمل إنشاء الـ Blueprint.

## إذا ظهر فشل عند إنشاء SQL Server

افحص هذين الأمرين أولاً:

1. قيمة `MSSQL_SA_PASSWORD`
   - يجب أن تحقق متطلبات SQL Server لكلمة مرور المستخدم `sa`.
2. الخطة المستخدمة
   - يجب أن تبقى خدمة `techflowpm-sqlserver` على `standard` أو أعلى.

## بعد أول Deploy

تحقق من الروابط التالية:

- الواجهة:
  - `https://techflowpm-web.onrender.com`
- الـ API:
  - `https://techflowpm-api.onrender.com`

اختبر نقطة الصحة:

- `https://techflowpm-api.onrender.com/`

يجب أن تعيد استجابة تحتوي على:

- `TechFlow PM API`

## وضع الدخول الحالي

حالياً ملف `render.yaml` مضبوط على وضع تجريبي لتسهيل أول تشغيل:

- `Authentication__BypassEnabled=true`
- `NEXT_PUBLIC_BYPASS_AUTH=true`

إذا أردت إطلاقاً فعلياً:

1. غيّر في Render:
   - `Authentication__BypassEnabled=false`
   - `NEXT_PUBLIC_BYPASS_AUTH=false`
2. أعد النشر.

## إعدادات يمكن تعديلها لاحقاً

- خطة الخدمة `plan`
- حجم القرص `sizeGB` لخدمة SQL Server
- دومين مخصص للواجهة أو الـ API

## ملاحظات تقنية

- الـ API أصبح يدعم تركيب الاتصال بقاعدة البيانات من متغيرات منفصلة:
  - `SqlServer__Host`
  - `SqlServer__Port`
  - `SqlServer__Database`
  - `SqlServer__User`
  - `SqlServer__Password`
- تمت إضافة retry logic عند تهيئة قاعدة البيانات حتى لا يفشل الإقلاع إذا تأخر SQL Server لبضع ثوانٍ.
