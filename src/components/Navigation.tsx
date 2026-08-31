"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Wallet, Gift, ListChecks, Receipt, ReceiptJapaneseYen, Settings, LogOut, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";

const navItems = [
  { href: "/salaries", label: "給与", icon: Wallet },
  { href: "/bonuses", label: "賞与", icon: Gift },
  { href: "/items", label: "項目", icon: ListChecks },
  { href: "/tax-return", label: "確定申告", icon: Receipt },
  { href: "/settings", label: "設定", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      <header className="z-40 hidden shrink-0 border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60 md:flex md:items-center md:justify-between md:px-6 md:py-3">
        <Link href="/salaries" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ReceiptJapaneseYen className="size-4" />
          </span>
          明細ラボ
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  active && "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction}>
          <SignOutButton />
        </form>
      </header>

      <header className="z-40 flex shrink-0 items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/60 md:hidden">
        <Link href="/salaries" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ReceiptJapaneseYen className="size-4" />
          </span>
          明細ラボ
        </Link>
        <form action={signOutAction}>
          <SignOutButton />
        </form>
      </header>

      <nav className="order-last z-40 flex h-[74px] shrink-0 items-center border-t bg-background/95 py-1 backdrop-blur-md md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] whitespace-nowrap text-muted-foreground",
                active && "font-medium text-primary"
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      ログアウト
    </Button>
  );
}
