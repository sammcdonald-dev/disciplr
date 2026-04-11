import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("chat-count", "0");
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset chat count error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}