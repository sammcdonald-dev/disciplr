/**
 * BILLING STATUS ROUTE
 *
 * Purpose:
 * Determines whether a user currently has premium access.
 *
 * What it does:
 * - Receives { userId }
 * - Fetches billing fields from database
 * - Determines entitlement based on:
 *   - has_lifetime_access
 *   - subscription_status
 *   - current_period_end
 * - Returns access boolean + billing metadata
 *
 * This route is used by the frontend to:
 * - Gate premium features
 * - Display subscription state
 * - Show renewal dates
 *
 * Important:
 * This route NEVER talks to Stripe.
 * It trusts only the database (which webhook keeps updated).
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, user } from '@/lib/db';

/**
 * BILLING STATUS ROUTE
 *
 * Determines whether a user currently has premium access.
 */

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return new NextResponse('Missing userId', { status: 400 });
    }

    const users = await db
      .select({
        has_lifetime_access: user.has_lifetime_access,
        subscription_status: user.subscription_status,
        current_period_end: user.current_period_end,
      })
      .from(user)
      .where(eq(user.id, userId));

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
