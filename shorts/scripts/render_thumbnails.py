# -*- coding: utf-8 -*-
"""Render 4 vertical (1080x1920) YouTube Shorts thumbnails for the
Quiz Bank (بانک سؤال) Next.js 16 + Supabase project."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display

W, H = 1080, 1920
FONT_DIR = "/home/user/.fonts"
BG_DIR = "/home/user/quizBankSource/shorts/_bg"
OUT_DIR = "/home/user/quizBankSource/shorts/thumbnails"
os.makedirs(OUT_DIR, exist_ok=True)

def font(weight, size):
    return ImageFont.truetype(f"{FONT_DIR}/Vazirmatn-{weight}.ttf", size)

def has_fa(s):
    return any(("\u0600" <= c <= "\u06FF") or ("\uFB50" <= c <= "\uFDFF") for c in s)

def fa(s):
    """Shape + reorder a Persian string for PIL in an RTL paragraph."""
    if not has_fa(s):
        return s  # pure latin/digits -> render as-is
    shaped = arabic_reshaper.reshape(s)
    return get_display(shaped, base_dir="R")

def text_w(d, s, f):
    return d.textlength(fa(s), font=f)

def draw_center(d, y, s, f, fill, shadow=True):
    vis = fa(s)
    w = d.textlength(vis, font=f)
    x = (W - w) // 2
    if shadow:
        d.text((x + 3, y + 5), vis, font=f, fill=(0, 0, 0, 200))
    d.text((x, y), vis, font=f, fill=fill)
    return w

def pill(d, x, y, s, f, fg, bg, border=None, pad_x=34, pad_y=18, radius=40):
    w = d.textlength(fa(s), font=f) + pad_x * 2
    h = 36 + pad_y * 2  # approx cap height for these sizes
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=bg,
                        outline=border, width=2 if border else 0)
    d.text((x + pad_x, y + pad_y - 4), fa(s), font=f, fill=fg)
    return w, h

def fit_size(d, s, weight, start, max_w, min_s=60):
    size = start
    while size > min_s:
        f = font(weight, size)
        if d.textlength(fa(s), font=f) <= max_w:
            return size
        size -= 4
    return size

ACCENTS = {
    "violet":  (139, 92, 246),
    "red":     (244, 63, 94),
    "emerald": (16, 185, 129),
    "amber":   (245, 158, 11),
}

SHIRTS = [
    {
        "num": "۰۱",
        "bg": "bg1.png",
        "accent": "violet",
        "kicker": "تصحیح خودکار با هوش مصنوعی",
        "title": "AI برگه‌های تشریحی را تصحیح می‌کند!",
        "sub": ["نمره ۰ تا ۱۰۰ + بازخورد فارسی", "حتی بدون کلید API هم کار می‌کند"],
        "pills": ["پرامپت فارسی", "Fallback خودکار", "بدون N+1"],
        "tag": "Next.js 16 + Supabase",
    },
    {
        "num": "۰۲",
        "bg": "bg2.png",
        "accent": "red",
        "kicker": "ضدتقلب تا آخرین لایه",
        "title": "با F12 هم نمی‌تواند تقلب کند!",
        "sub": ["is_correct هرگز به کلاینت نمی‌رسد", "RLS + SECURITY DEFINER در Supabase"],
        "pills": ["Server-side grading", "httpOnly Cookie", "Zod"],
        "tag": "Next.js 16 + Supabase",
    },
    {
        "num": "۰۳",
        "bg": "bg3.png",
        "accent": "emerald",
        "kicker": "معماری حرفه‌ای Next.js 16",
        "title": "بدون N+1؛ سرعتی که حس می‌شود",
        "sub": ["همه‌جا Server Components + Server Actions", "unstable_cache + aggregate SQL برای KPI"],
        "pills": ["Drizzle ORM", "Pagination سمت سرور", "Tailwind 4"],
        "tag": "Next.js 16 + Supabase",
    },
    {
        "num": "۰۴",
        "bg": "bg4.png",
        "accent": "amber",
        "kicker": "پروژه‌ای برای رزومه",
        "title": "از بانک سؤال تا پنل ادمین کامل",
        "sub": ["Quiz builder، صف تصحیح دستی، آنالیتیکس", "دیپلوی روی Supabase با یک schema.sql"],
        "pills": ["RTL کامل", "سیستم درخواست کاربر", "Seed آماده"],
        "tag": "Next.js 16 + Supabase",
    },
]

def render(sh, out):
    img = Image.open(f"{BG_DIR}/{sh['bg']}").convert("RGBA").resize((W, H))
    # darken with a vertical gradient so text pops
    grad = Image.new("L", (1, H))
    for yy in range(H):
        t = yy / H
        if t < 0.55:
            grad.putpixel((0, yy), int(70 + 130 * (t / 0.55)))
        else:
            grad.putpixel((0, yy), int(200 + 30 * ((t - 0.55) / 0.45)))
    dark = Image.new("RGBA", (W, H), (4, 6, 16, 255))
    m = Image.new("L", (W, H))
    m.paste(grad.convert("L"), (0, 0))
    img = Image.composite(dark, img, m.point(lambda v: int(v * 0.75)))

    d = ImageDraw.Draw(img, "RGBA")
    acc = ACCENTS[sh["accent"]]
    acc_a = acc + (90,)

    # top: channel chip + episode number
    f_chip = font("Medium", 40)
    cw = text_w(d, "@sanidev-web", f_chip) + 60
    pill(d, (W - cw) // 2, 88, "@sanidev-web", f_chip,
         (245, 248, 255, 255), (8, 12, 28, 225), acc + (160,), pad_x=30, pad_y=14)
    f_num = font("Black", 72)
    nw = text_w(d, sh["num"], f_num) + 44
    d.rounded_rectangle([64, 78, 64 + nw, 78 + 112], radius=28,
                        fill=(8, 12, 28, 225), outline=acc + (200,), width=3)
    d.text((64 + 22, 100), fa(sh["num"]), font=f_num, fill=acc + (255,))

    # kicker bar
    f_k = font("SemiBold", 44)
    kw = text_w(d, sh["kicker"], f_k)
    d.rectangle([(W - kw) / 2 - 26, 470, (W + kw) / 2 + 26, 556], fill=acc + (42,), outline=None)
    d.rectangle([(W - kw) / 2 - 26, 556, (W + kw) / 2 + 26, 563], fill=acc + (255,))
    draw_center(d, 486, sh["kicker"], f_k, (255, 255, 255, 255), shadow=False)

    # big title (auto-fit)
    size = fit_size(d, sh["title"], "Black", 118, W - 120, min_s=72)
    f_t = font("Black", size)
    draw_center(d, 640, sh["title"], f_t, (255, 255, 255, 255))
    # accent underline glow
    tw = text_w(d, sh["title"], f_t)
    d.rounded_rectangle([(W - tw) / 2, 640 + size + 34, (W + tw) / 2, 640 + size + 50],
                        radius=8, fill=acc + (230,))

    # subtitle lines
    y = 880
    f_s = font("Medium", 47)
    for line in sh["sub"]:
        draw_center(d, y, line, f_s, (224, 231, 244, 255))
        y += 84

    # feature pills (row, centered)
    f_p = font("SemiBold", 40)
    gap = 28
    widths = [text_w(d, p, f_p) + 64 for p in sh["pills"]]
    total = sum(widths) + gap * (len(sh["pills"]) - 1)
    x = (W - total) // 2
    y = 1160
    for p, wp in zip(sh["pills"], widths):
        d.rounded_rectangle([x, y, x + wp, y + 92], radius=46,
                            fill=(10, 14, 30, 200), outline=acc + (200,), width=3)
        d.text((x + 32, y + 20), fa(p), font=f_p, fill=(245, 248, 255, 255))
        x += wp + gap

    # bottom tech tag
    f_b = font("Regular", 42)
    draw_center(d, 1300, sh["tag"], f_b, (148, 163, 199, 255), shadow=False)

    # bottom CTA
    f_c = font("Bold", 52)
    cta = "آموزش کامل این هفته در کانال"
    draw_center(d, 1720, cta, f_c, (255, 255, 255, 255))

    img = img.convert("RGB")
    img.save(out, quality=95)
    print("wrote", out)

for i, sh in enumerate(SHIRTS, 1):
    render(sh, f"{OUT_DIR}/thumb-{i}.png")
