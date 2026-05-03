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
import type Stripe from 'stripe';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { getStripe } from '@/lib/billing/stripe';
import { db, user } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Missing signature', { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Idempotency: Check if we've already processed this event
  // We'll store processed event IDs in a simple way for now
  // In production, you might want to use a dedicated table or Redis
  try {
    const existing = await db
      .select()
      .from(user)
      .where(eq(user.stripe_customer_id, '')); // dummy query to check db connectivity
    // Actual idempotency check would go here - simplified for now
  } catch (dbErr) {
    console.error('Database connectivity error:', dbErr);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id;

        if (!customerId) {
          console.warn('No customer ID in checkout.session.completed event');
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const users = await db
          .select()
          .from(user)
          .where(eq(user.stripe_customer_id, customerId));

        const userData = users[0];
        if (!userData) {
          console.warn(`No user found for customer ID: ${customerId}`);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        if (session.mode === 'subscription') {
          try {
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
          } catch (subErr) {
            console.error('Error retrieving subscription:', subErr);
            // Still return 200 to prevent Stripe retries, but log the error
            return NextResponse.json({ received: true }, { status: 200 });
          }
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

        // Support both newer (invoice.parent.subscription_details) and
        // older (invoice.subscription) Stripe API versions
        const subscriptionId: string | null =
          invoice.parent?.type === 'subscription_details'
            ? ((invoice.parent.subscription_details?.subscription as
                | string
                | null) ?? null)
            : typeof (invoice as any).subscription === 'string'
              ? (invoice as any).subscription
              : null;

        if (!subscriptionId) {
          console.warn('No subscription ID in invoice.payment_succeeded event');
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        if (!customerId) {
          console.warn('No customer ID in invoice.payment_succeeded event');
          return NextResponse.json({ received: true }, { status: 200 });
        }

        try {
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
          if (!userData) {
            console.warn(`No user found for customer ID: ${customerId}`);
            return NextResponse.json({ received: true }, { status: 200 });
          }

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
        } catch (subErr) {
          console.error('Error retrieving subscription for invoice:', subErr);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        if (!customerId) {
          console.warn('No customer ID in customer.subscription.deleted event');
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const users = await db
          .select()
          .from(user)
          .where(eq(user.stripe_customer_id, customerId));

        const userData = users[0];
        if (!userData) {
          console.warn(`No user found for customer ID: ${customerId}`);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        await db
          .update(user)
          .set({
            subscription_status: 'canceled',
          })
          .where(eq(user.id, userData.id));

        break;
      }

      // Handle subscription updated for plan changes, etc.
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        if (!customerId) {
          console.warn('No customer ID in customer.subscription.updated event');
          return NextResponse.json({ received: true }, { status: 200 });
        }

        try {
          const users = await db
            .select()
            .from(user)
            .where(eq(user.stripe_customer_id, customerId));

          const userData = users[0];
          if (!userData) {
            console.warn(`No user found for customer ID: ${customerId}`);
            return NextResponse.json({ received: true }, { status: 200 });
          }

          await db
            .update(user)
            .set({
              subscription_status: subscription.status,
              // Update current period end if needed
              current_period_end: subscription.items.data[0]?.current_period_end
                ? new Date(subscription.items.data[0].current_period_end * 1000)
                : null,
            })
            .where(eq(user.id, userData.id));
        } catch (subErr) {
          console.error('Error updating subscription:', subErr);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        break;
      }

      // Handle payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        if (!customerId) {
          console.warn('No customer ID in invoice.payment_failed event');
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // You might want to notify user or take other action here
        console.warn(`Payment failed for customer ${customerId}`);
        break;
      }

      default:
        // Unhandled event type - log but don't fail
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Important: Return 200 to prevent Stripe from retrying indefinitely
    // but alert on the error for investigation
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
