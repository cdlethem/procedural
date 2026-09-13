import { createStudySketch } from "../study-controls.js";
import { drawBranchingSentences, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "branching-sentences", title: "Branching sentences", ...systemsBSettings["branching-sentences"], draw: drawBranchingSentences });
