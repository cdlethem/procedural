const params = new URL(location.href).searchParams;
const encoded = params.get("c");
const config = JSON.parse(decodeURIComponent(encoded || ""));
window.__harnessDeniedRequests = [];
const nativeFetch = window.fetch.bind(window);
window.fetch = (...args) => {
  try { const target = new URL(args[0] instanceof Request ? args[0].url : args[0], location.href); if (target.origin !== location.origin) window.__harnessDeniedRequests.push(target.href); } catch {}
  return nativeFetch(...args);
};
const send = (message) => {
  if (window.__harnessDone) return;
  window.__harnessDone = true;
  window.__harnessResult = {type: "harness-result", ...message};
  window.parent.postMessage(window.__harnessResult, "*");
};
const diagnostic = (value) => {
  const text = String(value && value.stack ? value.stack : value);
  console.error(text);
};
window.addEventListener("error", (event) => diagnostic(event.error || event.message));
window.addEventListener("unhandledrejection", (event) => diagnostic(event.reason || "unhandled rejection"));

(async () => {
  try {
    const layer = await import(`/layer/${config.entrypoint}`);
    if (typeof layer.render !== "function") throw new Error("entrypoint must export render(p, context)");
    let instance;
    instance = new window.p5((p) => {
      p.setup = async () => {
        try {
          p.createCanvas(config.width, config.height, p.P2D);
          p.pixelDensity(config.pixelDensity);
          p.noLoop();
          p.clear();
          p.randomSeed(config.randomSeed);
          p.noiseSeed(config.noiseSeed);
          const context = {controls: config.controls, tick: 0, ticks: config.tick, width: config.width,
            height: config.height, randomSeed: config.randomSeed, noiseSeed: config.noiseSeed};
          if (typeof layer.setup === "function") await layer.setup(p, context);
          for (let tick = 1; tick <= config.tick; tick += 1) {
            context.tick = tick;
            await layer.render(p, context);
          }
          const canvas = p.canvas;
          const pixels = canvas.getContext("2d").getImageData(0, 0, config.width, config.height).data;
          let minAlpha = 255;
          for (let i = 3; i < pixels.length; i += 4) minAlpha = Math.min(minAlpha, pixels[i]);
          const dataUrl = canvas.toDataURL("image/png");
          send({ok: true, png: dataUrl.slice(dataUrl.indexOf(",") + 1), minAlpha});
        } catch (error) {
          diagnostic(error);
          send({ok: false});
        }
      };
    }, document.body);
  } catch (error) {
    diagnostic(error);
    send({ok: false});
  }
})();
