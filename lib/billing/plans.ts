import type { BillingPlan } from './types';

// Centralized definitions of billing plans. Currently has dummy values.

/**
 * IMPORTANT:
 * These price IDs come from Stripe Dashboard → Products → Prices
 * Use TEST price IDs in development
 */

export const PLANS: BillingPlan[] = [
  {
    id: 'one_time',
    name: 'Lifetime Access',
    description: 'One-time payment for lifetime access',
    priceId: 'price_123', //TODO: replace with actual price ID
    amount: 4900,
    currency: 'usd',
    isSubscription: false,
  },
  {
    id: 'monthly',
    name: 'Monthly Subscription',
    description: 'Monthly access',
    priceId: 'price_456', //TODO: replace with actual price ID
    amount: 900,
    currency: 'usd',
    interval: 'month',
    isSubscription: true,
  },
];

/**
 * Helper lookups
 */

export const getPlanByPriceId = (priceId: string): BillingPlan | undefined => {
  return Object.values(PLANS).find((plan) => plan.priceId === priceId);
};

export const getPlanById = (id: string): BillingPlan | undefined => {
  return Object.values(PLANS).find((plan) => plan.id === id);
};
