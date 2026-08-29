import Image from "next/image";
import Link from "next/link";
import { journalArticles } from "@/lib/journal";

export function JournalTeaser() {
  return (
    <section className="border-t border-orange-100 bg-peach">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              Journal
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-ink md:text-4xl">
              Notes on solar maintenance in Singapore
            </h2>
          </div>
          <Link href="/journal/" className="cta-pill px-7 py-3 text-sm">
            Read the journal
          </Link>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {journalArticles.map((article) => (
            <Link
              key={article.slug}
              href={`/journal/#${article.slug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-orange-100"
            >
              <Image
                src={article.image}
                alt={article.imageAlt}
                width={800}
                height={520}
                className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  {new Date(article.date).toLocaleDateString("en-SG", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <h3 className="mt-2 text-lg font-bold leading-snug text-ink">
                  {article.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                  {article.dek}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
