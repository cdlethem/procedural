import { createStudySketch } from "../study-controls.js";
import { drawSwirlingParticles, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "swirling-particles", title: "Swirling particles", ...systemsASettings["swirling-particles"], draw: drawSwirlingParticles });
