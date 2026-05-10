"use client";

import { motion } from "framer-motion";
import { Globe, Shield } from "lucide-react";

export function InsightPanel() {
  return (
    <section id="insights" className="mx-auto mt-16 w-[94%] max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-8"
        >
          <h3 className="text-2xl font-semibold text-white">Command the full trade story.</h3>
          <p className="mt-3 text-muted">From intraday velocity to multi-month edge drift, LumenTrade keeps you inside the signal.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {["Edge attribution", "Liquidity momentum", "Position gravity", "Risk halos"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
                {item}
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-6"
        >
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center gap-3 text-lime-200">
              <Globe className="h-5 w-5" />
              <span className="text-sm uppercase tracking-[0.2em] text-muted">Global Sync</span>
            </div>
            <p className="mt-4 text-sm text-muted">Unified coverage across equities, futures, options, and macro indices.</p>
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center gap-3 text-lime-200">
              <Shield className="h-5 w-5" />
              <span className="text-sm uppercase tracking-[0.2em] text-muted">Security</span>
            </div>
            <p className="mt-4 text-sm text-muted">Encrypted data partitions with institutional access controls.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
