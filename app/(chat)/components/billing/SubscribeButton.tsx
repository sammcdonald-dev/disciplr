import { useBilling } from '@/app/(chat)/context/billing-context';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SubscribeButtonProps {
  planId: string;
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  className?: string;
}

export default function SubscribeButton({
  planId,
  label = 'Subscribe',
  size = 'default',
  variant = 'default',
  className = '',
}: SubscribeButtonProps) {
  const { subscription, isLoading, error, subscribeToPlan } = useBilling();
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);

  const isSubscribed = subscription?.id === planId;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    try {
      await subscribeToPlan(planId);
      // Note: subscribeToPlan will redirect to Stripe Checkout for subscriptions
      // For one-time purchases, it may return and we'd refresh here
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (localError) {
    return (
      <Button
        variant="destructive"
        size={size}
        onClick={() => setLocalError(null)}
        className={`${className} w-full mb-2`}
      >
        {localError} {variant === 'destructive' && <span className="ml-1">✕</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading || isSubscribed}
      className={`${className} w-full ${isLoading ? 'opacity-50' : ''} ${isSubscribed ? 'opacity-50' : ''}`}
    >
      {isLoading && variant !== 'outline' ? (
        <>
          Processing...
        </>
      ) : isSubscribed ? (
        <>
          Subscribed {variant === 'outline' && <span className="ml-2">✓</span>}
        </>
      ) : (
        <>
          {label}
        </>
      )}
    </Button>
  );
}
