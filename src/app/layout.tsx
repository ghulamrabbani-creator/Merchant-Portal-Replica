import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export const metadata: Metadata = {
  title: "Geidea Merchant Portal — Design Reference",
  description: "Internal visual reference replica. Not a production system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex h-full min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-page-bg px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
