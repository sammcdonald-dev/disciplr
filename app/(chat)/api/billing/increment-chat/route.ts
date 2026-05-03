import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db, user } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  try {
    const [updated] = await db
      .update(user)
      .set({ free_chat_count: sql`${user.free_chat_count} + 1` })
      .where(eq(user.id, session.user.id))
      .returning({ free_chat_count: user.free_chat_count });

    return NextResponse.json({ success: true, count: updated?.free_chat_count ?? 0 });
  } catch (error) {
    console.error("Increment chat error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
