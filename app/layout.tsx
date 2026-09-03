import { Jost } from "next/font/google";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StagingEnvironmentBanner } from "@/components/StagingEnvironmentBanner";
import { isStableStagingDeployment } from "@/lib/deployment-environment";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | FOMO Energy O&M program`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  openGraph: {
    title: `${SITE_NAME} | FOMO Energy`,
    description: SITE_TAGLINE,
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
  const showStagingEnvironment = isStableStagingDeployment();

  return (
    <html lang="en-SG" className={jost.variable}>
      <body className="min-h-screen font-sans antialiased">
        {showStagingEnvironment ? <StagingEnvironmentBanner /> : null}
        <div className={showStagingEnvironment ? "pt-14" : undefined}>
          <a
            href="#main"
            className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:z-[110] focus:bg-white focus:px-3 focus:py-2 ${showStagingEnvironment ? "focus:top-16" : "focus:top-4"}`}
          >
            Skip to content
          </a>
          <Header stagingOffset={showStagingEnvironment} />
          <main id="main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
