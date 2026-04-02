function lazyEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get STRIPE_SECRET_KEY() {
    return lazyEnv('STRIPE_SECRET_KEY');
  },
  get STRIPE_WEBHOOK_SECRET() {
    return lazyEnv('STRIPE_WEBHOOK_SECRET');
  },
  get APP_URL() {
    return lazyEnv('NEXT_PUBLIC_APP_URL');
  },
};
