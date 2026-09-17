import { createCellularStudySketch } from "../cellular-quality-controls.js";
import { drawReactionStripes } from "../systems-a-studies.js";

createCellularStudySketch({ slug: "reaction-stripes", title: "Reaction stripes", legacyDraw: drawReactionStripes });
