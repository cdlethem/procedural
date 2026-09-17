import { createCellularStudySketch } from "../cellular-quality-controls.js";
import { drawReactionSpots } from "../systems-a-studies.js";

createCellularStudySketch({ slug: "reaction-spots", title: "Reaction spots", legacyDraw: drawReactionSpots });
