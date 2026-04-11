import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const currentCount = parseInt(cookieStore.get("chat-count")?.value || "0", 10);
    cookieStore.set("chat-count", (currentCount + 1).toString());
    
    return NextResponse.json({ success: true, count: currentCount + 1 });
  } catch (error) {
    console.error("Increment chat error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}