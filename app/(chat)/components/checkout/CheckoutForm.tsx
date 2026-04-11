import { useState } from 'react';
import { loadStripe } from '@stripe/react-stripe-js';
import { useBilling } from '@/app/(chat)/context/billing-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
      // On success, subscribeToPlan will redirect to Stripe Checkout
      // If it returns (e.g., for one-time payments), we handle it here
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
          <Button variant="outline" onClick={() => setError(null)} className="w-full">
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
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-muted-foreground">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:focus-visible:outline-none file:focus-visible:ring-2 file:focus-visible:ring-ring file:focus-visible:ring-offset-2 placeholder:text-muted-foreground"
            />
          </div>
          
          {/* Stripe Element would go here - for simplicity we're using a basic form */}
          {/* In production, replace with actual Stripe Elements */}
          <div>
            <label htmlFor="card-number" className="mb-2 block text-sm font-medium text-muted-foreground">
              Card Number
            </label>
            <input
              id="card-number"
              type="text"
              autoComplete="cc-number"
              required
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:focus-visible:outline-none file:focus-visible:ring-2 file:focus-visible:ring-ring file:focus-visible:ring-offset-2 placeholder:text-muted-foreground"
              placeholder="•••• •••• •••• ••••"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="card-expiry" className="mb-2 block text-sm font-medium text-muted-foreground">
                Expiry Date
              </label>
              <input
                id="card-expiry"
                type="text"
                autoComplete="cc-exp"
                required
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:focus-visible:outline-none file:focus-visible:ring-2 file:focus-visible:ring-ring file:focus-visible:ring-offset-2 placeholder:text-muted-foreground"
                placeholder="MM/YY"
              />
            </div>
            
            <div>
              <label htmlFor="card-cvc" className="mb-2 block text-sm font-medium text-muted-foreground">
                CVC
              </label>
              <input
                id="card-cvc"
                type="text"
                autoComplete="cc-csc"
                required
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:focus-visible:outline-none file:focus-visible:ring-2 file:focus-visible:ring-ring file:focus-visible:ring-offset-2 placeholder:text-muted-foreground"
                placeholder="•••"
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="disabled:opacity-50"
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          type="submit"
          disabled={isProcessing}
          className="w-[200px]"
        >
          {isProcessing ? 'Processing...' : 'Pay Now'}
        </Button>
      </CardFooter>
    </Card>
  );
}
