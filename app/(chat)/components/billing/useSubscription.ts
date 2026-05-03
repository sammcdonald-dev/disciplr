import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Types
export type SubscriptionStatus = "free" | "pro" | "limit_reached" | "loading";
export type ChatLimits = {
  freeChatsRemaining: number;
  isOwner: boolean;
};

// Hook to manage subscription and chat limits
export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [limits, setLimits] = useState<ChatLimits>({
    freeChatsRemaining: 8,
    isOwner: false
  });
  const router = useRouter();

  // Check subscription status and chat limits
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      // Check if user is owner (bypass)
      const ownerRes = await fetch("/api/billing/check-owner");
      const isOwner = await ownerRes.json();

      // Get chat count from server
      const countRes = await fetch("/api/billing/chat-count");
      const chatCount = await countRes.json();

      const freeChatsRemaining = Math.max(0, 8 - chatCount.count);

      setLimits({
        freeChatsRemaining,
        isOwner: isOwner.isOwner
      });

      if (isOwner.isOwner) {
        setStatus("pro");
      } else if (freeChatsRemaining > 0) {
        setStatus("free");
      } else {
        setStatus("limit_reached");
      }
    } catch (error) {
      console.error("Failed to check subscription status:", error);
      setStatus("loading");
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    checkSubscriptionStatus();

    // Set up polling for status changes (every 30 seconds)
    const interval = setInterval(checkSubscriptionStatus, 30000);
    return () => clearInterval(interval);
  }, [checkSubscriptionStatus]);

  // Handle chat message sent - increment counter
  const handleChatMessage = useCallback(async () => {
    if (limits.isOwner) return; // Owner doesn't count chats

    try {
      await fetch("/api/billing/increment-chat", { method: "POST" });
      // Refresh status after increment
      await checkSubscriptionStatus();
    } catch (error) {
      console.error("Failed to increment chat count:", error);
    }
  }, [limits.isOwner, checkSubscriptionStatus]);

  // Handle subscription upgrade
  const handleUpgrade = useCallback(async () => {
    try {
      // Redirect to Stripe checkout
      const res = await fetch("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planId: 'monthly' }) });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error("Failed to initiate checkout:", error);
    }
  }, []);

  // Handle billing portal access
  const handleManageSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    }
  }, []);

  // Reset chat count (after successful payment)
  const resetChatCount = useCallback(async () => {
    try {
      await fetch("/api/billing/reset-chat-count", { method: "POST" });
      await checkSubscriptionStatus();
    } catch (error) {
      console.error("Failed to reset chat count:", error);
    }
  }, [checkSubscriptionStatus]);

  return {
    status,
    limits,
    handleChatMessage,
    handleUpgrade,
    handleManageSubscription,
    resetChatCount,
    refetch: checkSubscriptionStatus,
  };
}
