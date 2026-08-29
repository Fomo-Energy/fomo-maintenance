import { Jost } from "next/font/google";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Singapore solar operations and maintenance`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Independent solar operations and maintenance in Singapore. Sister brand to FOMO Energy. Get an annual Condition & Standard quote in SGD.",
  openGraph: {
    title: `${SITE_NAME} | Singapore solar O&M`,
    description:
      "Independent operations and maintenance for Singapore solar systems. Sister brand to FOMO Energy.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_SG",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-SG" className={jost.variable}>
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
