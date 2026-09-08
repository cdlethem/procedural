"""Editable py5 field of marks: L length, P palette, B bars, S save."""
from pathlib import Path
import sys

# Run this development example directly from a repository checkout.
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import py5
from procedurals._py5_frame import Py5Frame
from mark_field import create_mark_field,mark_commands

PALETTES=((0x31a151,0xffa71e,0x05084c,0xde4638,0x3dbdb7),
          (0x2e0551,0xff00c7,0x01afc2,0xfdbe03,0xf4f9fd))
OUTPUT=Path(__file__).resolve().parents[4]/'.work/examples/py5-field-marks'


class FieldMarks(py5.Sketch):
    def settings(self):
        self.size(640,640,self.JAVA2D)
        self.pixel_density(1)

    def setup(self):
        self.no_loop()
        self.marks=create_mark_field(seed=42,columns=160,rows=160,pitch=4)
        self.max_length=16
        self.palette_index=0
        self.bars=False
        self.revision=0
        self.paint_marks()

    def paint_marks(self):
        frame=Py5Frame(self)
        completed=None
        try:
            frame.begin({'width':640,'height':640,'density':1,'background':0xece7da})
            batch=[]
            for command in mark_commands(self.marks,self.max_length,PALETTES[self.palette_index],self.bars):
                batch.append(command)
                if len(batch)==4096:
                    frame.batch(batch)
                    batch=[]
            frame.batch(batch)
            completed=frame.end()
            self.image(completed,0,0)
            self.revision+=1
            self.get_surface().set_title(
                f'Field marks — L length {self.max_length} · P palette {self.palette_index+1}'
                f' · B {"bars" if self.bars else "lines"} · S save')
        finally:
            if completed is not None:Py5Frame.release_completed(completed)
            elif frame.state!='completed':frame.abort()

    def save_piece(self):
        OUTPUT.mkdir(parents=True,exist_ok=True)
        destination=OUTPUT/'field-marks.png'
        self.save(str(destination),drop_alpha=False,use_thread=False)
        return destination

    def key_pressed(self):
        key=str(self.key).lower()
        if key=='s':
            print(self.save_piece())
            return
        if key=='l':self.max_length=32 if self.max_length==16 else 16
        elif key=='p':self.palette_index=1-self.palette_index
        elif key=='b':self.bars=not self.bars
        else:return
        self.paint_marks()


if __name__=='__main__':FieldMarks().run_sketch()
