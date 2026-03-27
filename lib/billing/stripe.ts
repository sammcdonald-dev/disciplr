import Stripe from "stripe";
import { env } from "@/lib/env";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
