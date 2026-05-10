"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Studio",
    price: "$149",
    desc: "For elite individual traders",
    features: ["Private glass dashboard", "NAV + drawdown suite", "Signal scoring", "Email support"]
  },
  {
    name: "Desk",
    price: "$399",
    desc: "For boutique teams",
    features: ["Multi-book attribution", "Portfolio orchestration", "Advanced exportables", "Priority support"],
    highlight: true
  },
  {
    name: "Institution",
    price: "Custom",
    desc: "For enterprise desks",
    features: ["Dedicated analytics pods", "White-glove onboarding", "On-premise options", "SLA + compliance"]
  }
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto mt-16 w-[94%] max-w-6xl">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-white sm:text-4xl">Premium by design.</h2>
        <p className="mt-3 text-muted">Choose a plan that matches your trading ambition.</p>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {plans.map((plan, idx) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.05 }}
            className={`glass rounded-3xl p-6 ${plan.highlight ? "border border-lime-300/40 shadow-glow" : "border border-white/10"}`}
          >
            <div className="text-sm uppercase tracking-[0.2em] text-muted">{plan.name}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{plan.price}</div>
            <p className="mt-2 text-sm text-muted">{plan.desc}</p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-lime-200" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="mt-6 w-full rounded-full border border-white/10 bg-white/5 py-2 text-sm text-white hover:border-white/30">
              Request access
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
