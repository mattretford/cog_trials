import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cog Trials",
    template: "%s | Cog Trials",
  },
  description:
    "A home for publicly available clinical trial information about dementia and cognitive disorders.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:p-4"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-20"
        >
          {children}
        </main>
        <footer className="border-t border-slate-200">
          <div className="mx-auto max-w-5xl px-6 py-6 text-sm text-slate-600">
            Cog Trials · Dementia and cognitive disorder research
          </div>
        </footer>
      </body>
    </html>
  );
}
