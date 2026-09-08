"""Internal py5 JAVA2D adapter for drawing.fresh-raster-2d v0.1.0.

Native validation pending. Call synchronously on the sketch thread. Portable
state/commands remain Python values; only this adapter accesses py5/JVM objects.
Motivated by pelines and ciserp. No copied upstream implementation.
"""
from weakref import WeakSet
from ._drawing_state import FrameState, FrameError

_released = WeakSet()


def _image_field():
    # JPype resolves raw.image to the overloaded drawing method, not this field.
    from jpype import JClass
    return JClass('processing.core.PGraphics').class_.getField('image')


def _backing_image(raw):
    return _image_field().get(raw)


def _release(graphics, primary=None):
    if graphics is None:
        return
    failures=[]
    def attempt(action):
        try:return action()
        except BaseException as error: failures.append(error)
    try:
        if graphics in _released:return
        _released.add(graphics)
    except TypeError:
        # Malformed acquisition values need stable failure cleanup too.
        pass
    raw=attempt(lambda:getattr(graphics,'_instance',None))
    context=attempt(lambda:getattr(raw,'g2',None))
    image=attempt(lambda:_backing_image(raw)) if raw is not None else None
    if raw is not None:
        for name in ('g2','pixels'):attempt(lambda name=name:setattr(raw,name,None))
        attempt(lambda:_image_field().set(raw,None))
    # py5's optional numpy pixel access allocates additional backing views.
    for name in ('_np_pixels','_java_bb','_py_bb'):
        attempt(lambda name=name:setattr(graphics,name,None) if hasattr(graphics,name) else None)
    if context is not None:attempt(lambda:context.dispose())
    if image is not None:attempt(lambda:image.flush())
    if raw is not None:attempt(lambda:raw.dispose())
    if failures:
        if primary is not None:
            primary.add_note('py5 cleanup failures: '+', '.join(type(e).__name__ for e in failures))
        else:
            raise failures[0]


class Py5Frame:
    """Fresh owned Py5Graphics with explicit completed-output release."""
    def __init__(self,sketch,*,_factory=None):
        self._sketch=sketch
        self._factory=_factory
        self._state=FrameState()
        self._graphics=None

    @property
    def state(self):return self._state.state

    @property
    def count(self):return self._state.count

    def _cleanup(self,primary):
        if self.state!='completed':self._state.abort()
        graphics=self._graphics;self._graphics=None
        _release(graphics,primary)

    def _fail_begin(self,plan,code,cause):
        try:self._state.fail_begin(plan,code)
        except FrameError as error:raise error from cause

    def begin(self,environment):
        try:
            plan=self._state.prepare_begin(environment)
            try:
                import py5
                from jpype import JClass
                renderer=JClass('processing.awt.PGraphicsJava2D')
                available=(isinstance(self._sketch,py5.Sketch) and
                           getattr(self._sketch,'JAVA2D',None)=='processing.awt.PGraphicsJava2D' and
                           callable(getattr(self._sketch,'create_graphics',None)) and
                           all(callable(getattr(py5.Py5Graphics,name,None)) for name in
                               ('begin_draw','end_draw','reset_matrix','no_clip','color_mode',
                                'blend_mode','no_tint','background','no_fill','stroke',
                                'stroke_weight','stroke_cap','line','no_stroke','fill',
                                'begin_shape','vertex','end_shape')) and
                           all(hasattr(py5.Py5Graphics,name) for name in ('RGB','BLEND','ROUND','CLOSE')))
            except Exception:
                available=False
            if not available:self._state.fail_begin(plan,'UNSUPPORTED_CAPABILITY')
            env=plan.environment
            try:
                factory=self._sketch.create_graphics if self._factory is None else self._factory
                self._graphics=factory(env['width'],env['height'],self._sketch.JAVA2D)
                graphics=self._graphics
                if not isinstance(graphics,py5.Py5Graphics):raise RuntimeError('Expected Py5Graphics wrapper')
                raw=graphics._instance
                if not isinstance(raw,renderer):raise RuntimeError('Expected JAVA2D backing renderer')
                if raw.parent!=self._sketch._instance:raise RuntimeError('Surface belongs to another sketch')
                if self._factory is None:
                    # Configure only our own fresh, lazy allocation. An injected or
                    # integration-supplied surface must already satisfy readiness.
                    if raw.g2 is not None or _backing_image(raw) is not None or raw.pixels is not None:
                        raise RuntimeError('Expected fresh unallocated backing')
                    raw.pixelDensity=1
                    raw.setSize(env['width'],env['height'])
                probe=raw.checkImage()
                if probe is None:raise RuntimeError('No graphics context')
                probe.dispose()
                backing=_backing_image(raw)
                if (graphics.width!=env['width'] or graphics.height!=env['height'] or
                    graphics.pixel_density!=1 or graphics.pixel_width!=env['width'] or
                    graphics.pixel_height!=env['height'] or backing is None or
                    backing.getWidth(None)!=env['width'] or backing.getHeight(None)!=env['height']):
                    raise RuntimeError('Backing dimensions/density mismatch')
            except Exception as error:self._fail_begin(plan,'RESOURCE_FAILURE',error)
            try:
                graphics.begin_draw();graphics.reset_matrix();graphics.no_clip()
                graphics.color_mode(graphics.RGB,255.0,255.0,255.0,255.0)
                graphics.blend_mode(graphics.BLEND);graphics.no_tint()
                rgb=env['background']
                graphics.background(float((rgb>>16)&255),float((rgb>>8)&255),float(rgb&255))
            except Exception as error:self._fail_begin(plan,'RENDER_FAILURE',error)
            self._state.activate(plan)
        except BaseException as error:
            self._cleanup(error);raise

    def _draw(self,command):
        graphics=self._graphics
        rgba=tuple(float(c) for c in command['channels'])+(float(command['opacity8']),)
        points=command['points']
        if command['kind']=='segment2':
            graphics.no_fill();graphics.stroke(*rgba)
            graphics.stroke_weight(command['width']);graphics.stroke_cap(graphics.ROUND)
            graphics.line(*points[0],*points[1])
        else:
            graphics.no_stroke();graphics.fill(*rgba);graphics.begin_shape()
            for point in points:graphics.vertex(*point)
            graphics.end_shape(graphics.CLOSE)

    def batch(self,commands):
        try:
            plan=self._state.prepare_batch(commands)
            for offset,command in enumerate(plan.slots):
                if command['outcome']=='noop':continue
                try:self._draw(command)
                except Exception as cause:
                    try:self._state.fail_batch(plan,offset)
                    except FrameError as error:raise error from cause
            self._state.commit_batch(plan)
        except BaseException as error:
            self._cleanup(error);raise

    def end(self):
        try:
            plan=self._state.prepare_end()
            try:self._graphics.end_draw()
            except Exception as cause:
                try:self._state.fail_end(plan)
                except FrameError as error:raise error from cause
            self._state.complete_end(plan)
            completed=self._graphics;self._graphics=None
            return completed
        except BaseException as error:
            self._cleanup(error);raise

    def abort(self):
        self._state.abort()
        graphics=self._graphics;self._graphics=None
        _release(graphics)

    @staticmethod
    def release_completed(graphics):
        """After display/save, release owned backing resources once. Do not reuse."""
        _release(graphics)
