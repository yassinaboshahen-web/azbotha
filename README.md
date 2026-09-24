# صاحب يومك · Day Companion

تطبيق ذكي وهادي بيبسطلك يومك ويجاوبك على سؤال: إيه اللي ورايا؟

## خطوات بناء تطبيق الأندرويد (APK):

1. **تثبيت الاعتمادات:**
   ```bash
   npm install
   ```

2. **بناء المشروع ودمجه مع أندرويد:**
   ```bash
   npm run build:android
   ```

3. **فتح المشروع في Android Studio:**
   ```bash
   npx cap open android
   ```

4. **من داخل Android Studio:**
   - استنّى Gradle يخلص تحميل.
   - من القائمة العلوية اختر: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - بعد ما يخلص، هيظهر إشعار، دوس على **locate** عشان تلاقي ملف الـ APK.
