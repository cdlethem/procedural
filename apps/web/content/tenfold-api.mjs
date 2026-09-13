import { pathsAApiGuides } from "./paths-a-api.mjs";
import { pathsBApiGuides } from "./paths-b-api.mjs";
import { systemsAApiGuides } from "./systems-a-api.mjs";
import { systemsBApiGuides } from "./systems-b-api.mjs";
import { materialsAApiGuides } from "./materials-a-api.mjs";
import { materialsBApiGuides } from "./materials-b-api.mjs";
export const tenfoldApiGuides = {...pathsAApiGuides, ...pathsBApiGuides, ...systemsAApiGuides, ...systemsBApiGuides, ...materialsAApiGuides, ...materialsBApiGuides};
