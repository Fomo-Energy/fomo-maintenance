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
    slug: "soiling-singapore-rooftops",
    title: "Soiling on Singapore rooftops: haze, monsoon splash, and lost irradiance",
    dek: "Urban dust, transboundary haze, and wet-season splash films cut the light that actually reaches the cell. Here is what tropical soiling looks like on a landed-house array.",
    date: "2026-03-12",
    image: "/journal/soiling.jpg",
    imageAlt:
      "Rows of photovoltaic modules in bright sun, a soiling and irradiance context",
    imageCredit: "Photo: American Public Power Association / Unsplash",
    body: [
      "Singapore is not a desert, but rooftop modules still pick up a film. Construction fines from nearby works, tyre dust from expressways, pollen, and the sticky residue left when a haze event sits over the island all scatter light before it reaches the cell. After a dry spell the glass can look merely dull; production is already down.",
      "The northeast monsoon does not rinse arrays clean. Heavy rain often leaves a splash ring of grit along the lower edge of each module, especially on low-tilt landed-house roofs where water sheets slowly. Bird droppings bake on in the next clear spell and shade individual cells. Those cells then run hot relative to their neighbours.",
      "Condition & Standard work treats soiling as a site fact, not a calendar. Where there is roof access, localised cleaning is part of the base scope: we lift the film that is actually on the glass rather than washing an entire roof by default. Where there is no roof access, we still read the inverter and run site tests, and we record soiling as a limit of the visit instead of inventing a cleaning that did not happen.",
      "Owners sometimes ask whether a module that looks wet is therefore clean. It is not. A wet film of silt is still a film. Infrared and production data together tell you whether the loss is optical (soiling) or electrical (a string, a connector, an inverter). That distinction is the difference between a useful O&M note and a wasted wash.",
      "If you are comparing quotes, ask what happens when the roof cannot be walked. A cheaper figure that assumes a full glass clean you cannot perform is not cheaper; it is incomplete. Fomo Maintenance prices Condition & Standard on system size. Roof access changes the scope copy, not the tariff.",
    ],
  },
  {
    slug: "humidity-insulation-tropical-arrays",
    title: "Humidity, condensation, and insulation resistance in tropical arrays",
    dek: "Year-round moisture is the quiet stress on DC connectors, isolators, and inverter glands. Insulation tests catch it before a ground fault trips the plant.",
    date: "2026-05-08",
    image: "/journal/humidity.jpg",
    imageAlt: "Raindrops on glass against a dark storm sky",
    imageCredit: "Photo: Unsplash (freely licensed)",
    body: [
      "Relative humidity in Singapore sits high for most of the year. At night, metal glands, isolator enclosures, and the underside of modules cool faster than the air. Moisture condenses where the DC system is least visible: inside a poorly gasketed isolator, on a nicked cable jacket, around an MC4 that was not fully seated at install.",
      "That moisture is not dramatic. It does not announce itself with a bang. It lowers insulation resistance until the inverter’s residual-current monitoring trips, or until a single wet morning takes a string offline. By then the corrosion on a pin or the tracking on a PCB is already underway.",
      "Condition & Standard site tests include a look at how the DC and AC sides are actually behaving on the day. Advanced preventive work goes further: DC and AC insulation measurements, and a thermal pass along visible cable runs, looking for the warm joint that humidity plus load likes to create. IR hotspot work on the modules themselves is the optical counterpart — a cell that is reverse-biasing because a connector is leaking current to earth will often show in both places.",
      "Coastal and industrial sites add salt and sulphur to the same moisture. Stainless labels still pit. Cable ties go brittle. A junction box that was “fine at handover” can breathe enough to grow a white crust on the terminals two monsoons later. None of this is a reason to panic; it is a reason to measure, not to assume the tropics are gentle because it rains.",
      "Fomo Maintenance is an independent O&M company. We did not necessarily install the plant. Walk-in arrays from other contractors are quoted as indicative until a site check confirms gland condition, isolator IP rating, and whether the roof can be accessed at all. The humidity does not care who hung the rails.",
    ],
  },
  {
    slug: "inverter-faults-singapore-heat",
    title: "Inverter faults in Singapore heat: derating, isolators, and silent stoppages",
    dek: "Rooftop inverters live in a climate they were only partly designed for. Heat, DC isolators, and lost comms explain more “the solar stopped” calls than failed modules.",
    date: "2026-07-21",
    image: "/journal/inverter.jpg",
    imageAlt: "Electrician working on circuit breakers and cabling in a distribution board",
    imageCredit: "Photo: Pexels (freely licensed)",
    body: [
      "A Singapore roof in the early afternoon is a harsh place for power electronics. Even a well-specified string inverter will derate when its heat sink cannot shed the day’s load. That is not always a fault. It is physics. The plant still looks “on”; energy for the hour is simply missing. Owners notice the bill before they notice the fan.",
      "True stoppages cluster around a short list: DC isolators that have overheated and welded or opened, residual-current trips after a wet night, a failed string that drags an MPPT into a low-power state, and communications dropouts that make a healthy inverter look dead in the app. Distinguishing those four is the job of inverter checks, not a module wash.",
      "Fomo-installed outright systems include remote checks in Condition & Standard. We can often see a fault code, a derate, or a silent comms loss before anyone climbs a ladder. Rent-to-own arrays stay with FOMO Energy — maintenance is already in that agreement, and we do not sell a second contract over it. Arrays from other installers need a site check; we will not pretend we already know their logger password or their isolator brand.",
      "Advanced preventive add-on work is for owners who want the electrical picture, not only the running state: IR on the modules, insulation resistance on DC and AC, thermal on accessible cable. Those tests are how you catch a hot isolator barrel or a high-resistance crimp while the plant is still producing. They are priced as a percentage of the Condition & Standard tariff because they scale with system size, not with a made-up visit count.",
      "When an inverter is actually dead, the O&M report should say so in plain language: the code, the likely field, and whether the unit is under the manufacturer’s remaining cover. Fomo Maintenance writes that report. We do not sell a new inverter from this site. If you need hardware, that is a different conversation with your installer — for FOMO Energy clients, that is the sister brand.",
    ],
  },
];

export function articleBySlug(slug: string): JournalArticle | undefined {
  return journalArticles.find((article) => article.slug === slug);
}
