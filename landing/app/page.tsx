import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { StatsStrip } from "@/components/stats-strip";
import { FeatureGrid } from "@/components/feature-grid";
import { InsightPanel } from "@/components/insight-panel";
import { Pricing } from "@/components/pricing";
import { Testimonials } from "@/components/testimonials";
import { CTA } from "@/components/cta";
import { Footer } from "@/components/footer";
import { AmbientBackground } from "@/components/ambient";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden bg-bg text-text">
      <AmbientBackground />
      <Navbar />
      <Hero />
      <StatsStrip />
      <FeatureGrid />
      <InsightPanel />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
