import Link from "next/link";
import { WORDLISTS } from "@/lib/vocabulario";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white py-10 px-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[12px] font-semibold tracking-widest text-[#9CA3AF] uppercase mb-2">
            Nawar · Vocabulario
          </p>
          <h1
            className="text-[28px] font-bold text-[#1D0084] leading-tight"
            style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
          >
            Elige una lista para practicar
          </h1>
          <p className="text-[14px] text-[#5A6480] mt-1">
            {WORDLISTS.length} lista{WORDLISTS.length !== 1 ? "s" : ""} disponible{WORDLISTS.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WORDLISTS.map(list => (
            <Link
              key={list.slug}
              href={`/${list.slug}`}
              className="group flex flex-col rounded-2xl border border-[#DDE6F5] hover:border-[#1D0084]/20 hover:shadow-[0_8px_32px_rgba(29,0,132,0.08)] transition-all duration-300 overflow-hidden bg-white"
            >
              {/* Emoji header */}
              <div
                className="flex items-center justify-center py-8 text-5xl"
                style={{ background: '#1D0084' }}
              >
                {list.emoji}
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#dde8f8] text-[#1D0084] eyebrow">
                    {list.level}
                  </span>
                  <span className="text-[12px] text-[#9CA3AF] font-medium">
                    {list.words.length} palabras
                  </span>
                </div>
                <h2
                  className="text-[18px] font-bold text-[#1D0084] group-hover:text-[#025dc7] transition-colors duration-200"
                  style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
                >
                  {list.title}
                </h2>
                <p className="text-[13px] text-[#9CA3AF]">{list.subtitle}</p>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#025dc7] group-hover:gap-3 transition-all duration-200 pt-1">
                  Empezar
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
