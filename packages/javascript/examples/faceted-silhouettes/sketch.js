import { createStudySketch } from "../study-controls.js";
import { drawFacetedSilhouettes, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "faceted-silhouettes", title: "Faceted silhouettes", ...pathsASettings["faceted-silhouettes"], draw: drawFacetedSilhouettes });
