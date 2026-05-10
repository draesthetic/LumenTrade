"use client";

import { motion } from "framer-motion";

const quotes = [
  {
    name: "A. Rao",
    title: "Chief Strategist",
    quote: "The signal clarity is unreal. LumenTrade feels like trading with a quiet edge."
  },
  {
    name: "M. Laurent",
    title: "Portfolio Architect",
    quote: "Every metric is intentional. The experience is calm, precise, and premium."
  },
  {
    name: "S. Patel",
    title: "Macro Director",
    quote: "We replaced three tools with LumenTrade. It feels like a private trading lab."
  }
];

export function Testimonials() {
  return (
    <section className="mx-auto mt-16 w-[94%] max-w-6xl">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-white sm:text-4xl">Built for decision-grade teams.</h2>
        <p className="mt-3 text-muted">Trusted by elite desks who value signal purity and design restraint.</p>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {quotes.map((quote, idx) => (
          <motion.div
            key={quote.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.05 }}
            className="glass rounded-3xl p-6"
          >
            <p className="text-sm text-white">“{quote.quote}”</p>
            <div className="mt-6 text-xs uppercase tracking-[0.2em] text-muted">{quote.name}</div>
            <div className="text-sm text-muted">{quote.title}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
