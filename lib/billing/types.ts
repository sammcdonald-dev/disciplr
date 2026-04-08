// Defines types related to billing plans and intervals
// Billing intervals can be monthly or yearly
// Plan IDs correspond to specific billing plans

export type BillingInterval = 'month' | 'year';

export type PlanId = 'one_time' | 'monthly';

export interface BillingPlan {
  id: PlanId;
  name: string;
  description: string;
  priceId: string; // Stripe Price ID
  amount: number; // in cents
  currency: 'usd';
  interval?: BillingInterval; // undefined for one-time
  isSubscription: boolean;
}
