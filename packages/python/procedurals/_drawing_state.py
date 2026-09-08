"""Internal portable frame lifecycle; native surface ownership stays in adapters.

drawing.fresh-raster-2d v0.1.0, motivated by pelines independent marks and
ciserp ordered path marks. No renderer, asset, callback or surface is retained.
"""
from dataclasses import dataclass
from types import MappingProxyType
from ._drawing import DrawingError, normalize_command, validate_environment


class FrameError(DrawingError):
    def __init__(self,code,command_index=None):
        self.command_index=command_index
        super().__init__(code)


def _immutable(value):
    if isinstance(value,dict):return MappingProxyType({k:_immutable(v) for k,v in value.items()})
    if isinstance(value,list):return tuple(_immutable(v) for v in value)
    return value


@dataclass(frozen=True,eq=False,slots=True)
class _Plan:
    kind:str
    environment:object=None
    base_index:int=0
    input_count:int=0
    slots:tuple=()


class FrameState:
    """Synchronous two-phase lifecycle with private identity-based pending plans."""
    def __init__(self):
        self._state='new'
        self._count=0
        self._environment=None
        self._pending=None

    @property
    def state(self):return self._state

    @property
    def count(self):return self._count

    def _error(self,code,index=None):
        if self._state!='completed':
            self._state='aborted'
            self._pending=None
            self._environment=None
        raise FrameError(code,index)

    def _reserve(self,state):
        if self._state!=state or self._pending is not None:self._error('INVALID_STATE')
        token=object();self._pending=token
        return token

    def _publish(self,reservation,plan,state):
        if self._state!=state or self._pending is not reservation:self._error('INVALID_STATE')
        self._pending=plan
        return plan

    def _match(self,plan,kind,state):
        if self._state!=state or self._pending is not plan or not isinstance(plan,_Plan) or plan.kind!=kind:
            self._error('INVALID_STATE')

    def prepare_begin(self,environment):
        reserved=self._reserve('new')
        try:env=_immutable(validate_environment(environment))
        except FrameError:self._error('INVALID_STATE')
        except DrawingError:self._error('INVALID_ENVIRONMENT')
        except BaseException:
            self.abort();raise
        return self._publish(reserved,_Plan('begin',environment=env),'new')

    def activate(self,plan):
        self._match(plan,'begin','new')
        self._environment=plan.environment
        self._pending=None;self._count=0;self._state='active'

    def fail_begin(self,plan,code):
        self._match(plan,'begin','new')
        if code not in ('UNSUPPORTED_CAPABILITY','RESOURCE_FAILURE','RENDER_FAILURE'):self._error('INVALID_STATE')
        self._error(code)

    def prepare_batch(self,commands):
        reserved=self._reserve('active')
        try:
            # Passive built-in containers only; snapshot within the bounded budget
            # before any command accessor can change the caller's original list.
            if type(commands) not in (list,tuple) or len(commands)>4096 or self._count>9007199254740991-len(commands):
                self._error('INVALID_BATCH')
            commands=tuple(commands)
            slots=[]
            for offset,command in enumerate(commands):
                try:slots.append(_immutable(normalize_command(command,self._environment)))
                except FrameError:self._error('INVALID_STATE')
                except DrawingError:self._error('INVALID_COMMAND',self._count+offset)
            return self._publish(reserved,_Plan('batch',base_index=self._count,input_count=len(commands),slots=tuple(slots)),'active')
        except FrameError:raise
        except BaseException:
            self.abort();raise

    def commit_batch(self,plan):
        self._match(plan,'batch','active')
        self._count=plan.base_index+plan.input_count
        self._pending=None

    def fail_batch(self,plan,source_offset=None):
        self._match(plan,'batch','active')
        if source_offset is not None and (type(source_offset) is not int or not 0<=source_offset<plan.input_count):
            self._error('INVALID_STATE')
        if source_offset is not None and plan.slots[source_offset]['outcome']=='noop':self._error('INVALID_STATE')
        self._error('RENDER_FAILURE',None if source_offset is None else plan.base_index+source_offset)

    def prepare_end(self):
        reservation=self._reserve('active')
        return self._publish(reservation,_Plan('end'),'active')

    def complete_end(self,plan):
        self._match(plan,'end','active')
        self._pending=None;self._environment=None;self._state='completed'

    def fail_end(self,plan):
        self._match(plan,'end','active');self._error('RENDER_FAILURE')

    def abort(self):
        if self._state=='completed':self._error('INVALID_STATE')
        self._pending=None;self._environment=None;self._state='aborted'
