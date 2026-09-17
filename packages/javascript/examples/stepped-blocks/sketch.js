import { createMeshStudySketch } from "../mesh-study-controls.js";
import { drawSteppedBlocks, materialsBSettings } from "../materials-b-studies.js";
createMeshStudySketch({slug:"stepped-blocks",title:"Stepped blocks",...materialsBSettings["stepped-blocks"],draw:drawSteppedBlocks});
