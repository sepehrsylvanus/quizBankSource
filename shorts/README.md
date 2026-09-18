# 🎬 پکیج شورتز کانال @sanidev-web — سری «پروژه بانک سؤال»

چهار شورتز تبلیغاتی/آموزشی از ریپو «Quiz Bank — بانک سؤال» (Next.js 16 + Drizzle + Supabase + AI Grading).
هر فایل markdown شامل **اسکریپت ثانیه‌به‌ثانیه، متن روی تصویر، Title، Description و Tags آماده‌کپی** است.

| # | موضوع | تامبنیل | فایل |
|---|---|---|---|
| ۱ | ایجنت تصحیح هوش مصنوعی (نمره ۰–۱۰۰ + بازخورد فارسی + fallback آفلاین) | `thumbnails/thumb-1.png` | [short-1-ai-grading.md](./short-1-ai-grading.md) |
| ۲ | ضدتقلب و امنیت (بدون is_correct در کلاینت، RLS، httpOnly، scrypt) | `thumbnails/thumb-2.png` | [short-2-security.md](./short-2-security.md) |
| ۳ | معماری و پرفورمنس (RSC، Server Actions، بدون N+1، کش/ایندکس) | `thumbnails/thumb-3.png` | [short-3-architecture.md](./short-3-architecture.md) |
| ۴ | پنل ادمین کامل (Quiz Builder، صف تصحیح، درخواست‌ها، آنالیتیکس) | `thumbnails/thumb-4.png` | [short-4-admin-panel.md](./short-4-admin-panel.md) |

## انتشار پیشنهادی

- شنبه/یکشنبه: شورتز ۱ (وایرال‌خور بالا) — دوشنبه: ۲ — چهارشنبه: ۳ — پنجشنبه/جمعه: ۴ (CTA سری کامل)
- همه رو به پست «Community» و توضیقات ویدیوی اصلی لینک کن.
- یوتیوب شورتز تامبنیل سفارشی مستقیم ندارد؛ تامبنیل‌ها رو:
  1) ۰.۵ ثانیه اول هر شورتز بذار (فریم کاور)،
  2) در توییتر/تلگرام برای تبلیغ پست کن،
  3) سایز 1080×1920 برای کاور ویدیوی بلند هم قابل استفاده است.

## بازتولید/ویرایش تامبنیل‌ها

```bash
pip install pillow arabic-reshaper python-bidi   # یک‌بار
# فونت‌ها: Vazirmatn (از ریلیز v33.003) در ~/.fonts
python3 scripts/render_thumbnails.py
```

پس‌زمینه‌ها: `shorts/_bg/` (تولید‌شده با AI). متن‌ها در دیکشنری `SHIRTS` داخل اسکریپت — بک‌گراند و متن‌ها قابل تغییر.
