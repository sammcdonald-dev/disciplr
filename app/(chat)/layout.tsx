import { cookies } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "../(auth)/auth";
import Script from "next/script";
import { DEFAULT_BIBLE_CHAT_PERSONA_ID } from "@/lib/ai/personas";
import { DataStreamProvider } from "@/components/data-stream-provider";

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar:state")?.value !== "true";

  const personaIdFromCookie = cookieStore.get("disciplr");

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <SidebarProvider defaultOpen={!isCollapsed}>
          {personaIdFromCookie ? (
            <AppSidebar
              user={session?.user}
              session={session}
              selectedPersonaId={personaIdFromCookie?.value}
            />
          ) : (
            <AppSidebar
              user={session?.user}
              session={session}
              selectedPersonaId={DEFAULT_BIBLE_CHAT_PERSONA_ID}
            />
          )}
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </DataStreamProvider>
    </>
  );
}
