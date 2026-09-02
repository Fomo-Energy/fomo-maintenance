# Rollback and Temporary-State Register

Status: Current

| Item | Opened | Owner | Reason | Current state | Removal condition |
| --- | ---: | --- | --- | --- | --- |
| Cleaning access confirmation | 2026-09-01 | FOMO Energy O&M operations | No authoritative property/roof-access source | Cleaning can be selected and priced, but fulfillment remains pending safe-access confirmation; no automated eligibility claim is made | Integrate an authoritative access assessment and prevent unconfirmed cleaning from reaching payment |
| Monitoring compatibility confirmation | 2026-09-01 | FOMO Energy O&M operations | No equipment compatibility registry | Monitoring is limited to FOMO-installed systems in UI/API, then marked pending compatibility confirmation | Integrate an authoritative installed-equipment registry and compatibility rule |
| Other-installer first-visit onboarding | 2026-09-01 | FOMO Energy product and engineering | No durable customer/site visit history | S$120 onboarding is omitted from automatic checkout to avoid charging repeat customers | Add durable site identity and visit history that can reliably identify a first visit |
| Live Testing checkout | 2026-09-02 | FOMO Energy product and engineering | Production Stripe-to-calendar flow requires a low-value real-payment check | Public Testing selection charges S$0.50, creates a `TESTING` event, and grants no service; the event must be deleted after validation | Remove the option when live validation is complete or replace it with authenticated operational tooling |
