import { auth } from '@/app/(auth)/auth';
import LandingPage from '@/components/landing-page';

export default async function Page() {
  const session = await auth();
  return <LandingPage session={session} />;
}
