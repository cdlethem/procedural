import { createStudySketch } from "../study-controls.js";
import { drawScatterEnvelopes, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "scatter-envelopes", title: "Scatter envelopes", ...pathsASettings["scatter-envelopes"], draw: drawScatterEnvelopes });
