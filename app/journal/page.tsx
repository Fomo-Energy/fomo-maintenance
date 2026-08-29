import type { Metadata } from "next";
import Image from "next/image";
import { journalArticles } from "@/lib/journal";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Notes on solar maintenance in Singapore from FOMO Energy’s Fomo Maintenance program.",
};

export default function JournalPage() {
  return (
    <div className="bg-white">
      <header className="border-b border-orange-100 bg-peach">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            Journal
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink md:text-5xl">
            Notes on solar maintenance in Singapore
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            Short notes on the annual visit and how Singapore weather treats
            rooftop arrays. Written by FOMO Energy for owners on the Fomo
            Maintenance program.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-24 px-6 py-16">
        {journalArticles.map((article) => (
          <article
            key={article.slug}
            id={article.slug}
            className="scroll-mt-28"
          >
            <p className="text-sm text-slate-500">
              {new Date(article.date).toLocaleDateString("en-SG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">
              {article.title}
            </h2>
            <p className="mt-3 text-lg text-slate-600">{article.dek}</p>
            <figure className="mt-8 overflow-hidden rounded-2xl bg-slate-100">
              <Image
                src={article.image}
                alt={article.imageAlt}
                width={1600}
                height={1000}
                className="h-auto w-full object-cover"
              />
              <figcaption className="bg-peach px-4 py-2 text-xs text-slate-500">
                {article.imageCredit}
              </figcaption>
            </figure>
            <div className="mt-8 space-y-5 text-[1.05rem] leading-7 text-slate-700">
              {article.body.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
