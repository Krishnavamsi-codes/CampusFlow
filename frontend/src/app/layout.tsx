import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "IIITS Live Rooms",
  description: "Realtime classroom availability and schedule intelligence system for IIIT Sri City.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IIITS Live Rooms",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Background Ambient Glows */}
        <div className="fixed top-[-10%] left-[-20%] w-[80vw] h-[50vh] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none z-0" />
        <div className="fixed bottom-[-10%] right-[-20%] w-[80vw] h-[50vh] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none z-0" />
        
        <div className="relative min-h-screen bg-[#09090b] text-[#f4f4f5] pb-24 z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
