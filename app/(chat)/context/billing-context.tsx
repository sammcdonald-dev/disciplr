'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { BillingPlan } from '@/lib/billing/types';
import type { Session } from 'next-auth';

interface BillingContextType {
  user: Session | null;
  subscription: BillingPlan | null;
  isLoading: boolean;
  error: string | null;
  initializeBilling: () => Promise<void>;
  subscribeToPlan: (planId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  updatePaymentMethod: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function useBilling() {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}

export function BillingProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const [user, setUser] = useState<Session | null>(session);
  const [subscription, setSubscription] = useState<BillingPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUser(session);
  }, [session]);

  const initializeBilling = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription status: ${response.status}`);
      }

      const data = await response.json();
      if (data.subscription && data.subscription.planId) {
        // Find plan by priceId from plans.ts
        const { PLANS } = await import('@/lib/billing/plans');
        const plan = PLANS.find(p => p.priceId === data.subscription.planId);
        setSubscription(plan ?? null);
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error('Failed to initialize billing:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const subscribeToPlan = useCallback(async (planId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create checkout session: ${response.status}`);
      }

      const { url } = await response.json();
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Failed to subscribe to plan:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelSubscription = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to cancel subscription: ${response.status}`);
      }

      // Refresh subscription status
      await initializeBilling();
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [initializeBilling]);

  const updatePaymentMethod = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to open billing portal: ${response.status}`);
      }

      const { url } = await response.json();
      // Redirect to Stripe Customer Portal
      window.location.href = url;
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSubscriptionStatus = useCallback(async () => {
    await initializeBilling();
  }, [initializeBilling]);

  // Initialize billing on mount
  useEffect(() => {
    initializeBilling();
  }, [initializeBilling]);

  const value = {
    user,
    subscription,
    isLoading,
    error,
    initializeBilling,
    subscribeToPlan,
    cancelSubscription,
    updatePaymentMethod,
    refreshSubscriptionStatus,
  };

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
}
