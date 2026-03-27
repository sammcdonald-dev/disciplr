import { eq } from 'drizzle-orm';
import { auth } from '@/app/(auth)/auth';
import { env } from '@/lib/env';
import { getStripe } from '@/lib/billing/stripe';
import { db, user } from '@/lib/db';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id));
  const userData = users[0];

  if (!userData) {
    return new Response('User not found', { status: 404 });
  }

  if (!userData.stripe_customer_id) {
    return new Response('No billing account found', { status: 404 });
  }

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: userData.stripe_customer_id,
    return_url: env.APP_URL,
  });

  return Response.json({ url: portalSession.url });
}
