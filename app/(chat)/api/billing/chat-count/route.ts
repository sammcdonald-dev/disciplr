import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db, user } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  try {
    const [userData] = await db
      .select({ free_chat_count: user.free_chat_count })
      .from(user)
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ count: userData?.free_chat_count ?? 0 });
  } catch (error) {
    console.error("Chat count error:", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
