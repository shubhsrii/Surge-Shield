import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Surge Shield",
  description: "AI-powered hospital surge management system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50">
        {children}
      </body>
    </html>
  );
}
