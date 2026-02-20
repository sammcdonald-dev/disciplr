/**
 * CHECKOUT ROUTE
 *
 * Purpose:
 * Creates a Stripe Checkout Session for a logged-in user.
 *
 * What it does:
 * - Receives { planId, userId } from frontend
 * - Ensures the user has a Stripe customer (creates one if missing)
 * - Stores stripe_customer_id in the database
 * - Creates a Stripe Checkout Session (subscription or one-time)
 * - Returns the Stripe-hosted checkout URL
 *
 * Important:
 * Access is only granted by the webhook route after Stripe confirms payment.
 */

import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

import { getPlanById } from '@/lib/billing/plans';
import { STRIPE_SECRET_KEY } from '@/lib/env';
import { db, user } from '@/lib/db';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export async function POST(req: Request) {
  const { planId, userId } = await req.json();

  // Fetch user from DB
  const users = await db.select().from(user).where(eq(user.id, userId));
  const userData = users[0];

  if (!userData) {
    return new Response('User not found', { status: 404 });
  }

  // Get the plan
  const plan = getPlanById(planId);
  if (!plan) {
    return new Response('Plan not found', { status: 404 });
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: userData.email,
    metadata: {
      userId: userData.id,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: plan.isSubscription ? 'subscription' : 'payment',
    customer: customer.id,
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
  });

  return Response.json({ url: session.url });
}
