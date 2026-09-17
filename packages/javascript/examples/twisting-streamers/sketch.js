import { createMeshStudySketch } from "../mesh-study-controls.js";
import { drawTwistingStreamers, materialsBSettings } from "../materials-b-studies.js";
createMeshStudySketch({slug:"twisting-streamers",title:"Twisting streamers",...materialsBSettings["twisting-streamers"],draw:drawTwistingStreamers});
