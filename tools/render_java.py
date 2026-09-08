#!/usr/bin/env python3
"""Render a configured JAVA2D sketch, optionally sweeping one numeric parameter."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.check_field_marks_pde import NAMES, SHA256
from tools.check_processing_runtime import CORE_SHA256
from tools.contact_sheet import source_images, compose, publish

IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z")
RUNTIME = ROOT / ".work/toolchains/processing-4.5.6"
ASSET_MAX_FILES = 4096
ASSET_MAX_BYTES = 256 * 1024 * 1024


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def asset_inventory(root):
    """Return a deterministic regular-file inventory for an explicit asset root."""
    root = Path(root).expanduser()
    if root.is_symlink() or not root.is_dir():
        raise ValueError("assets must be a non-symlink directory")
    root = root.absolute()
    records = []
    total = 0

    def visit(directory, depth=0):
        nonlocal total
        if depth > 256:
            raise ValueError("asset directory nesting exceeds 256 levels")
        try:
            entries = sorted(os.scandir(directory), key=lambda entry: entry.name)
        except OSError as error:
            raise ValueError("cannot inventory assets: " + str(error)) from error
        for entry in entries:
            path = Path(entry.path)
            if "\\" in entry.name or entry.name in (".", ".."):
                raise ValueError("ambiguous asset path: " + str(path))
            if entry.is_symlink():
                raise ValueError("asset symlinks are not allowed: " + str(path))
            if entry.is_dir(follow_symlinks=False):
                visit(path, depth + 1)
                continue
            if not entry.is_file(follow_symlinks=False):
                raise ValueError("asset special files are not allowed: " + str(path))
            resolved = path.absolute()
            try:
                relative = resolved.relative_to(root).as_posix()
            except ValueError as error:
                raise ValueError("asset path escapes root: " + str(path)) from error
            size = entry.stat(follow_symlinks=False).st_size
            total += size
            if len(records) >= ASSET_MAX_FILES:
                raise ValueError("asset file budget exceeds 4096 files")
            if total > ASSET_MAX_BYTES:
                raise ValueError("asset byte budget exceeds 256 MiB")
            records.append({"path": relative, "size": size, "sha256": digest(path)})

    visit(root)
    records.sort(key=lambda record: record["path"])
    return {"root": str(root), "files": records, "bytes": total}


def verify_asset_inventory(root, expected):
    actual = asset_inventory(root)
    expected_files = expected["files"]
    if actual["files"] != expected_files or actual["bytes"] != expected["bytes"]:
        raise RuntimeError("asset inventory changed: " + str(root))
    return actual


def stage_assets(source, destination, expected):
    destination.mkdir(parents=True)
    for record in expected["files"]:
        source_file = Path(source) / Path(record["path"])
        destination_file = destination / Path(record["path"])
        destination_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_file, destination_file)
    verify_asset_inventory(destination, expected)


def parameter(text):
    name, separator, raw = text.partition("=")
    if not separator or len(name) > 64 or not IDENTIFIER.fullmatch(name):
        raise ValueError("parameters use name=number")
    value = float(raw)
    if not math.isfinite(value):
        raise ValueError("parameter values must be finite")
    return name, value


def variants(parameters, sweep):
    values = {}
    for text in parameters:
        name, value = parameter(text)
        if name in values:
            raise ValueError("duplicate parameter: " + name)
        values[name] = value
    if sweep is None:
        return [values]
    name, separator, raw = sweep.partition("=")
    if not separator or not IDENTIFIER.fullmatch(name) or name in values:
        raise ValueError("sweep needs a new parameter name and comma-separated values")
    parts = raw.split(",")
    if not 1 <= len(parts) <= 16:
        raise ValueError("a sweep accepts 1 through 16 values")
    return [dict(values, **{name: parameter(name + "=" + value)[1]}) for value in parts]


def run(command, cwd, environment, timeout=60):
    # Terminate the full native process group on timeout, releasing its shared lease.
    process = subprocess.Popen(list(map(str, command)), cwd=cwd, env=environment,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
        raise RuntimeError("command timed out: " + str(command[0]))
    if process.returncode:
        raise RuntimeError("command failed: " + stdout + stderr)
    return stdout


def parse_frames(text):
    if text is None or text == "":
        raise ValueError("frames requires comma-separated ordinals")
    parts = text.split(",")
    if not 1 <= len(parts) <= 64 or any(part == "" for part in parts):
        raise ValueError("frames requires 1 through 64 ordinals")
    try:
        values = [int(part) for part in parts]
    except ValueError as error:
        raise ValueError("frames requires integer ordinals") from error
    if any(value < 1 or value > 10000 for value in values):
        raise ValueError("frame ordinals must be 1 through 10000")
    if values != sorted(set(values)):
        raise ValueError("frame ordinals must be strictly increasing and unique")
    return values


def wrapper(name, sequence=False):
    if sequence:
        return sequence_wrapper(name)
    # Only the validated class identifier enters Java source; values travel as arguments.
    return '''import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import processing.core.PApplet;
public final class RenderSnapshot extends CLASSNAME {
    private final long suppliedSeed;
    private final Map<String,Double> suppliedParameters;
    private final Path destination;
    private final int selectedFrame;
    private int draws;
    RenderSnapshot(long seed, Map<String,Double> parameters, Path output, int frame) {
        suppliedSeed=seed; suppliedParameters=parameters; destination=output; selectedFrame=frame;
    }
    @Override public void settings() {
        configureRender(suppliedSeed, Collections.unmodifiableMap(suppliedParameters));
        super.settings();
        if (!JAVA2D.equals(sketchRenderer()) || sketchPixelDensity()!=1)
            throw new IllegalArgumentException("render helper requires JAVA2D density1");
        if (sketchWidth()<1 || sketchHeight()<1 || (long)sketchWidth()*sketchHeight()>32000000L)
            throw new IllegalArgumentException("render dimensions exceed helper limit");
    }
    @Override public void draw() {
        if (++draws>selectedFrame) throw new IllegalStateException("unexpected additional draw");
        super.draw();
        if (!g.getClass().getName().equals("processing.awt.PGraphicsJava2D") || pixelDensity!=1)
            throw new IllegalStateException("unsupported render environment");
        if (draws<selectedFrame) { loop(); return; }
        noLoop();
        save(destination.resolve("frame.png").toString());
        try {
            String record="{\\"hook\\":\\"configureRender-v1\\",\\"frames\\":1,\\"width\\":"+width
                +",\\"draws\\":"+draws+",\\"selected_frame\\":"+selectedFrame
                +",\\"height\\":"+height+",\\"seed\\":"+suppliedSeed+"}";
            Files.write(destination.resolve("frame.json"), record.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) { throw new IllegalStateException(error); }
        exit();
    }
    public static void main(String[] args) {
        Thread.setDefaultUncaughtExceptionHandler((thread,error)->{error.printStackTrace();System.exit(1);});
        long seed=Long.parseLong(args[0]);
        Path output=Paths.get(args[1]);
        Map<String,Double> parameters=new LinkedHashMap<String,Double>();
        int frame=Integer.parseInt(args[2]);
        for(int i=3;i<args.length;i++) {
            String[] pair=args[i].split("=",2);
            parameters.put(pair[0],Double.valueOf(pair[1]));
        }
        PApplet.runSketch(new String[]{"--sketch-path="+output,"RenderSnapshot"},
            new RenderSnapshot(seed,parameters,output,frame));
    }
}
'''.replace("CLASSNAME", name)


def sequence_wrapper(name):
    return '''import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import processing.core.PApplet;
import processing.core.PImage;
public final class RenderSnapshot extends CLASSNAME {
    private final long suppliedSeed;
    private final Map<String,Double> suppliedParameters;
    private final Path destination;
    private final int[] requestedFrames;
    private int draws;
    private int captures;
    RenderSnapshot(long seed, Map<String,Double> parameters, Path output, int[] frames) {
        suppliedSeed=seed; suppliedParameters=parameters; destination=output; requestedFrames=frames;
    }
    @Override public void settings() {
        configureRender(suppliedSeed, Collections.unmodifiableMap(suppliedParameters));
        super.settings();
        if (!JAVA2D.equals(sketchRenderer()) || sketchPixelDensity()!=1)
            throw new IllegalArgumentException("render helper requires JAVA2D density1");
        if (sketchWidth()<1 || sketchHeight()<1 || (long)sketchWidth()*sketchHeight()>32000000L)
            throw new IllegalArgumentException("render dimensions exceed helper limit");
    }
    @Override public void draw() {
        ++draws;
        if (draws>requestedFrames[requestedFrames.length-1])
            throw new IllegalStateException("unexpected additional draw");
        super.draw();
        if (!JAVA2D.equals(sketchRenderer()) || !g.getClass().getName().equals("processing.awt.PGraphicsJava2D") || pixelDensity!=1)
            throw new IllegalStateException("unsupported render environment");
        if (captures<requestedFrames.length && draws==requestedFrames[captures]) {
            PImage snapshot=get();
            snapshot.save(destination.resolve(String.format("frame-%05d.png", draws)).toString());
            ++captures;
        }
        if (draws<requestedFrames[requestedFrames.length-1]) { loop(); return; }
        if (captures!=requestedFrames.length) throw new IllegalStateException("requested frame was not captured");
        noLoop();
        try {
            StringBuilder record=new StringBuilder("{\\"hook\\":\\"configureRender-v1\\",\\"frames\\":");
            record.append(captures).append(",\\"width\\":").append(width).append(",\\"height\\":").append(height)
                .append(",\\"draws\\":").append(draws).append(",\\"seed\\":").append(suppliedSeed)
                .append(",\\"requested_frames\\":[");
            for(int i=0;i<requestedFrames.length;i++) { if(i>0) record.append(','); record.append(requestedFrames[i]); }
            record.append("]}");
            Files.write(destination.resolve("frame.json"), record.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) { throw new IllegalStateException(error); }
        exit();
    }
    public static void main(String[] args) {
        Thread.setDefaultUncaughtExceptionHandler((thread,error)->{error.printStackTrace();System.exit(1);});
        long seed=Long.parseLong(args[0]);
        Path output=Paths.get(args[1]);
        int[] frames=Arrays.stream(args[2].split(",")).mapToInt(Integer::parseInt).toArray();
        Map<String,Double> parameters=new LinkedHashMap<String,Double>();
        for(int i=3;i<args.length;i++) { String[] pair=args[i].split("=",2); parameters.put(pair[0],Double.valueOf(pair[1])); }
        PApplet.runSketch(new String[]{"--sketch-path="+output,"RenderSnapshot"}, new RenderSnapshot(seed,parameters,output,frames));
    }
}
'''.replace("CLASSNAME", name)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sketch", type=Path, help="main PDE; adjacent Java tabs are compiled")
    parser.add_argument("--library", type=Path, required=True, help="explicit procedurals.jar")
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--frame", type=int, default=None, help="completed draw ordinal, 1 through 10000")
    parser.add_argument("--frames", help="comma-separated completed draw ordinals, 1 through 10000")
    parser.add_argument("--param", action="append", default=[], metavar="NAME=VALUE")
    parser.add_argument("--sweep", metavar="NAME=VALUE,VALUE")
    parser.add_argument("--assets", type=Path,
                        help="explicit regular-file asset root staged as data/ per variant")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    args = parser.parse_args(argv)
    try:
        batch = variants(args.param, args.sweep)
        if not 0 <= args.seed <= 4294967295:
            raise ValueError("seed must be an unsigned32 integer")
        if args.frame is not None and args.frames is not None:
            raise ValueError("--frame and --frames are mutually exclusive")
        if args.frames is not None:
            requested_frames = parse_frames(args.frames)
            sequence_mode = True
        else:
            requested_frames = [1 if args.frame is None else args.frame]
            sequence_mode = False
            if not 1 <= requested_frames[0] <= 10000:
                raise ValueError("frame must be 1 through 10000")
        selected_frame = requested_frames[0] if not sequence_mode else None
        sketch, library, output, jdk = [p.resolve() for p in
                                      (args.sketch, args.library, args.output, args.java_home)]
        if not sketch.is_file() or sketch.suffix != ".pde" or not IDENTIFIER.fullmatch(sketch.stem):
            raise ValueError("require a main PDE with a Java identifier filename")
        if sketch.stem == "RenderSnapshot":
            raise ValueError("RenderSnapshot is reserved by the helper")
        if len(list(sketch.parent.glob("*.pde"))) != 1:
            raise ValueError("this helper accepts one PDE plus adjacent Java tabs")
        assets = asset_inventory(args.assets) if args.assets is not None else None
        if assets is None and (sketch.parent / "data").exists():
            raise ValueError("asset-bearing sketches are not supported by this helper")
        if not output.is_relative_to(ROOT / ".work") or output == ROOT / ".work" or output.exists():
            raise ValueError("require a fresh output directory beneath repository .work")
        if not library.is_file():
            raise ValueError("missing library JAR")
        core = RUNTIME / "core-4.5.6.jar"
        archive = RUNTIME / "processing-4.5.6-linux-x64-portable.zip"
        if digest(core) != CORE_SHA256 or digest(archive) != SHA256:
            raise ValueError("pinned Processing runtime mismatch")
        pre = [RUNTIME / "preprocessor" / name for name in NAMES]
        with zipfile.ZipFile(archive) as official:
            for path in pre:
                if path.read_bytes() != official.read("Processing/lib/app/resources/modes/java/mode/" + path.name):
                    raise ValueError("preprocessor mismatch: " + path.name)
        tabs = sorted(sketch.parent.glob("*.java"))
        source = [sketch, *tabs]
        bridge = ROOT / "tests/native/PreprocessSketch.java"
        lease = ROOT / "tools/with_native_render_lock.py"
        inputs = [*source, library, core, archive, *pre, bridge, lease, Path(__file__),
                  ROOT / "tools/contact_sheet.py", *[jdk / p for p in
                  ("bin/java", "bin/javac", "release", "lib/modules")]]
        if assets is not None:
            inputs.extend(Path(assets["root"]) / record["path"] for record in assets["files"])
        before = {str(p): digest(p) for p in inputs}
    except (ValueError, OSError) as error:
        parser.error(str(error))
    output.mkdir(parents=True)
    report = {"status": "running", "seed": args.seed, "variants": [], "inputs_before": before,
              "selected_frame": selected_frame,
              "scope": "Configured selected-frame JAVA2D render; not conformance or recreation acceptance"}
    if sequence_mode:
        report.pop("selected_frame")
        report["requested_frames"] = requested_frames
    if assets is not None:
        report["assets"] = assets
    environment = os.environ.copy()
    for name in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(name, None)
    try:
        classes, snapshot, home = [output / p for p in ("classes", "source", "home")]
        for p in (classes, snapshot, home):
            p.mkdir()
        for p in source:
            shutil.copyfile(p, snapshot / p.name)
            if digest(snapshot / p.name) != before[str(p)]:
                raise RuntimeError("sketch changed while copying")
        java, javac = jdk / "bin/java", jdk / "bin/javac"
        preclasspath = os.pathsep.join(map(str, pre))
        classpath = os.pathsep.join(map(str, [classes, library, core]))
        run([javac, "--release", "17", "-cp", preclasspath, "-d", classes, bridge], output, environment)
        generated = output / (sketch.stem + ".java")
        run([java, "-Duser.home=" + str(home), "-cp", str(classes) + os.pathsep + preclasspath,
             "PreprocessSketch", snapshot / sketch.name, generated, sketch.stem], output, environment)
        host = output / "RenderSnapshot.java"
        host.write_text(wrapper(sketch.stem, sequence_mode))
        run([javac, "--release", "17", "-cp", classpath, "-d", classes, generated, host,
             *[snapshot / p.name for p in tabs]], output, environment)
        compiled_before = {str(p): digest(p) for p in classes.rglob("*.class")}
        for i, parameters in enumerate(batch):
            variant = output / ("variant-%02d" % i)
            variant.mkdir()
            staged_assets = variant / "data" if assets is not None else None
            if staged_assets is not None:
                stage_assets(Path(assets["root"]), staged_assets, assets)
            run([sys.executable, lease, "--timeout", "30", "--", "xvfb-run", "-a", java,
                 "-Duser.home=" + str(home), "-cp", classpath, "RenderSnapshot", args.seed, variant,
                 ",".join(map(str, requested_frames)) if sequence_mode else requested_frames[0],
                 *[key + "=" + str(value) for key, value in parameters.items()]], output, environment, 90)
            native = json.loads((variant / "frame.json").read_text())
            expected_count = len(requested_frames) if sequence_mode else 1
            if native.get("hook") != "configureRender-v1" or native.get("frames") != expected_count or native.get("seed") != args.seed:
                raise RuntimeError("incomplete native frame record")
            if native.get("draws") != requested_frames[-1]:
                raise RuntimeError("incomplete selected-frame execution")
            if not sequence_mode and native.get("selected_frame") != requested_frames[0]:
                raise RuntimeError("incomplete selected-frame execution")
            if sequence_mode and native.get("requested_frames") != requested_frames:
                raise RuntimeError("incomplete requested-frame execution")
            if sequence_mode:
                captures = []
                for frame in requested_frames:
                    image = variant / ("frame-%05d.png" % frame)
                    _, width, height = source_images([image])[0]
                    if [width, height] != [native["width"], native["height"]]:
                        raise RuntimeError("native/image dimensions differ")
                    captures.append({"frame": frame, "image": str(image),
                                     "image_sha256": digest(image)})
                report["variants"].append({"parameters": parameters, "captures": captures,
                                           "native": native})
            else:
                image = variant / "frame.png"
                _, width, height = source_images([image])[0]
                if [width, height] != [native["width"], native["height"]]:
                    raise RuntimeError("native/image dimensions differ")
                label = (args.sweep.split("=", 1)[0] + "-" + str(parameters[args.sweep.split("=", 1)[0]])) if args.sweep else "render"
                named_image = variant / (label + ".png")
                image.rename(named_image)
                image = named_image
                report["variants"].append({"parameters": parameters, "image": str(image),
                                           "image_sha256": digest(image), "native": native})
            if staged_assets is not None:
                verify_asset_inventory(staged_assets, assets)
        images = ([Path(capture["image"]) for variant in report["variants"]
                   for capture in variant["captures"]] if sequence_mode else
                  [Path(v["image"]) for v in report["variants"]])
        if sequence_mode:
            # Descriptive links retain canonical native filenames without copying pixels.
            labels = output / "contact-images"
            labels.mkdir()
            images = []
            for index, variant_record in enumerate(report["variants"]):
                for capture in variant_record["captures"]:
                    original = Path(capture["image"])
                    labelled = labels / ("variant-%02d-frame-%05d.png" % (index, capture["frame"]))
                    labelled.symlink_to(os.path.relpath(original, labels))
                    images.append(labelled)
        sheet = output / "contact-sheet.png"
        publish(compose(source_images(images), min(4, len(images)), 240), sheet)
        if assets is not None:
            report["assets_after"] = verify_asset_inventory(Path(assets["root"]), assets)
        after = {str(p): digest(p) for p in inputs}
        compiled_after = {str(p): digest(p) for p in classes.rglob("*.class")}
        if after != before or compiled_before != compiled_after:
            raise RuntimeError("render inputs changed during batch")
        report.update(status="passed", inputs_after=after, contact_sheet=str(sheet),
                      contact_sheet_sha256=digest(sheet),
                      generated_sha256={str(p): digest(p) for p in [generated, host]},
                      class_sha256_before=compiled_before, class_sha256_after=compiled_after)
    except Exception as error:
        report.update(status="failed", error=str(error))
        raise
    finally:
        (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(str(output / "report.json"))


if __name__ == "__main__":
    main()
