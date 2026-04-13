/**
 * CHECKOUT ROUTE
 *
 * Purpose:
 * Creates a Stripe Checkout Session for a logged-in user.
 * Includes owner bypass functionality.
 *
 * What it does:
 * - Checks if user is owner (bypass payment)
 * - Receives { planId, userId } from frontend
 * - Ensures the user has a Stripe customer (creates one if missing)
 * - Stores stripe_customer_id in the database
 * - Creates a Stripe Checkout Session (subscription or one-time)
 * - Returns the Stripe-hosted checkout URL
 *
 * Important:
 * Access is only granted by the webhook route after Stripe confirms payment.
 */

import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { auth } from "@/app/(auth)/auth";
import { getPlanById } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { db, user } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check if user is owner (bypass payment)
  const cookieStore = await cookies();
  const ownerKey = cookieStore.get("owner-key")?.value;
  const expectedKey = process.env.OWNER_BYPASS_KEY;
  
  if (expectedKey && ownerKey === expectedKey) {
    // Owner bypass - grant immediate access by resetting chat count
    // We'll create a simple response that redirects to chat
    return Response.json({ url: "/app/chat" });
  }

  let planId: string;
  try {
    const body = await req.json();
    planId = body.planId;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!planId) {
    return Response.json({ error: "planId is required" }, { status: 400 });
  }

  const plan = getPlanById(planId);
  if (!plan) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  try {
    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id));
    const userData = users[0];

    if (!userData) {
      return Response.json({ error: "User not found" }, { status: 404 });
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
      mode: plan.isSubscription ? "subscription" : "payment",
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${env.APP_URL}/success`,
      cancel_url: `${env.APP_URL}/cancel`,
    });

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
