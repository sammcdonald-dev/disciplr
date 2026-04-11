import Link from 'next/link';
import { PLANS } from '@/lib/billing/plans';
import { useBilling } from '@/app/(chat)/context/billing-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function SubscriptionPlans() {
  const { subscription, isLoading, error, subscribeToPlan } = useBilling();

  if (isLoading) {
    return <div className="text-center py-12">Loading subscription plans...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-destructive">Error loading plans: {error}</div>;
  }

  return (
    <section className="py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-8">Choose Your Plan</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Link
              key={plan.id}
              href="#"
              className="group block cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                if (!plan.isSubscription) {
                  // Handle one-time purchase
                  subscribeToPlan(plan.id);
                } else {
                  // Handle subscription
                  subscribeToPlan(plan.id);
                }
              }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow group-hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{plan.name}</CardTitle>
                  {plan.isSubscription && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Popular
                    </span>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="text-2xl font-bold">
                    {plan.isSubscription ? (
                      <>
                        ${(plan.amount / 100).toFixed(0)}/
                        <span className="text-sm font-normal">{plan.interval === 'year' ? 'yr' : 'mo'}</span>
                      </>
                    ) : (
                      ${(plan.amount / 100).toFixed(0)}
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between pt-4">
                  {!plan.isSubscription && (
                    <Button variant="outline" size="sm" className="w-full">
                      Buy Now
                    </Button>
                  )}
                  {plan.isSubscription && (
                    <>
                      {subscription?.id === plan.id ? (
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          Subscribed
                        </Button>
                      ) : (
                        <Button variant="default" size="sm" className="w-full">
                          Select Plan
                        </Button>
                      )}
                    </>
                  )}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
