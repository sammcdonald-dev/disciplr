import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const ownerKey = cookieStore.get("owner-key")?.value;
    const expectedKey = process.env.OWNER_BYPASS_KEY;
    
    const isOwner = !!expectedKey && ownerKey === expectedKey;
    
    return NextResponse.json({ isOwner });
  } catch (error) {
    console.error("Owner check error:", error);
    return NextResponse.json({ isOwner: false }, { status: 500 });
  }
}