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

export const journalArticles: JournalArticle[] = [
  {
    slug: "condition-standard-visit",
    title: "What a Condition & Standard visit actually covers",
    dek: "What is in the annual visit, what drops out with no roof access, and what still sits with the installer.",
    date: "2026-09-01",
    image: "/journal/inverter.jpg",
    imageAlt:
      "Electrical distribution board during a maintenance check, used to illustrate a Condition & Standard visit",
    imageCredit: "Photo: Pexels (freely licensed)",
    body: [
      "Fomo Maintenance is FOMO Energy’s annual aftercare program. Condition & Standard is the base visit, priced on system size: first 10 kWp at S$40/kWp, next 30 kWp at S$20/kWp, above 40 kWp at S$5/kWp. It is not a hardware replacement plan.",
      "In scope: inverter checks, module checks, localised cleaning, site tests, and a written O&M report. FOMO-installed outright systems also include remote checks in that base figure.",
      "If the roof cannot be walked, module checks and localised cleaning come out. The tariff does not change. The report states what was not done.",
      "New modules or a new inverter are not part of this visit. Those still sit with FOMO Energy as the installer. Optional Advanced preventive (+25%) and Monitoring (+12.5%, FOMO-installed outright only) exist. This note is about the base visit only.",
      "Quotes for systems FOMO Energy did not install are indicative until a site check. FOMO rent-to-own already includes maintenance; we do not sell this visit on top of that plan. Outright owners can request a quote from the calculator on this site.",
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
      "Condition & Standard treats soiling as a site fact, not a calendar. Where there is roof access, localised cleaning is part of the base scope. We lift the film that is actually on the glass. We do not wash an entire roof by default. Where there is no roof access, we still read the inverter and run site tests. We record soiling as a limit of the visit.",
      "A module that looks wet is not therefore clean. A wet film of silt is still a film. Infrared and production data together show whether the loss is optical or electrical. That distinction is the difference between a useful note and a wasted wash.",
      "If you are comparing quotes, ask what happens when the roof cannot be walked. A cheaper figure that assumes a full glass clean you cannot perform is incomplete. Fomo Maintenance prices Condition & Standard on system size. Roof access changes the scope, not the tariff.",
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
      "Condition & Standard site tests look at how the DC and AC sides are behaving on the day. Advanced preventive work goes further: DC and AC insulation measurements, and a thermal pass along visible cable runs. Humidity plus load likes to create a warm joint. IR hotspot work on the modules is the optical counterpart. A cell that is reverse-biasing because a connector is leaking current to earth will often show in both places.",
      "Coastal and industrial sites add salt and sulphur to the same moisture. Stainless labels still pit. Cable ties go brittle. A junction box that was fine at handover can grow a white crust on the terminals two monsoons later. This is a reason to measure. It is not a reason to assume the tropics are gentle because it rains.",
      "FOMO Energy did not necessarily install every array we quote. Systems from other installers are indicative until a site check confirms gland condition, isolator rating, and whether the roof can be accessed. Humidity does not care who hung the rails.",
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
      "FOMO-installed outright systems include remote checks in Condition & Standard. We can often see a fault code, a derate, or a silent comms loss before anyone climbs a ladder. Rent-to-own already includes maintenance, so there is no extra Fomo Maintenance contract. Arrays from other installers need a site check. We will not assume we already know the logger password or the isolator brand.",
      "Advanced preventive work is for owners who want the electrical picture, not only the running state: IR on the modules, insulation resistance on DC and AC, thermal on accessible cable. Those tests catch a hot isolator barrel or a high-resistance crimp while the plant is still producing. They are priced as a percentage of the Condition & Standard tariff because they scale with system size.",
      "When an inverter is actually dead, the report should say so in plain language: the code, the likely field, and whether the unit is still under the manufacturer’s cover. Fomo Maintenance writes that report. This page does not sell a replacement inverter. Hardware sits with FOMO Energy as the installer.",
    ],
  },
];

export function articleBySlug(slug: string): JournalArticle | undefined {
  return journalArticles.find((article) => article.slug === slug);
}
