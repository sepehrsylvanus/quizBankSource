# 🎬 شورتز ۲ — «با F12 هم نمی‌تونه تقلب کنه»

> تایم‌کد کلی: ۵۵–۶۰ ثانیه | نسبت ابعاد: 9:16 | تامبنیل: `thumbnails/thumb-2.png`

---

## 📌 Title (برای کپی)

```
😱 می‌خواد با F12 جوابا رو بدزده… ولی F12 خالیه! | امنیت Next.js + Supabase RLS #shorts
```

## 📝 Description (برای کپی)

```
سخت‌افزار امنیت این پروژه «بانک سؤال» رو ببین — اینا رو با F12 نمی‌تونی دور بزنی 🔒

• is_correct هیچ‌وقت به باندل کلاینت کاربر نمی‌ره؛ تصحیح صددرصد سمت سرور (Server Action) انجام می‌شه
• احراز هویت دستی ولی اصولی: هش پسورد با scrypt + مقایسه timingSafe + کوکی httpOnly (نه JWT توی localStorage!)
• سشن‌ها دیتابیس‌محورن → با یه DELETE می‌تونی همه‌جا لاگ‌اوت کنی
• روی Supabase: ۱۰ جدول با RLS، ویوی options_public که is_correct رو پنهان می‌کنه و تابع submit_quiz با SECURITY DEFINER
• ورودی‌ها همه با Zod ولیدیت می‌شن؛ دسترسی ادمین سمت سرور چک می‌شه (requireAdmin)

🎓 آموزش کامل این معماری — همین هفته در کانال:
https://www.youtube.com/@sanidev-web

#امنیت #supabase #nextjs #RLS #برنامه_نویسی #پروژه_عملی
```

## 🏷 Tags (برای کپی)

```
امنیت وب, supabase rls, row level security, next.js auth, server actions, httpOnly cookie, scrypt, zod validation, آموزش supabase, next.js 16, postgres, امنیت اپلیکیشن, فریمورک نکست, برنامه نویسی وب, پروژه فول استک, تقلب در آزمون آنلاین, sanidev, سانی دول, ریلز, آموزش برنامه نویسی
```

---

## 🎥 اسکریپت ضبط (ثانیه‌به‌ثانیه)

| زمان | تصویر | نریشن / متن روی تصویر |
|---|---|---|
| ۰–۵s | DevTools باز (F12) → تب Network → جست‌وجوی «is_correct» در پاسخ‌ها؛ صفر نتیجه | **هوک:** «کاربر F12 رو باز کرده دنبال جواب درست می‌گرده… هیچی پیدا نمی‌کنه، چون جواب هیچ‌وقت به مرورگرش نیومده 😳» |
| ۵–۱۵s | اسکرین `/take/[id]` → کات به `src/actions/quiz.ts` — بخش تصحیح سمت سرور | «اینجا تصحیح ۱۰۰٪ Server-side‌ست. UI فقط سؤال و گزینه‌ها رو می‌گیره؛ نمره سمت سرور حساب می‌شه.» |
| ۱۵–۲۵s | `supabase/schema.sql` — هایلایت `enable row level security` و پالیسی‌ها + ویوی `options_public` | «روی Supabase هم RLS روی همه جدول‌ها؛ حتی یه ویوی جدا ساختیم که is_correct فیلتر شده باشه.» |
| ۲۵–۳۵s | `src/lib/password.ts` (scrypt) + کوکی سشن در Application → Cookies (فید: `HttpOnly ✓`) | «لاگین؟ هش scrypt با salt و مقایسه timingSafe — بدون وابستگی خارجی؛ کوکی هم httpOnly که XSS دستش کوتاه بمونه.» |
| ۳۵–۴۵s | `schema.sql` تابع `submit_quiz` با SECURITY DEFINER | «تابع submit با SECURITY DEFINER نوشته شده تا حتی از API مستقیم هم نتونه تقلب کنه.» |
| ۴۵–۶۰s | زوم روی خروجی lint/build سبز + کارت CTA | «این ۴ تا ترفند امنیت رو توی آموزش کامل همین هفته خط‌به‌خط توضیح دادم → کانال @sanidev-web.» |

### متن‌های روی تصویر (CapCut)
- «F12 👻 — پاسخ‌ها: ❌ هیچی»
- «تصحیح فقط سمت سرور»
- «RLS روی ۱۰ جدول»
- «کوکی httpOnly + scrypt»
- «آموزش کامل ← @sanidev-web»

### 💡 نکته
صحنه DevTools رو حتماً واقعی رکورد کن (تب Network فیلتر `correct`) — همین یه شات، وایرال‌ترین بخش شورتز‌های امنیتیه.
