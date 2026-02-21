import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gajraj Kirana Stores - Billing Software",
  description: "Desktop billing & inventory management for Gajraj Kirana Stores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen print:block print:min-h-0">
          <div className="print:hidden">
            <Sidebar />
          </div>
          <main className="flex-1 ml-64 print:ml-0 bg-background print:bg-white">
            <div className="p-6 print:p-0">
              {children}
            </div>
          </main>
        </div>
        <Toaster richColors position="top-right" />
        <VisualEditsMessenger />
      </body>
    </html>
  );
}
