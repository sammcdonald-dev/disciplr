import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, APP_URL } from '@/lib/env';
import { db, user } from '@/lib/db';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export async function POST(req: Request) {
  const { userId } = await req.json();

  const users = await db.select().from(user).where(eq(user.id, userId));
  const userData = users[0];

  if (!userData) {
    return new Response('User not found', { status: 404 });
  }

  if (!userData.stripe_customer_id) {
    return new Response('No billing account found', { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: userData.stripe_customer_id,
    return_url: APP_URL,
  });

  return Response.json({ url: session.url });
}
