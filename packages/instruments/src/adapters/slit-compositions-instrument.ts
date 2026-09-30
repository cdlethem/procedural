import { bundledSequenceIds, bundledSequenceInfo } from "../composition/frame-samples.js";
import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import { bundledRecordingIds, bundledRecordingInfo } from "../composition/recording-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);

const temporal: Condition = { mode: ["time"] };
const spatial: Condition = { mode: ["space"] };
const grouped: Condition = { order: ["comb", "interleave"] };
const wavesOffset: Condition = { offsetMode: ["wave"] };
const wavesScale: Condition = { scaleMode: ["wave"] };
const modulated = ["ramp", "wave", "alternate", "random"] as const;

const modeOptions: readonly Option[] = [["space", "Slice one image"], ["time", "Slit-scan a frame sequence"]];
const modulationOptions: readonly Option[] = [["none", "None"], ["ramp", "Ramp across the bands"], ["wave", "Wave"], ["alternate", "Alternate"], ["random", "Random per slice"]];

export const slitCompositionsDefinition: InstrumentDefinition = {
  id: "slit-compositions",
  title: "Slit Compositions",
  description: "Recompose one image through parallel slices with editable ordering, or slit-scan a short bundled frame sequence so time is stretched into bands. Each band is a vector strip; a slice table records which source position or frame every band shows.",
  renderer: "2d",
  parameters: [
    select("mode", "Method", "Slice one image: every band is a strip of the picture, so ordering recomposes it. Slit-scan: every band is one moment of a moving scene read along a thin line (the slit), so ordering reorders time. Both share one slice table; only the meaning of a band's source differs.", modeOptions),
    select("image", "Source image", "The bundled deterministic picture that is sliced. The seed re-tints and rearranges it. Binding your own image to a Studio layer is future host work.",
      bundledRasterIds.filter((id) => id !== "noise").map((id): Option => [id, bundledRasterInfo[id].title]), spatial),
    select("scene", "Source scene", "The bundled deterministic moving scene that is slit-scanned. The seed re-tints and rearranges it. Frames are generated, not decoded; host video or frame binding is future work.",
      bundledSequenceIds.map((id): Option => [id, `${bundledSequenceInfo[id].title} (${bundledSequenceInfo[id].duration} s)`]), temporal),
    n("frames", "Frames", "Frames in the sequence, evenly spaced over the scene's fixed duration. Fewer frames make the motion step; more make it fine.", 8, 96, 1, 2, 240, temporal, true),
    select("interpolation", "Between frames", "What a moment between two frames shows: the earlier frame (hold), the closer frame, or a cross-fade of both in linear light. Hold and closer show steps when bands outnumber frames.",
      [["hold", "Hold the earlier frame"], ["nearest", "Closer frame"], ["linear", "Cross-fade"]], temporal),

    select("direction", "Band direction", "Columns: vertical bands side by side. Rows: horizontal bands stacked.", [["columns", "Columns"], ["rows", "Rows"]]),
    n("slices", "Slices", "Source slices per repetition, and so the width of a band: the footprint width divided by slices times repeats. More slices read the source more finely; fewer make broad bands.", 4, 160, 1, 1, 600, undefined, true),
    n("repeats", "Repeats", "How many times the whole slice order is laid across the footprint; each repeat squeezes the picture or the time span into a proportionally narrower stretch.", 1, 6, 1, 1, 64, undefined, true),
    select("repeatMode", "Repeat order", "Play every repeat the same way, or play alternate repeats backwards. With one repeat this has no effect.", [["same", "Same"], ["alternate", "Alternate backwards"]], { repeats: { gte: 2 } }),
    select("order", "Order", "Which source slice each band shows. Sequence keeps it; reverse mirrors it; comb deals the slices into groups, so the picture appears once per group, thinned; interleave riffles the groups together; shuffle lets a fraction of the slices trade places.",
      [["sequence", "Sequence"], ["reverse", "Reverse"], ["comb", "Comb into groups"], ["interleave", "Interleave groups"], ["shuffle", "Seeded shuffle"]]),
    n("groups", "Groups", "Groups for comb and interleave (at most the slice count).", 2, 8, 1, 2, 64, grouped, true),
    n("disorder", "Disorder", "Fraction of the slices that trade places under shuffle. Which ones, and where they go, comes from each slice's own id, so raising it only adds movers.", 0, 1, .01, 0, 1, { order: ["shuffle"] }),
    n("phase", "Phase shift", "Rotate the whole order to the left by this fraction of the slices, wrapping round: a shifted picture, or time started somewhere else.", 0, 1, .01, -100, 100),

    select("timeCurve", "Time curve", "How position across the output becomes time in the sequence. Linear plays it at even speed; power lingers at one end; swing runs it back and forth; gesture lets a recorded stroke drive time, so a pause in the hand freezes it and a return replays it.",
      [["linear", "Linear"], ["power", "Power"], ["swing", "Swing"], ["gesture", "Recorded gesture"]], temporal),
    n("curvePower", "Power", "Exponent of the power curve: below 1 time rushes early and lingers late; above 1 it lingers early.", .25, 4, .01, .05, 20, { mode: ["time"], timeCurve: ["power"] }),
    n("swings", "Swings", "Half-cycles of back-and-forth: 0.5 is one smooth ease from start to end, 1 goes there and back.", .5, 4, .25, 0, 64, { mode: ["time"], timeCurve: ["swing"] }),
    select("gesture", "Gesture", "The bundled recorded stroke that drives time. Its own timing is kept, rests included.",
      bundledRecordingIds.map((id): Option => [id, bundledRecordingInfo[id].title]), { mode: ["time"], timeCurve: ["gesture"] }),
    select("gestureChannel", "Gesture channel", "Which part of the stroke is time: its horizontal position, its vertical position, or the distance travelled (only forward, and constant while the hand rests). Each is scaled to fill the window.",
      [["x", "Horizontal position"], ["y", "Vertical position"], ["distance", "Distance travelled"]], { mode: ["time"], timeCurve: ["gesture"] }),
    n("windowStart", "Window start", "Where in the sequence the mapped time begins, as a fraction of its duration. Outside 0 to 1 the end behaviour decides what is read.", 0, 1, .01, -10, 10, temporal),
    n("windowLength", "Window length", "How much of the sequence the whole output spans, as a fraction of its duration. Above 1 the sequence is passed more than once (with loop or mirror) or held (clamp).", .1, 2, .01, 0, 100, temporal),
    select("end", "Past the ends", "What time outside the sequence reads: hold the first or last frame, loop, mirror, or refuse (an error naming Window start, Window length and Time curve).",
      [["clamp", "Hold the end frame"], ["loop", "Loop"], ["mirror", "Mirror"], ["fail", "Refuse"]], temporal),

    n("slitX", "Slit position", "Where the slit crosses the frame, as a fraction of its width. Every band reads the scene along this same line at its own moment.", 0, 1, .01, -1, 2, temporal),
    n("slitAngle", "Slit angle", "Direction of the slit in degrees: 0 runs down the frame, 90 runs across it.", -90, 90, 1, -3600, 3600, temporal),
    n("slitBend", "Slit bend", "Bows the middle of the slit sideways, as a fraction of the frame; the slit becomes a curve through the scene.", -.5, .5, .01, -2, 2, temporal),
    n("slitLength", "Slit length", "How much of the frame the slit spans, as a fraction of its shorter side. Where a slit leaves the frame the band is empty.", .2, 1.5, .01, .01, 8, temporal),

    select("offsetMode", "Offset pattern", "Shift each band's content along its own length. Ramp, wave and alternate follow the band's place on the canvas; random belongs to the slice and travels with it when the order changes.", modulationOptions),
    n("offset", "Offset", "Largest shift, as a fraction of the band's length. Positive moves content down (columns) or right (rows).", 0, 1, .01, 0, 16, { offsetMode: modulated }),
    n("offsetPeriod", "Offset period", "Bands per cycle of the offset wave.", 2, 60, .5, .5, 1e6, wavesOffset),
    select("scaleMode", "Scale pattern", "Stretch each band's content along its own length about its middle, following the same patterns as offset.", modulationOptions),
    n("scale", "Scale", "Largest stretch in octaves: 1 doubles or halves the content.", 0, 1.5, .01, 0, 16, { scaleMode: modulated }),
    n("scalePeriod", "Scale period", "Bands per cycle of the scale wave.", 2, 60, .5, .5, 1e6, wavesScale),
    select("outside", "Beyond the source", "What a band reads where offset or scale carry it past the source: hold the edge, wrap round, mirror, or leave a gap.",
      [["clamp", "Hold the edge"], ["wrap", "Wrap"], ["mirror", "Mirror"], ["void", "Leave a gap"]]),

    n("fragments", "Fragments", "Windows that keep the unsliced source in place, so the recomposition can be judged against it. They show the picture (or one frame of the scene) exactly where it belongs.", 0, 12, 1, 0, 24, undefined, true),
    n("fragmentSize", "Fragment size", "Nominal side of a fragment as a fraction of the footprint; each varies by a quarter either way.", .1, .5, .01, .01, 1),
    n("fragmentMoment", "Fragment moment", "Which moment of the sequence the fragments show, as a fraction of its duration.", 0, 1, .01, 0, 1, temporal),
    select("mask", "Mask", "None draws bands across the whole footprint. Quilt clips them to the kept leaves of a Region Quilt partition; the rest is left empty.", [["none", "None"], ["quilt", "Quilt leaves"]]),
    n("maskGrid", "Quilt grid", "Cut coordinates on each side of the footprint for the mask partition.", 2, 24, 1, 2, 96, { mask: ["quilt"] }, true),
    n("maskCuts", "Quilt cuts", "Attempted binary subdivisions of the mask; more cuts make smaller leaves.", 0, 60, 1, 0, 400, { mask: ["quilt"] }, true),
    n("maskKeep", "Quilt keep", "Fraction of the leaves that show bands. A leaf keeps its place and id when this changes.", 0, 1, .01, 0, 1, { mask: ["quilt"] }),

    n("centerX", "Center X", "Horizontal centre of the footprint.", 0, 640, 1, -4096, 4096),
    n("centerY", "Center Y", "Vertical centre of the footprint.", 0, 640, 1, -4096, 4096),
    n("width", "Width", "Width of the footprint the bands fill.", 100, 640, 1, 1, 8192),
    n("height", "Height", "Height of the footprint the bands fill.", 100, 640, 1, 1, 8192),
    n("rotation", "Rotation", "Turns the whole footprint, in degrees, clockwise on screen.", -180, 180, 1, -3600, 3600),

    n("detail", "Detail", "Samples along every band. More resolve finer changes along its length and make more, shorter runs.", 12, 160, 1, 4, 400, undefined, true),
    select("color", "Color", "Source: the picture's own colors, posterized. Tonal ramp: lightness becomes the palette colors in order, dark to light. Ink: only the dark parts, in the first palette color, and everything lighter left empty.",
      [["source", "Source colors"], ["ramp", "Tonal ramp"], ["ink", "Ink only"]]),
    n("levels", "Tone steps", "Steps per color channel (source) or of lightness (ramp). Fewer steps merge more of a band into long runs and fewer rectangles.", 2, 16, 1, 2, 64, { color: ["source", "ramp"] }, true),
    n("threshold", "Ink threshold", "Lightness below which a sample is inked.", .05, .95, .01, 0, 1, { color: ["ink"] }),
    n("gap", "Gap", "Fraction of every band's width left empty between bands. Bands then stay separate strips, one rectangle per run.", 0, .9, .01, 0, .999),
  ],
  controlGroups: [
    { label: "Source", stage: "form", controls: ["mode", "image", "scene", "frames", "interpolation"] },
    { label: "Slices", stage: "process", controls: ["direction", "slices", "repeats", "repeatMode",
      { label: "Order", controls: ["order", "groups", "disorder", "phase"] }] },
    { label: "Time map", stage: "process", controls: ["timeCurve", "curvePower", "swings", "gesture", "gestureChannel", { label: "Window", controls: ["windowStart", "windowLength", "end"] }] },
    { label: "Slit", stage: "process", controls: ["slitX", "slitAngle", "slitBend", "slitLength"] },
    { label: "Shaping", stage: "process", controls: [{ label: "Offset", controls: ["offsetMode", "offset", "offsetPeriod"] },
      { label: "Scale", controls: ["scaleMode", "scale", "scalePeriod"] }, "outside"] },
    { label: "Fragments", stage: "material", controls: ["fragments", "fragmentSize", "fragmentMoment"] },
    { label: "Mask", stage: "process", controls: ["mask", "maskGrid", "maskCuts", "maskKeep"] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
    { label: "Drawing", stage: "material", controls: ["detail", "color", "levels", "threshold", "gap"] },
  ] satisfies ControlGroup[],
  defaults: {
    mode: "space", image: "portrait", scene: "walkers", frames: 48, interpolation: "linear",
    direction: "columns", slices: 96, repeats: 1, repeatMode: "same", order: "shuffle", groups: 3, disorder: .1, phase: 0,
    timeCurve: "linear", curvePower: 2, swings: 1, gesture: "sweep", gestureChannel: "distance", windowStart: 0, windowLength: 1, end: "clamp",
    slitX: .5, slitAngle: 0, slitBend: 0, slitLength: 1,
    offsetMode: "wave", offset: .05, offsetPeriod: 40, scaleMode: "none", scale: .3, scalePeriod: 20, outside: "clamp",
    fragments: 2, fragmentSize: .24, fragmentMoment: .5, mask: "none", maskGrid: 8, maskCuts: 14, maskKeep: .7,
    centerX: 320, centerY: 320, width: 460, height: 460, rotation: 0,
    detail: 96, color: "source", levels: 8, threshold: .5, gap: 0,
  },
};
