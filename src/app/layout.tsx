import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import "~/app/globals.css";
import { Providers } from "~/app/providers";
import { APP_NAME, APP_DESCRIPTION } from "~/lib/constants";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],

  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={jetbrainsMono.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
