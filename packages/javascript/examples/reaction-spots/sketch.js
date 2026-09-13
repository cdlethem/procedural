import { createStudySketch } from "../study-controls.js";
import { drawReactionSpots, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "reaction-spots", title: "Reaction spots", ...systemsASettings["reaction-spots"], draw: drawReactionSpots });
