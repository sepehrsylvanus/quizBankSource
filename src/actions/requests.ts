"use server";

// User-facing request actions: users propose a new topic / quiz.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requests } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const requestSchema = z.object({
  type: z.enum(["topic", "quiz"]),
  title: z.string().trim().min(3, "عنوان باید حداقل ۳ نویسه باشد.").max(200),
  body: z.string().trim().min(10, "توضیحات باید حداقل ۱۰ نویسه باشد.").max(4000),
});

export async function createRequestAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = requestSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    redirect(
      `/requests?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.")}`,
    );
  }

  await db.insert(requests).values({
    userId: user.id,
    type: parsed.data.type,
    title: parsed.data.title,
    body: parsed.data.body,
  });

  revalidatePath("/requests");
  revalidatePath("/admin/requests");
  redirect("/requests?ok=1");
}
