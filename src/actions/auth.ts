"use server";

// Authentication server actions: register, login, logout.
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/auth";

const usernameSchema = z
  .string()
  .min(4, "نام کاربری باید حداقل ۴ نویسه باشد.")
  .max(32, "نام کاربری حداکثر ۳۲ نویسه است.")
  .regex(/^[\w.]+$/, "نام کاربری فقط می‌تواند شامل حروف لاتین، عدد، «_» و «.» باشد.");

const passwordSchema = z
  .string()
  .min(8, "گذرواژه باید حداقل ۸ نویسه باشد.")
  .max(72, "گذرواژه حداکثر ۷۲ نویسه است.");

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "نام و نام خانوادگی الزامی است.").max(120),
  username: usernameSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

function backWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData): Promise<void> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    backWithError("/register", parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.");
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);
  if (existing.length > 0) {
    backWithError("/register", "این نام کاربری قبلاً ثبت شده است.");
  }

  const [created] = await db
    .insert(users)
    .values({
      username: parsed.data.username,
      fullName: parsed.data.fullName,
      passwordHash: await hashPassword(parsed.data.password),
      role: "user",
    })
    .returning({ id: users.id });

  await createSession(created.id);
  redirect("/");
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    backWithError("/login", parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.");
  }

  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);

  const row = rows[0];
  const ok = row ? await verifyPassword(parsed.data.password, row.passwordHash) : false;
  if (!ok) {
    backWithError("/login", "نام کاربری یا گذرواژه اشتباه است.");
  }

  await createSession(row!.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
