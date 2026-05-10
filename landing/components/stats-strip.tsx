"use client";

import { motion } from "framer-motion";

const stats = [
  { label: "Average ROI", value: "21.4%" },
  { label: "Drawdown Shield", value: "-8.2%" },
  { label: "Signal Precision", value: "97.6%" },
  { label: "Latency", value: "32ms" }
];

export function StatsStrip() {
  return (
    <section className="mx-auto mt-10 w-[94%] max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="glass flex flex-wrap items-center justify-between gap-6 rounded-3xl px-6 py-6"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-[140px]">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">{stat.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{stat.value}</div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
