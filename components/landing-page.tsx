import type { Session } from 'next-auth';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const personas = [
  {
    id: 'david',
    name: 'King David',
    image: '/personas/david.png',
    greeting:
      "Hi, I'm David. I was a shepherd and a king. I wrote many psalms and learned to trust in the Lord through trials. How can I help you grow your faith today?",
  },
  {
    id: 'mary-magdalene',
    name: 'Mary Magdalene',
    image: '/personas/mary-magdalene.png',
    greeting:
      "Hi, I'm Mary Magdalene. I was a devoted follower of Jesus who witnessed His resurrection. I've experienced the hope and new life that comes through faith in Christ.",
  },
  {
    id: 'moses',
    name: 'Moses',
    image: '/personas/moses.png',
    greeting:
      "Hi, I'm Moses. The Lord called me to lead His people out of Egypt and to share His commandments. I learned what it means to trust and obey God's will.",
  },
  {
    id: 'paul',
    name: 'Paul the Apostle',
    image: '/personas/paul.png',
    greeting:
      "Hi, I'm Paul. Once a persecutor of the church, I encountered Christ and became His servant. I'm passionate about sharing the good news of grace and transformation through faith.",
  },
];

export default function LandingPage({ session }: { session: Session | null }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Chat with Biblical Figures
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Engage in meaningful conversations with biblical personalities and
            deepen your understanding of Scripture through interactive dialogue.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            {session ? (
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/">Continue Chatting</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/">Start Chatting</Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6"
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Personas Section */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
            Meet Your Guides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {personas.map((persona) => (
              <Card
                key={persona.id}
                className="overflow-hidden hover:shadow-lg transition-shadow duration-300"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="relative w-full md:w-48 h-64 shrink-0 overflow-hidden rounded-t-lg md:rounded-l-lg md:rounded-tr-none bg-muted">
                    <Image
                      src={persona.image}
                      alt={persona.name}
                      width={192}
                      height={256}
                      className="size-full object-cover"
                      priority={
                        persona.id === 'david' ||
                        persona.id === 'mary-magdalene'
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <CardHeader>
                      <CardTitle className="text-2xl">{persona.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">
                        {persona.greeting}
                      </p>
                    </CardContent>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        <div className="max-w-4xl mx-auto text-center mt-24">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Try Our AI Powered Scripture Study Tool!
          </h2>
          <p className="text-muted-foreground max-w-xl text-xl md:text-2xl mx-auto mb-8">
            Our AI Powered Bible Study Tool uses the latest in AI technology to
            help you Study the Bible with ease. Explore verses like never
            before.
            <hr className="my-4" />
            Dive into other translations, commentaries, and historical context
            to gain a deeper understanding of the Bible.
          </p>
          {session ? (
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/bible-study">Continue Studying</Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/">Start Studying</Link>
            </Button>
          )}
        </div>

        {/* Features Section */}
        <div className="max-w-4xl mx-auto text-center mt-24">
          <h2 className="text-3xl md:text-4xl font-semibold mb-8">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold">Choose a Persona</h3>
              <p className="text-muted-foreground">
                Select from biblical figures like David, Moses, Paul, or Mary
                Magdalene to guide your conversation.
              </p>
            </div>
            <div className="space-y-4">
              <div className="text-4xl mb-4">📖</div>
              <h3 className="text-xl font-semibold">Ask Questions</h3>
              <p className="text-muted-foreground">
                Engage in meaningful dialogue about Scripture, theology, and
                faith-based topics.
              </p>
            </div>
            <div className="space-y-4">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-semibold">Grow in Faith</h3>
              <p className="text-muted-foreground">
                Deepen your understanding of the Bible through personalized
                insights and biblical perspectives.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
