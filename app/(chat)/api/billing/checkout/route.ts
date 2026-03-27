import { eq } from 'drizzle-orm';

import { auth } from '@/app/(auth)/auth';
import { getPlanById } from '@/lib/billing/plans';
import { getStripe } from '@/lib/billing/stripe';
import { db, user } from '@/lib/db';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let planId: string;
  try {
    const body = await req.json();
    planId = body.planId;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!planId) {
    return Response.json({ error: 'planId is required' }, { status: 400 });
  }

  const plan = getPlanById(planId);
  if (!plan) {
    return Response.json({ error: 'Plan not found' }, { status: 404 });
  }

  try {
    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id));
    const userData = users[0];

    if (!userData) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = getStripe();
    let customerId = userData.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: { userId: userData.id },
      });
      customerId = customer.id;

      await db
        .update(user)
        .set({ stripe_customer_id: customerId })
        .where(eq(user.id, userData.id));
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: plan.isSubscription ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
    });

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
