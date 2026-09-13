import { createStudySketch } from "../study-controls.js";
import { drawMazeGardens, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "maze-gardens", title: "Maze gardens", ...systemsBSettings["maze-gardens"], draw: drawMazeGardens });
