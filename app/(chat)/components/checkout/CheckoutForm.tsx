'use client';

import { useState } from 'react';
import { useBilling } from '@/app/(chat)/context/billing-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function CheckoutForm({ planId }: { planId: string }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { subscribeToPlan } = useBilling();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      await subscribeToPlan(planId);
      // subscribeToPlan redirects to Stripe Checkout; this line only
      // runs for non-redirect flows (e.g. owner bypass)
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">Checkout Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button variant="outline" onClick={() => setError(null)} className="w-full mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Secure Checkout</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          You will be redirected to Stripe to complete your payment securely.
        </p>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <form onSubmit={handleSubmit}>
          <Button
            variant="default"
            type="submit"
            disabled={isProcessing}
            className="w-[200px]"
          >
            {isProcessing ? 'Redirecting...' : 'Proceed to Checkout'}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
