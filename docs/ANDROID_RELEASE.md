# دليل إصدار تطبيقات الأندرويد لـ "صاحب يومك" (Android Production Release Guide)

يوضح هذا الدليل الخطوات والإعدادات الكاملة لتجهيز وبناء تطبيق **"صاحب يومك"** لإنتاج حزمة إنتاجية حقيقية (APK و AAB) عبر Capacitor و Android Studio.

---

## 1. معلومات الهوية والتطبيق (Application Identity)
- **App Name:** صاحب يومك
- **Application ID (Package Name):** `com.sahebyomak.daycompanion`
- **Version Name:** `1.0.0`
- **Version Code:** `1`
- **Minimum SDK:** 22 (أو حسب إعدادات Capacitor)
- **Target SDK:** 34+ (متوافق مع أحدث معايير Google Play)

---

## 2. الصلاحيات والميزات الأساسية في AndroidManifest.xml
التطبيق يشتمل على الصلاحيات التالية مع المعالجة الكاملة:
- `POST_NOTIFICATIONS`: لإرسال الإشعارات على Android 13+.
- `SCHEDULE_EXACT_ALARM`: لجدولة التنبيهات بدقة تامة في مواعيدها.
- `RECEIVE_BOOT_COMPLETED`: لإعادة جدولة التنبيهات تلقائياً عند إعادة تشغيل الهاتف.
- `VIBRATE` & `INTERNET`: للدعم الفوري والمزامنة.

---

## 3. التعامل مع التنبيهات والوقت (Notifications & ReminderEngine)
- **Idempotent Reminders:** منع تكرار نفس التنبيه مع تنظيف التنبيهات القديمة عند التعديل أو الحذف أو الإلغاء.
- **Tz/Cairo Timezone:** معالجة التواريخ والأوقات بتوقيت مصر (`Africa/Cairo`) مع بداية الأسبوع من يوم **السبت**.
- **Exact Alarms & Do Not Disturb:** دعم التنبيهات الدقيقة والموثوقة في الخلفية والأجهزة المقفلة.

---

## 4. خطوات البناء المحلي وإنتاج الـ APK / AAB

### الخطوة 1: بناء ملفات الـ Web (Frontend Build)
```bash
npm run build
```

### الخطوة 2: مزامنة مشروع Capacitor مع الأندرويد
```bash
npx cap sync android
```

### الخطوة 3: فتح مشروع Android Studio
```bash
npx cap open android
```
أو فتح مجلد `android` داخل Android Studio مباشرة.

### الخطوة 4: توقيع وتصدير النسخة (Release Signing)
لإنتاج **Release APK** أو **AAB** موقّع لـ Google Play:
1. في Android Studio، اذهب إلى القائمة العلوية: **Build > Generate Signed Bundle / APK**.
2. اختر **Android App Bundle (AAB)** (مطلوب لمتجر جوجل) أو **APK** (للتوزيع المباشر).
3. أنشئ KeyStore جديد (أو استخدم KeyStore موجود):
   - **Key store path:** مسار ملف الـ `.jks`
   - **Password:** كلمة مرور قوية
   - **Key alias:** `key0`
   - **Validity:** 25 سنة على الأقل
4. اختر Build Variant: **release**.
5. انقر **Finish** لإنتاج الحزمة الإنتاجية في مجلد `android/app/release/`.

---

## 5. الأمان وحماية الأسرار (Security & Secrets Policy)
- **لا توجد أسرار في الـ APK:** رموز الاتصال وقاعدة البيانات وTurso auth tokens موجودة حصريًا في الخادم (Backend / Server-side) ولا يتم كشفها أبداً في الواجهة الأمامية أو تطبيقات الجوال.
- **Production API URL:** يتم ضبط عنوان الـ API الإنتاجي فقط في متغيرات البيئة الآمنة (`VITE_API_URL`).
