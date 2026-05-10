"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative mx-auto mt-10 w-[94%] max-w-6xl">
      <div className="absolute inset-0 -z-10 rounded-[40px] bg-gradient-to-br from-lime-300/10 via-cyan-400/5 to-white/5 blur-3xl" />
      <div className="glass-strong rounded-[40px] px-6 py-14 sm:px-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted"
            >
              <Sparkles className="h-4 w-4 text-lime-300" />
              Liquid glass analytics for elite traders
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              Precision trade intelligence
              <span className="block text-lime-200/90">wrapped in liquid glass.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-5 max-w-xl text-base text-muted sm:text-lg"
            >
              LumenTrade is a premium analysis platform that transforms every fill into a living story of risk, performance, and momentum.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <button className="group relative overflow-hidden rounded-full bg-lime-300/90 px-6 py-3 text-sm font-semibold text-black shadow-glow transition hover:scale-[1.02]">
                <span className="relative z-10">Request Early Access</span>
                <span className="absolute inset-0 -z-0 bg-gradient-to-r from-lime-200/80 via-white/50 to-lime-200/80 opacity-0 transition group-hover:opacity-100" />
              </button>
              <button className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/90 hover:border-white/30">
                Explore Platform
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="flex-1"
          >
            <div className="glass rounded-3xl border border-white/10 p-6 shadow-glass">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted">Lumen NAV</div>
                  <div className="text-2xl font-semibold text-white">₹ 1,842,220</div>
                </div>
                <div className="rounded-full bg-lime-300/20 px-3 py-1 text-xs text-lime-200">+18.6% YTD</div>
              </div>
              <div className="mt-6 grid gap-4">
                {["Risk drawdown", "Edge expectancy", "Position velocity"].map((label, idx) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{label}</span>
                      <ShieldCheck className="h-4 w-4 text-lime-200" />
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-gradient-to-r from-lime-300/80 to-cyan-300/60" style={{ width: `${70 - idx * 12}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-4 text-xs text-muted">
                <div className="flex items-center justify-between">
                  <span>Signal quality</span>
                  <span className="text-white">AA+ tier</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
