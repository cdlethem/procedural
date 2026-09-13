import { pathsAStudies } from "./paths-a-studies.mjs";
import { pathsBStudies } from "./paths-b-studies.mjs";
import { systemsAStudies } from "./systems-a-studies.mjs";
import { systemsBStudies } from "./systems-b-studies.mjs";
import { materialsAStudies } from "./materials-a-studies.mjs";
import { materialsBStudies } from "./materials-b-studies.mjs";
export const tenfoldStudies = [...pathsAStudies, ...pathsBStudies, ...systemsAStudies, ...systemsBStudies, ...materialsAStudies, ...materialsBStudies];
