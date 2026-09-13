import { createStudySketch } from "../study-controls.js";
import { drawSteppedBlocks, materialsBSettings } from "../materials-b-studies.js";
createStudySketch({slug:"stepped-blocks",title:"Stepped blocks",...materialsBSettings["stepped-blocks"],draw:drawSteppedBlocks});
