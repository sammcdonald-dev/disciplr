import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/app/(auth)/auth';
import { db, user } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const users = await db
      .select({
        has_lifetime_access: user.has_lifetime_access,
        subscription_status: user.subscription_status,
        current_period_end: user.current_period_end,
      })
      .from(user)
      .where(eq(user.id, session.user.id));

    const userData = users[0];

    if (!userData) {
      return new NextResponse('User not found', { status: 404 });
    }

    const now = new Date();

    const hasActiveSubscription =
      userData.subscription_status === 'active' &&
      userData.current_period_end &&
      new Date(userData.current_period_end) > now;

    const hasAccess = userData.has_lifetime_access || hasActiveSubscription;

    return NextResponse.json({
      hasAccess,
      hasLifetimeAccess: userData.has_lifetime_access,
      subscriptionStatus: userData.subscription_status,
      currentPeriodEnd: userData.current_period_end,
    });
  } catch (err) {
    console.error('Status route failed:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
