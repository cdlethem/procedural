import { createStudySketch } from "../study-controls.js";
import { drawTwistingStreamers, materialsBSettings } from "../materials-b-studies.js";
createStudySketch({slug:"twisting-streamers",title:"Twisting streamers",...materialsBSettings["twisting-streamers"],draw:drawTwistingStreamers});
