import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import IframeHeightWrapper from "./IframeHeightWrapper";

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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen antialiased">
        <IframeHeightWrapper>{children}</IframeHeightWrapper>
      </body>
    </html>
  );
}
