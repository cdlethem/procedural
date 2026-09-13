import { createStudySketch } from "../study-controls.js";
import { drawBranchingNetworks, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "branching-networks", title: "Branching networks", ...systemsBSettings["branching-networks"], draw: drawBranchingNetworks });
