"use client";

import { motion } from "framer-motion";
import { Bot, CandlestickChart, LineChart, Radar, Sparkle } from "lucide-react";

const features = [
  {
    title: "Liquid Glass Dashboard",
    description: "Real-time NAV, equity curve, and drawdown profiling with cinematic clarity.",
    icon: CandlestickChart
  },
  {
    title: "Adaptive Risk Engine",
    description: "Algorithmic drawdown shields and adaptive risk guardrails.",
    icon: Radar
  },
  {
    title: "Signal Intelligence",
    description: "AI-ranked opportunity scoring with velocity and liquidity insight.",
    icon: Sparkle
  },
  {
    title: "Strategy Orchestration",
    description: "Coordinate multiple books with instant attribution and edge tracking.",
    icon: Bot
  },
  {
    title: "Precision Reporting",
    description: "Institutional-grade exportables, sharpe stacks, and high-fidelity visuals.",
    icon: LineChart
  }
];

export function FeatureGrid() {
  return (
    <section id="platform" className="mx-auto mt-16 w-[94%] max-w-6xl">
      <div className="flex flex-col gap-6 text-center">
        <h2 className="text-3xl font-semibold text-white sm:text-4xl">Every signal, elevated.</h2>
        <p className="mx-auto max-w-2xl text-muted">A luxury-grade analytics layer that feels calm, fluid, and uncompromisingly precise.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {features.map((feature, idx) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.05 }}
            className="glass rounded-3xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-lime-300/20 p-3 text-lime-200">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted">{feature.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
