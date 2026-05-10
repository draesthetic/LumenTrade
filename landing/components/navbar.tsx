"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

export function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="sticky top-4 z-50 mx-auto flex w-[94%] max-w-6xl items-center justify-between rounded-3xl border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-lime-300/90 to-cyan-300/80 shadow-glow" />
        <div className="text-sm font-semibold tracking-tight">LumenTrade</div>
      </div>
      <div className="hidden items-center gap-8 text-sm text-muted md:flex">
        <a className="hover:text-white" href="#platform">Platform</a>
        <a className="hover:text-white" href="#insights">Insights</a>
        <a className="hover:text-white" href="#pricing">Pricing</a>
        <a className="hover:text-white" href="#security">Security</a>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="/app"
          className="group flex items-center gap-2 rounded-full border border-lime-300/40 bg-lime-300/10 px-4 py-2 text-sm font-semibold text-lime-100 transition hover:border-lime-200 hover:bg-lime-300/20"
        >
          Open App
          <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
        <button className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10">
          Get Invite
        </button>
      </div>
    </motion.nav>
  );
}
