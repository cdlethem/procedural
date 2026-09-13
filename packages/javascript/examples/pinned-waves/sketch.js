import { createStudySketch } from "../study-controls.js";
import { drawPinnedWaves, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "pinned-waves", title: "Pinned waves", ...systemsBSettings["pinned-waves"], draw: drawPinnedWaves });
