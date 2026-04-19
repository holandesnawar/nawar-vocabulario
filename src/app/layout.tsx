import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import IframeHeightWrapper from "./IframeHeightWrapper";
import SiteHeader from "@/components/SiteHeader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vocabulario — Nawar",
  description: "Practica vocabulario neerlandés con ejercicios interactivos.",
  icons: {
    icon: "https://docs.holandesnawar.com/img/Nawar.favicon.png",
    shortcut: "https://docs.holandesnawar.com/img/Nawar.favicon.png",
    apple: "https://docs.holandesnawar.com/img/Nawar.favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen antialiased">
        <IframeHeightWrapper>
          <SiteHeader />
          {children}
        </IframeHeightWrapper>
      </body>
    </html>
  );
}
