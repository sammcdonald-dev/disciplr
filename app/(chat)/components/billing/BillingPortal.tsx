import { useBilling } from '@/app/(chat)/context/billing-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function BillingPortal() {
  const { user, subscription, isLoading, error, updatePaymentMethod, cancelSubscription, refreshSubscriptionStatus } = useBilling();
  const router = useRouter();

  if (isLoading) {
    return <div className="text-center py-12">Loading billing information...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-destructive">Error: {error}</div>;
  }

  if (!user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">Authentication Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please sign in to access your billing information.</p>
          <Button variant="default" onClick={() => router.push('/(auth)/login')} className="w-full">
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-8">Billing & Subscription</h2>
        
        {/* Subscription Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Subscription Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!subscription ? (
              <>
                <p className="text-muted-foreground">You are currently on the free plan.</p>
                <Button variant="outline" onClick={() => router.push('/(chat)/billing/plans')} className="w-full">
                  Upgrade Plan
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold">{subscription.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.isSubscription ? 
                        `Renews ${subscription.interval === 'year' ? 'annually' : 'monthly'}` : 
                        'One-time purchase'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Button variant="outline" onClick={updatePaymentMethod} className="w-full mb-2">
                      Update Payment Method
                    </Button>
                    <Button variant="destructive" onClick={() => {
                      if (window.confirm('Are you sure you want to cancel your subscription? This will take effect at the end of your billing period.')) {
                        cancelSubscription().catch((err) => {
                          console.error('Failed to cancel subscription:', err);
                          // Error will be handled by context and shown in UI
                        });
                      }
                    }} className="w-full">
                      Cancel Subscription
                    </Button>
                  </div>
                </>
              )}
          </CardContent>
        </Card>
        
        {/* Billing History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No recent transactions.</p>
            {/* In a real implementation, this would show past invoices/payments */}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
