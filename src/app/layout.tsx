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
  icons: {
    icon: "https://docs.holandesnawar.com/img/Nawar.favicon.png",
    shortcut: "https://docs.holandesnawar.com/img/Nawar.favicon.png",
    apple: "https://docs.holandesnawar.com/img/Nawar.favicon.png",
  },
};

// Script inline que aplica el tema guardado ANTES de la hidratación,
// para evitar el "flash" del tema equivocado en la primera pintada.
const themeScript = `
(function(){try{
  var t=localStorage.getItem('nawar-theme');
  if(t==='dark') document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <IframeHeightWrapper>{children}</IframeHeightWrapper>
      </body>
    </html>
  );
}
