import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { FlashToast } from "@/components/FlashToast";
import { authEnabled } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Starflare ERP",
  description: "Internal ERP for Starflare",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense>
          <FlashToast />
        </Suspense>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar showLogout={authEnabled()} logoutAction={logout} />
            <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto print:p-0 print:max-w-none">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
