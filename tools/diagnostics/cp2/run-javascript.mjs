import { gradientNoise2D01 } from '../../../packages/javascript/src/gradient-noise-2d-01.js';

const [mode, seedText, xText, yText, coordinateScaleText, baseText, scaleOrHeadingText, stepText, countText] = process.argv.slice(2);
const seed = Number(seedText), coordinateScale = Number(coordinateScaleText), base = Number(baseText);
const angleScaleOrHeading = Number(scaleOrHeadingText), step = Number(stepText), count = Number(countText);
const buffer = new ArrayBuffer(8); const view = new DataView(buffer);
function bits(value) { view.setFloat64(0, value, false); return view.getBigUint64(0, false).toString(16).padStart(16, '0'); }
const field = mode === 'field' ? gradientNoise2D01({ seed }) : null;
let x = Number(xText), y = Number(yText);
for (let index = 0; index < count; index++) {
  let sample = 0;
  let heading;
  if (field !== null) {
    const queryX = x * coordinateScale;
    const queryY = y * coordinateScale;
    sample = field.sample(queryX, queryY);
    const mapped = angleScaleOrHeading * sample;
    heading = base + mapped;
  } else heading = angleScaleOrHeading;
  const dx = step * Math.cos(heading);
  const dy = step * Math.sin(heading);
  const nextX = x + dx;
  const nextY = y + dy;
  process.stdout.write(`${index}\t${bits(sample)}\t${bits(heading)}\t${bits(dx)}\t${bits(dy)}\t${bits(nextX)}\t${bits(nextY)}\n`);
  x = nextX; y = nextY;
}
