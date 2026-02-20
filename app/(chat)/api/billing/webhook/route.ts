/**
 * WEBHOOK ROUTE
 *
 * Purpose:
 * Processes Stripe events and updates billing state in the database.
 *
 * What it does:
 * - Verifies Stripe webhook signature using STRIPE_WEBHOOK_SECRET
 * - Listens to key events:
 *   - checkout.session.completed
 *   - invoice.payment_succeeded
 *   - customer.subscription.deleted
 * - Updates user billing fields:
 *   - subscription_status
 *   - current_period_end
 *   - has_lifetime_access
 *
 * This is the ONLY place where access is granted or revoked.
 * If this route fails, billing state will be incorrect.
 *
 * Stripe retries events if we do not return HTTP 200.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '@/lib/env';
import { db, user } from '@/lib/db';

const stripe = new Stripe(STRIPE_SECRET_KEY);
const webhookSecret = STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id;

        if (!customerId) break;

        const users = await db
          .select()
          .from(user)
          .where(eq(user.stripe_customer_id, customerId));

        const userData = users[0];
        if (!userData) break;

        if (session.mode === 'subscription') {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ['items.data'] },
          );

          const firstItem = subscription.items.data[0];

          await db
            .update(user)
            .set({
              subscription_status: subscription.status,
              current_period_end: firstItem?.current_period_end
                ? new Date(firstItem.current_period_end * 1000)
                : null,
            })
            .where(eq(user.id, userData.id));
        }

        if (session.mode === 'payment') {
          await db
            .update(user)
            .set({
              has_lifetime_access: true,
            })
            .where(eq(user.id, userData.id));
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;

        const subscriptionId: string | null =
          invoice.parent?.type === 'subscription_details'
            ? ((invoice.parent.subscription_details?.subscription as
                | string
                | null) ?? null)
            : null;

        if (!subscriptionId) break;

        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        if (!customerId) break;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          {
            expand: ['items.data'],
          },
        );

        const users = await db
          .select()
          .from(user)
          .where(eq(user.stripe_customer_id, customerId));

        const userData = users[0];
        if (!userData) break;

        const firstItem = subscription.items.data[0];

        await db
          .update(user)
          .set({
            subscription_status: subscription.status,
            current_period_end: firstItem?.current_period_end
              ? new Date(firstItem.current_period_end * 1000)
              : null,
          })
          .where(eq(user.id, userData.id));

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        if (!customerId) break;

        const users = await db
          .select()
          .from(user)
          .where(eq(user.stripe_customer_id, customerId));

        const userData = users[0];
        if (!userData) break;

        await db
          .update(user)
          .set({
            subscription_status: 'canceled',
          })
          .where(eq(user.id, userData.id));

        break;
      }

      // Might want to handle more events like 'customer.subscription.updated'
      // for things like plan changes, pauses, etc.
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Still acknowledge to Stripe
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
