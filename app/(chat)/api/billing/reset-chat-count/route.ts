import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db, user } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  try {
    await db
      .update(user)
      .set({ free_chat_count: 0 })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset chat count error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
