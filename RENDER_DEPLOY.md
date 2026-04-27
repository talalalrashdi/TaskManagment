# نشر TechFlowPM على Render

الإعداد الحالي في `render.yaml` مخصص للنشر المستقر كالتالي:

1. `techflowpm-web`
   - واجهة Next.js
2. `techflowpm-api`
   - API بـ .NET 8
3. قاعدة البيانات:
   - **SQL Server خارجي**
   - مثل Azure SQL أو SQL Server على VPS / VM

## لماذا أزلنا SQL Server من Render؟

التجارب السابقة أوضحت أن تشغيل صورة SQL Server 2022 كخدمة خاصة على Render غير مستقر في هذا المشروع:

- تعارضات صلاحيات مع صورة `mssql/server`
- تعثر الإقلاع قبل فتح المنفذ
- فشل deploy قبل أن تصل الواجهة والـ API إلى حالة مستقرة

لذلك المسار العملي الآن:

- Render للواجهة والـ API
- SQL Server خارجي

## الخدمات الموجودة في `render.yaml`

- `techflowpm-api`
- `techflowpm-web`

## متغيرات البيئة المطلوبة للـ API

في خدمة `techflowpm-api` داخل Render أضف القيم التالية:

- `SqlServer__Host`
- `SqlServer__Port`
  - غالباً `1433`
- `SqlServer__Database`
- `SqlServer__User`
- `SqlServer__Password`

ومتغيرات أخرى موجودة مسبقاً في `render.yaml`:

- `Jwt__Issuer`
- `Jwt__Audience`
- `Jwt__Key`
- `Encryption__Key`
- `Encryption__IV`

## متغيرات البيئة للواجهة

في خدمة `techflowpm-web`:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SIGNALR_URL`
- `NEXT_PUBLIC_BYPASS_AUTH`

## خطوات النشر

1. ارفع المشروع إلى GitHub.
2. افتح Render Dashboard.
3. اختر:
   - `New`
   - `Blueprint`
4. اربط المستودع الذي يحتوي على `render.yaml`.
5. أثناء إعداد `techflowpm-api` أدخل معلومات SQL Server الخارجي.
6. أكمل إنشاء الخدمات.

## قيم مثال

إذا كانت قاعدة البيانات في Azure SQL:

- `SqlServer__Host=your-server.database.windows.net`
- `SqlServer__Port=1433`
- `SqlServer__Database=TechFlowPM`
- `SqlServer__User=your-admin-user`
- `SqlServer__Password=your-strong-password`

## ملاحظات مهمة

- الواجهة الآن تُبنى من:
  - `techflowpm-web-render`
  لأن `techflowpm-web` الأصلي مستودع Git متداخل وليس مناسباً مباشرة لسحب Render من المستودع الرئيسي.
- وضع bypass auth ما زال مفعلاً لتسهيل أول تشغيل.
- إذا أردت وضع إنتاج لاحقاً:
  - `Authentication__BypassEnabled=false`
  - `NEXT_PUBLIC_BYPASS_AUTH=false`
