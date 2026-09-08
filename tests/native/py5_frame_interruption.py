"""Focused actual-resource Python BaseException propagation probe."""
from unittest.mock import patch
import py5
from py5_frame_failures import _new_frame,_cleanup,_released,ENVIRONMENT,SEGMENT


def run_interruption(sketch):
    frame,created=_new_frame(sketch)
    interruption=KeyboardInterrupt('registered interruption')
    try:
        frame.begin(ENVIRONMENT)
        with patch.object(py5.Py5Graphics,'stroke',side_effect=interruption):
            try:frame.batch([SEGMENT])
            except BaseException as error:
                assert error is interruption,'interruption was remapped or replaced'
            else:raise AssertionError('interruption was swallowed')
        assert frame.state=='aborted' and frame.count==0
        assert _released(created[0])
        return {'passed':True,'checks':1,'scope':'Injected Python interruption with actual Py5Graphics cleanup'}
    finally:_cleanup(frame,created)
