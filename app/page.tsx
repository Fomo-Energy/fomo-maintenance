import { About } from "@/components/About";
import { JournalTeaser } from "@/components/JournalTeaser";
import { PricingCalculator } from "@/components/PricingCalculator";

export default function HomePage() {
  return (
    <>
      <PricingCalculator />
      <About />
      <JournalTeaser />
    </>
  );
}
