import { createStudySketch } from "../study-controls.js";
import { drawReactionStripes, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "reaction-stripes", title: "Reaction stripes", ...systemsASettings["reaction-stripes"], draw: drawReactionStripes });
