export type JournalArticle = {
  slug: string;
  title: string;
  dek: string;
  date: string;
  image: string;
  imageAlt: string;
  imageCredit: string;
  body: string[];
};

const journalArticleEntries: JournalArticle[] = [
  {
    slug: "condition-standard-visit",
    title: "What an Essential Health Check actually covers",
    dek: "The annual aftercare visit, item by item: what is checked without roof access, and when deeper electrical testing or cleaning makes sense.",
    date: "2026-09-01",
    image: "/journal/inverter.jpg",
    imageAlt:
      "Electrical distribution board during an Essential Health Check",
    imageCredit: "Photo: Pexels (freely licensed)",
    body: [
      "An annual Essential Health Check is FOMO Energy aftercare for owners who hold the system outright. It starts at S$199 and scales with system size. It is a read of the plant, not a hardware replacement plan.",
      "The visit covers an inverter and fault-log review, accessible electrical checks, a generation sanity check, a remote pre-check when available, and a digital maintenance report. It does not require roof access and does not include panel cleaning, deeper DC-side testing, repairs, or replacement parts.",
      "Electrical Assurance includes everything in Essential plus deeper DC-side safety and performance testing using professional solar testing equipment. It is for owners who need more than a running-state review.",
      "New modules and a new inverter still sit with the installer. For FOMO Energy arrays, that is FOMO Energy. Fomo Maintenance writes the code, the likely field, and whether manufacturer cover is still in play. It does not sell a replacement from this program.",
      "Full panel cleaning is priced separately and is performed only after safe roof access has been confirmed. FOMO rent-to-own already includes maintenance under that agreement, so this visit is not sold over it. Owners of other-installer systems may need a one-time onboarding review; because this site cannot verify prior visit history, that fee is not charged automatically online.",
    ],
  },
  {
    slug: "soiling-singapore-rooftops",
    title: "Soiling on Singapore rooftops",
    dek: "Haze, monsoon splash, and urban dust cut the light that reaches the cell.",
    date: "2026-03-12",
    image: "/journal/soiling.jpg",
    imageAlt:
      "Rows of photovoltaic modules in bright sun, a soiling and irradiance context",
    imageCredit: "Photo: American Public Power Association / Unsplash",
    body: [
      "Singapore is not a desert. Rooftop modules still pick up a film. Construction fines, tyre dust, pollen, and haze residue all scatter light before it reaches the cell. After a dry spell the glass can look only dull. Production is already down.",
      "The northeast monsoon does not rinse arrays clean. Heavy rain often leaves a splash ring of grit along the lower edge of each module. That is common on low-tilt landed-house roofs, where water sheets slowly. Bird droppings bake on in the next clear spell and shade individual cells. Those cells then run hot relative to their neighbours.",
      "Panel cleaning is a separate full-array service, not part of the Essential Health Check or Electrical Assurance package. It starts at S$450 and is performed only where safe roof access has been confirmed. Without that confirmation, no roof work proceeds.",
      "A module that looks wet is not therefore clean. A wet film of silt is still a film. Infrared and production data together show whether the loss is optical or electrical. That distinction is the difference between a useful note and a wasted wash.",
      "If you are comparing quotes, separate diagnostic work from cleaning. The Essential Health Check requires no roof access; cleaning is priced independently so the package does not promise roof work that cannot safely be performed.",
    ],
  },
  {
    slug: "humidity-insulation-tropical-arrays",
    title: "Humidity and insulation in tropical arrays",
    dek: "Year-round moisture stresses DC connectors, isolators, and inverter glands. Insulation tests catch it early.",
    date: "2026-05-08",
    image: "/journal/humidity.jpg",
    imageAlt: "Raindrops on glass against a dark storm sky",
    imageCredit: "Photo: Unsplash (freely licensed)",
    body: [
      "Relative humidity in Singapore sits high for most of the year. At night, metal glands, isolator enclosures, and the underside of modules cool faster than the air. Moisture condenses where the DC system is least visible: inside a poorly gasketed isolator, on a nicked cable jacket, around an MC4 that was not fully seated at install.",
      "That moisture is quiet. It lowers insulation resistance until residual-current monitoring trips, or until a wet morning takes a string offline. By then, corrosion on a pin or tracking on a board may already have started.",
      "An Essential Health Check reviews the inverter, fault logs, accessible electrical equipment, and generation. Electrical Assurance goes further with deeper DC-side safety and performance testing using professional solar testing equipment. Humidity plus load likes to create a warm joint, which is why measurement matters when a deeper electrical picture is required.",
      "Coastal and industrial sites add salt and sulphur to the same moisture. Stainless labels still pit. Cable ties go brittle. A junction box that was fine at handover can grow a white crust on the terminals two monsoons later. This is a reason to measure. It is not a reason to assume the tropics are gentle because it rains.",
      "FOMO Energy did not necessarily install every array we maintain. Other-installer systems may require a one-time onboarding review because logger access and equipment history are not known automatically. Humidity does not care who hung the rails.",
    ],
  },
  {
    slug: "inverter-faults-singapore-heat",
    title: "Inverter faults in Singapore heat",
    dek: "Heat, DC isolators, and lost comms explain more stoppages than failed modules.",
    date: "2026-07-21",
    image: "/journal/inverter.jpg",
    imageAlt:
      "Electrician working on circuit breakers and cabling in a distribution board",
    imageCredit: "Photo: Pexels (freely licensed)",
    body: [
      "A Singapore roof in the early afternoon is a harsh place for power electronics. Even a well-specified string inverter will derate when its heat sink cannot shed the day’s load. That is not always a fault. It is physics. The plant still looks on. Energy for the hour is simply missing. Owners often notice the bill before they notice the fan.",
      "True stoppages cluster around a short list: DC isolators that have overheated and welded or opened, residual-current trips after a wet night, a failed string that drags an MPPT into a low-power state, and communications dropouts that make a healthy inverter look dead in the app. Distinguishing those four is the job of inverter checks, not a module wash.",
      "The Essential Health Check includes a remote pre-check when access is available. We can often see a fault code, a derate, or a silent communications loss before the visit. Rent-to-own already includes maintenance, so there is no extra Fomo Maintenance package to buy.",
      "Electrical Assurance is for owners who want a deeper DC-side safety and performance picture, not only the running state. The work uses professional solar testing equipment and its price scales directly with system size.",
      "When an inverter is actually dead, the report should say so in plain language: the code, the likely field, and whether the unit is still under the manufacturer’s cover. Fomo Maintenance writes that report. This page does not sell a replacement inverter. Hardware sits with FOMO Energy as the installer.",
    ],
  },
];

export const journalArticles = [...journalArticleEntries].sort((left, right) =>
  right.date.localeCompare(left.date),
);

export function articleBySlug(slug: string): JournalArticle | undefined {
  return journalArticles.find((article) => article.slug === slug);
}
