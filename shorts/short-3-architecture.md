# 🎬 شورتز ۳ — «بدون N+1؛ سرعتی که حس می‌شه»

> تایم‌کد کلی: ۵۵–۶۰ ثانیه | نسبت ابعاد: 9:16 | تامبنیل: `thumbnails/thumb-3.png`

---

## 📌 Title (برای کپی)

```
🚀 فول‌استک Next.js 16 که N+1 نداره! | Drizzle + Supabase در عمل #shorts
```

## 📝 Description (برای کپی)

```
چرا این پروژه «بانک سؤال» برای مصاحبه استخدامی می‌درخه؟ چون معماریش مهندسی‌شده‌ست ⚡

• همه‌جا Server Components؛ جاوااسکریپت کلاینت فقط برای ویجت‌های تعاملی
• Server Action + Zod برای ورودی‌ها — بدون API route دستی
• drizzle-kit push برای اسکیما، seed برای دیتای دمو، Supabase = Postgres واقعی
• کش: unstable_cache + revalidateTag برای داده‌های داغ
• KPIهای داشبورد با یک کوئری aggregate (count + filter) ساخته می‌شن — صفر N+1
• pagination/جست‌وجوی سمت سرور با input debounce + Index روی همه مسیرهای داغ

🛠 استک: Next.js 16 • React 19 • Drizzle ORM • PostgreSQL (Supabase) • Tailwind CSS 4 • TypeScript

🎓 آموزش کامل این معماری — همین هفته در کانال:
https://www.youtube.com/@sanidev-web

#nextjs #drizzle #supabase #برنامه_نویسی #تایپ_اسکریپت
```

## 🏷 Tags (برای کپی)

```
next.js 16, drizzle orm, supabase, postgresql, tailwind css 4, typescript, react 19, server components, server actions, unstable_cache, n+1 problem, بهینه سازی, پرفورمنس وب, معماری نرم افزار, آموزش نکست, فول استک, fullstack project, prisma جایگزین, sanidev, سانی دول, آموزش برنامه نویسی, پروژه عملی
```

---

## 🎥 اسکریپت ضبط (ثانیه‌به‌ثانیه)

| زمان | تصویر | نریشن / متن روی تصویر |
|---|---|---|
| ۰–۵s | لود سریع صفحه `/` بعد از hard refresh — زیر ۱ ثانیه | **هوک:** «این پروژه فول‌استک Next.js 16 ایه که توش N+1 کوئری نداری؛ بذار ثابتش کنم» |
| ۵–۱۵s | `src/app/page.tsx` — هایلایت `unstable_cache(..., tags: ["quizzes"])` | «همه‌چیز Server Component‌ه؛ کش با unstable_cache و با revalidateTag خودش باطل می‌شه — نه fetch دستی.» |
| ۱۵–۲۵s | `src/app/admin/page.tsx` — همون کوئری واحد aggregate با `count(*) filter` | «داشبورد آنالیتیکس؟ همه KPIها — کاربر، آزمون منتشرشده، میانگین نمره، صف تصحیح — توی یک کوئری aggregate حساب می‌شن؛ صفر N+1.» |
| ۲۵–۳۵s | `src/db/schema.ts` — هایلایت خط‌های `index(...)` | «روی هر مسیر داغ index گذاشتیم: سشن‌ها، وضعیت پاسخ‌ها، دسته‌بندی سؤالات. درایور pg با pool.» |
| ۳۵–۴۵s | `src/actions/admin.ts` → `revalidateTag("quizzes", "max")` بعد از ویرایش آزمون | «ادمین آزمون رو منتشر می‌کنه؟ با یه revalidateTag کشش داغ می‌شه. معماری تمیز یعنی همین.» |
| ۴۵–۶۰s | ترمینال: `npm run db:push` → `npm run seed` → `npm run dev` (هر سه با تیک سبز) | «و دیپلوی روی Supabase با یک فایل schema.sql. کل این خط لاین رو همین هفته توی کانال آموزش دادم → @sanidev-web» |

### متن‌های روی تصویر (CapCut)
- «N+1 = ۰ ✅»
- «RSC + Server Actions»
- «unstable_cache + revalidateTag»
- «Aggregate SQL به‌جای ۱۰ تا کوئری»
- «آموزش کامل ← @sanidev-web»

### 💡 نکته
برای صحنه سرعت، Network Throttling رو روی Fast 3G بذار و after-cache vs before-cache رو کنار هم split-screen کن — کنتراست بصری خوبیه برای شورتز.
