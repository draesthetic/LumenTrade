"use client";

import { motion } from "framer-motion";

export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-lime-300/10 blur-[140px]"
      />
      <motion.div
        animate={{ y: [0, 20, 0], opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-[160px]"
      />
    </div>
  );
}
