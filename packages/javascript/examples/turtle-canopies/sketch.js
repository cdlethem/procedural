import { createStudySketch } from "../study-controls.js";
import { drawTurtleCanopies, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "turtle-canopies", title: "Turtle canopies", ...systemsBSettings["turtle-canopies"], draw: drawTurtleCanopies });
