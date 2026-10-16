import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { APP_NAME, APP_TAGLINE } from "@/lib/content";

const rubik = Rubik({ variable: "--font-rubik", subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-28">{children}</main>
      </body>
    </html>
  );
}
