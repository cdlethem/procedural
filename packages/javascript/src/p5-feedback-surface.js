/** Retained RGBA8 feedback for p5 2.3.2 WEBGL. Host objects never enter the portable core. */
const shaders = new WeakMap();
const busyRenderers = new WeakSet();
const MAX_F32 = 3.4028234663852886e38;

export class P5FeedbackSurfaceError extends Error {
  constructor(code, message) { super(message); this.name = 'P5FeedbackSurfaceError'; this.code = code; }
}
const fail = (code, message) => { throw new P5FeedbackSurfaceError(code, message); };
function fields(value, keys) {
  if (value === null || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail('INVALID_INPUT', 'plain data record required');
  const present = Reflect.ownKeys(value);
  if (present.length !== keys.length || !keys.every(key => present.includes(key))) fail('INVALID_INPUT', 'record fields differ from contract');
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value,key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', 'accessor field is unsupported');
    result[key] = descriptor.value;
  }
  return result;
}
function transformValues(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 6) fail('INVALID_INPUT', 'transform must be an ordinary six-element array');
  const keys=Reflect.ownKeys(value);
  if (keys.length !== 7 || !keys.includes('length')) fail('INVALID_INPUT', 'transform has extra or missing fields');
  const output=[];
  for(let i=0;i<6;i++) {
    const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    if(!descriptor || !('value' in descriptor)) fail('INVALID_INPUT','transform must contain six data elements');
    output.push(descriptor.value);
  }
  return output;
}
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positiveFinite = value => finite(value) && value > 0;

const P5_FEEDBACK_VERTEX_SOURCE = `precision highp float;
attribute vec3 aPosition;
varying vec2 vTop;
void main() {
  vTop = aPosition.xy * 0.5 + 0.5;
  gl_Position = vec4(aPosition.xy, 0.0, 1.0);
}`;
const P5_FEEDBACK_FRAGMENT_SOURCE = `precision highp float;
varying vec2 vTop;
uniform sampler2D uHistory;
uniform sampler2D uSource;
uniform vec2 uHistorySize;
uniform vec2 uSourceSize;
uniform mat3 uTransform;
uniform float uDecay;
uniform float uSourceOpacity;
uniform float uHasSource;
vec2 clampedUV(vec2 uv, vec2 size) {
  return clamp(uv, 0.5 / size, 1.0 - 0.5 / size);
}
void main() {
  vec3 mapped = uTransform * vec3(vTop, 1.0);
  vec4 history = vec4(0.0);
  if (mapped.x >= 0.0 && mapped.x <= 1.0 && mapped.y >= 0.0 && mapped.y <= 1.0) {
    history = texture2D(uHistory, clampedUV(mapped.xy, uHistorySize)) * uDecay;
  }
  vec4 source = vec4(0.0);
  if (uHasSource > 0.5) {
    source = texture2D(uSource, clampedUV(vTop, uSourceSize)) * uSourceOpacity;
  }
  gl_FragColor = source + history * (1.0 - source.a);
}`;

function checkDimensions(width, height, density, max) {
  if (![width, height, density].every(positiveInteger)) fail('INVALID_INPUT', 'width, height and density must be positive safe integers');
  const physicalWidth = width * density, physicalHeight = height * density;
  if (!Number.isSafeInteger(physicalWidth) || !Number.isSafeInteger(physicalHeight) || physicalWidth > max || physicalHeight > max)
    fail('UNSUPPORTED', 'physical framebuffer dimensions exceed this context');
  return [physicalWidth, physicalHeight];
}
function context(p) {
  const r = p?._renderer, gl = r?.GL;
  if (p?.constructor?.VERSION !== '2.3.2' || !r?.isP3D || !gl || typeof p.createFramebuffer !== 'function') fail('UNSUPPORTED', 'p5 2.3.2 WEBGL is required');
  if (gl.isContextLost()) fail('CONTEXT_LOST', 'WebGL context was lost');
  if (!gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision) fail('UNSUPPORTED', 'fragment highp is required');
  return [r, gl];
}
function checkEntry(r, buffers) {
  if (r._clipping || r._clipDepths?.length || r.drawTarget()?._isClipApplied) fail('INVALID_STATE', 'active clipping is unsupported');
  if (buffers.includes(r.activeFramebuffer())) fail('INVALID_STATE', 'an owned framebuffer is the active target');
}
function checkSource(p, source, buffers) {
  if (source === null) return [null, 1, 1];
  if (buffers.includes(source)) fail('INVALID_INPUT', 'owned frame cannot be used as source');
  const ctor = p.constructor;
  const image = source instanceof ctor.Image;
  const graphics = source instanceof ctor.Graphics && !source._renderer?.isP3D;
  if (!image && !graphics) fail('INVALID_INPUT', 'source must be a loaded p5.Image or Canvas2D p5.Graphics');
  if (image && (!source.canvas || !source.width || !source.height || source._isLoading || source._loading)) fail('INVALID_INPUT', 'source image is not loaded');
  const canvas = source.canvas;
  if (!canvas || !positiveInteger(canvas.width) || !positiveInteger(canvas.height)) fail('INVALID_INPUT', 'source has no physical pixels');
  return [source, canvas.width, canvas.height];
}
function checkStep(p, data, buffers) {
  const { decay, transform:rawTransform, source, sourceOpacity } = fields(data,['decay','transform','source','sourceOpacity']);
  if (!finite(decay) || decay < 0 || decay > 1 || !finite(sourceOpacity) || sourceOpacity < 0 || sourceOpacity > 1) fail('INVALID_INPUT', 'decay and sourceOpacity must be in [0,1]');
  const transform=transformValues(rawTransform);
  if (!transform.every(x => finite(x) && Math.abs(x) <= MAX_F32)) fail('INVALID_INPUT', 'transform must contain six finite float32 values');
  const [a,b,c,d,e,f] = transform;
  if (Math.abs(a)+Math.abs(c)+Math.abs(e)>MAX_F32 || Math.abs(b)+Math.abs(d)+Math.abs(f)>MAX_F32) fail('INVALID_INPUT', 'transform row sum exceeds float32');
  return { decay, transform: [a,b,c,d,e,f], sourceInfo: checkSource(p, source, buffers), sourceOpacity };
}
function assertBuffer(buffer, width, height, density, gl, p) {
  if (buffer.width !== width || buffer.height !== height || buffer.density !== density || buffer.format !== p.UNSIGNED_BYTE || buffer.channels !== p.RGBA || buffer.textureFiltering !== p.LINEAR || buffer.useDepth || buffer.useStencil || buffer.antialias) fail('UNSUPPORTED', 'framebuffer settings were changed by p5');
  const bound = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.framebuffer);
  let complete;
  try { complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; }
  finally { gl.bindFramebuffer(gl.FRAMEBUFFER, bound); }
  if (!complete) fail('UNSUPPORTED', 'RGBA8 framebuffer is incomplete');
}
function makePair(p, r, gl, width, height, density) {
  const options = { width, height, density, format:p.UNSIGNED_BYTE, channels:p.RGBA, textureFiltering:p.LINEAR, depth:false, stencil:false, antialias:false };
  const pair = [];
  try {
    for (let i=0;i<2;i++) {
      const frame = p.createFramebuffer(options); pair.push(frame);
      assertBuffer(frame,width,height,density,gl,p);
    }
    for (const frame of pair) clearFrame(frame,r,gl);
    return pair;
  } catch(error) { for (const frame of pair) frame.remove(); throw error; }
}
function clearFrame(frame,r,gl) {
  frame.begin();
  try { gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
  finally { frame.end(); }
}
function cachedShader(p,r) {
  let shader = shaders.get(r);
  if (!shader) {
    shader = p.createShader(P5_FEEDBACK_VERTEX_SOURCE, P5_FEEDBACK_FRAGMENT_SOURCE);
    // createShader only constructs in p5 2.3.2; compilation is lazy without this preflight.
    shader.ensureCompiledOnContext(r);
    shaders.set(r,shader);
  }
  return shader;
}

export function createP5FeedbackSurface(p, options) {
  const [r, gl] = context(p);
  const { width, height, density } = fields(options,['width','height','density']);
  checkDimensions(width,height,density,gl.getParameter(gl.MAX_TEXTURE_SIZE));
  if (busyRenderers.has(r)) fail('INVALID_STATE', 'feedback surface call is reentrant');
  checkEntry(r,[]);
  const shader = cachedShader(p,r);
  let buffers = makePair(p,r,gl,width,height,density), current = 0, tick = 0, logicalWidth=width, logicalHeight=height, disposed=false, busy=false;
  const alive = () => { if (disposed) fail('DISPOSED', 'feedback surface has been disposed'); if (gl.isContextLost()) fail('CONTEXT_LOST', 'WebGL context was lost'); };
  const enter = () => { alive(); if (busy || busyRenderers.has(r)) fail('INVALID_STATE', 'feedback surface call is reentrant'); checkEntry(r,buffers); busy=true; busyRenderers.add(r); };
  const leave = () => { busy=false; busyRenderers.delete(r); };
  const api = {
    get frame() { alive(); return buffers[current]; },
    get tick() { alive(); return tick; },
    step(data) {
      enter();
      try {
        const args=checkStep(p,data,buffers);
        if (!Number.isSafeInteger(tick+1)) fail('INVALID_STATE','tick exceeds safe integer range');
        const target=buffers[1-current], history=buffers[current];
        const wasErasing=r._isErasing;
        let began=false;
        try {
          target.begin(); began=true;
          r._isErasing=false;
          gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
          p.blendMode(p.REPLACE); p.noStroke(); p.fill(255); p.shader(shader);
          const [source,sourceWidth,sourceHeight]=args.sourceInfo;
          shader.setUniform('uHistory',history);
          shader.setUniform('uSource',source ?? history);
          shader.setUniform('uHistorySize',[logicalWidth*density,logicalHeight*density]);
          shader.setUniform('uSourceSize',[sourceWidth,sourceHeight]);
          const [a,b,c,d,e,f]=args.transform;
          shader.setUniform('uTransform',[a,b,0,c,d,0,e,f,1]);
          shader.setUniform('uDecay',args.decay);
          shader.setUniform('uSourceOpacity',args.sourceOpacity);
          shader.setUniform('uHasSource',source ? 1 : 0);
          p.beginShape(p.TRIANGLE_STRIP);
          p.vertex(-1,-1,0); p.vertex(1,-1,0); p.vertex(-1,1,0); p.vertex(1,1,0);
          p.endShape();
        } finally { try { if (began) target.end(); } finally { r._isErasing=wasErasing; } }
        current=1-current; tick++;
        return api;
      } finally { leave(); }
    },
    draw(x,y,width,height) {
      enter();
      try { if (!finite(x)||!finite(y)||!positiveFinite(width)||!positiveFinite(height)) fail('INVALID_INPUT','draw position and size must be finite; size positive'); p.image(buffers[current],x,y,width,height); return api; }
      finally { leave(); }
    },
    reset() {
      enter();
      try { for (const frame of buffers) clearFrame(frame,r,gl); current=0; tick=0; return api; }
      finally { leave(); }
    },
    resize(width,height) {
      enter();
      try { checkDimensions(width,height,density,gl.getParameter(gl.MAX_TEXTURE_SIZE));
        const next=makePair(p,r,gl,width,height,density), old=buffers;
        buffers=next; current=0; tick=0; logicalWidth=width;logicalHeight=height;
        for (const frame of old) frame.remove(); return api;
      } finally { leave(); }
    },
    dispose() {
      if (disposed) return;
      if (busy || busyRenderers.has(r)) fail('INVALID_STATE','feedback surface call is reentrant');
      checkEntry(r,buffers); disposed=true;
      for (const frame of buffers) frame.remove(); buffers=[];
    }
  };
  return api;
}
