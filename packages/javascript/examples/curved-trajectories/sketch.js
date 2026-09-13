import { createStudySketch } from "../study-controls.js";
import { drawCurvedTrajectories, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "curved-trajectories", title: "Curved trajectories", ...systemsASettings["curved-trajectories"], draw: drawCurvedTrajectories });
