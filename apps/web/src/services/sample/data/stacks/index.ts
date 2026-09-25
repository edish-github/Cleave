import type { StackSpec } from "../../spec";
import { galaxiumTravels179 } from "./galaxium-travels-179";
import { galaxiumTravels184 } from "./galaxium-travels-184";
import { galaxiumTravels188, ledgerSync41, orbitPricing61 } from "./more";
import { orbitPricing57 } from "./orbit-pricing-57";

export const stackSpecs: StackSpec[] = [
  galaxiumTravels184,
  galaxiumTravels179,
  orbitPricing57,
  ledgerSync41,
  galaxiumTravels188,
  orbitPricing61,
];
