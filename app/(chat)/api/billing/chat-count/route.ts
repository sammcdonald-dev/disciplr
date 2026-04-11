import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const countStr = cookieStore.get("chat-count")?.value || "0";
    const count = parseInt(countStr, 10);
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Chat count error:", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}