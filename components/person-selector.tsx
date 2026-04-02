/* eslint-disable @next/next/no-img-element */
'use client';

import { startTransition, use, useMemo, useOptimistic, useState } from 'react';

import { saveChatPersonaAsCookie } from '@/app/(chat)/actions';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { chatModels } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import Image from 'next/image';

import { CheckCircleFillIcon, ChevronDownIcon } from './icons';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import type { Session } from 'next-auth';
import { personas } from '@/lib/ai/personas';
import { Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function PersonSelector({
  session,
  selectedPersonaId,
  className,
}: {
  session: Session;
  selectedPersonaId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [optimisticPersonaId, setOptimisticPersonaId] =
    useOptimistic(selectedPersonaId);

  const userType = session.user.type;
  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === optimisticPersonaId),
    [optimisticPersonaId],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="persona-selector"
          variant="ghost"
          className="px-2 md:h-[38px] w-full justify-between"
        >
          <span className="flex flex-row gap-2 items-center">
            {selectedPersona?.id !== 'bible-chat' && (
              <img
                src={`/personas/${selectedPersona?.id}.png`}
                alt=""
                width={30}
                height={38}
                className="rounded-full"
              />
            )}
            {selectedPersona?.name}
          </span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px]">
        {personas.map((persona) => {
          const { id } = persona;

          return (
            <DropdownMenuItem
              data-testid={`persona-selector-item-${id}`}
              key={id}
              onSelect={() => {
                setOpen(false);
                startTransition(() => {
                  setOptimisticPersonaId(id);
                  saveChatPersonaAsCookie(id);
                });
              }}
              data-active={id === optimisticPersonaId}
              asChild
            >
              <button
                type="button"
                className="gap-4 group/item flex flex-row justify-between items-center w-full line-clamp-1 max-w-[300px]"
                onClick={() => {
                  router.push('/');
                  router.refresh();
                }}
              >
                <div className="flex flex-col gap-1 items-start">
                  <div className="flex flex-row gap-2 items-center text-left">
                    {persona.id !== 'bible-chat' && (
                      <img
                        src={`/personas/${persona.id}.png`}
                        alt=""
                        width={28}
                        height={30}
                        className="rounded-full"
                      />
                    )}
                    {persona.name}
                  </div>
                  <div className="text-xs text-muted-foreground text-left line-clamp-1">
                    {persona.description}
                  </div>
                </div>

                <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
