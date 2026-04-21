'use client';

import Link from 'next/link';
import SubscriptionPlans from '@/app/(chat)/components/pricing/SubscriptionPlans';
import BillingPortal from '@/app/(chat)/components/billing/BillingPortal';
import { BillingProvider } from '@/app/(chat)/context/billing-context';
import { useSession } from 'next-auth/react';

export default function BillingPage() {
  const { data: session } = useSession();

  return (
    <BillingProvider session={session}>
      <section className="min-h-[calc(100vh-4rem)] pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Billing & Subscription</h1>
              <Link href="/" className="text-sm text-muted-foreground hover:text-muted-foreground/75">
                ← Back to Chat
              </Link>
            </div>
            
            <SubscriptionPlans />
            
            <BillingPortal />
          </div>
        </div>
      </section>
    </BillingProvider>
  );
}
