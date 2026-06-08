import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NetworkStatus } from "@/components/ui/NetworkError";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: {
    default: "Client Sign-Off Dashboard",
    template: "%s | Client Sign-Off Dashboard",
  },
  description:
    "Manage client project sign-offs from kickoff to launch. Streamline reviews, approvals, and feedback.",
  openGraph: {
    title: "Client Sign-Off Dashboard",
    description:
      "Manage client project sign-offs from kickoff to launch. Streamline reviews, approvals, and feedback.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
        <NetworkStatus />
      </body>
    </html>
  );
}
