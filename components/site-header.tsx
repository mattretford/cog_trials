"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/trials", label: "Trials" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="text-xl font-semibold tracking-tight text-teal-900">
          Cog Trials
        </Link>
        <nav aria-label="Main navigation" className="flex gap-2">
          {navigation.map(({ href, label }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-50 text-teal-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
