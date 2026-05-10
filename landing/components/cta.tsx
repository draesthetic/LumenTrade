"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

export function CTA() {
  return (
    <section className="mx-auto mt-16 w-[94%] max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="glass-strong flex flex-col items-center gap-6 rounded-[40px] px-8 py-16 text-center"
      >
        <h2 className="text-3xl font-semibold text-white sm:text-4xl">Experience calm, high-fidelity trading.</h2>
        <p className="max-w-2xl text-muted">A private analytics space designed for focus, clarity, and confident decision-making.</p>
        <button className="group flex items-center gap-2 rounded-full bg-lime-300/90 px-6 py-3 text-sm font-semibold text-black shadow-glow">
          Join the private beta
          <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
      </motion.div>
    </section>
  );
}
