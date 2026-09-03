import { About } from "@/components/About";
import { JournalTeaser } from "@/components/JournalTeaser";
import { PricingCalculator } from "@/components/PricingCalculator";
import { StagingOperationsGuide } from "@/components/StagingOperationsGuide";
import { isStableStagingDeployment } from "@/lib/deployment-environment";

export default function HomePage() {
  const showStagingOperationsGuide = isStableStagingDeployment();

  return (
    <>
      <PricingCalculator />
      <About />
      <JournalTeaser />
      {showStagingOperationsGuide ? <StagingOperationsGuide /> : null}
    </>
  );
}
