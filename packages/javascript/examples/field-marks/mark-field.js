import { regularGrid, gradientNoise2D01, cyclicPalette } from '../../src/index.js';

/** Example composition motivated by 2018/Generativos/pelines, not a public operation.
 * Retain field attributes so palette and mark edits never resample the field.
 * These constants are composition choices, not recommended parameter ranges.
 */
export function createMarkField(seed=42,columns=160,rows=160,pitch=4) {
  const grid=regularGrid({origin:[pitch/2,pitch/2],spacing:[pitch,pitch],columns,rows});
  const field=gradientNoise2D01({seed});
  const marks={};
  for(const name of ['x','y','heading','lengthFactor','colourCycles'])marks[name]=new Float64Array(grid.size);
  const point=[0,0];
  for(let i=0;i<grid.size;i++) {
    grid.pointInto(i,point,0);const [x,y]=point;
    marks.x[i]=x;marks.y[i]=y;
    marks.heading[i]=4*Math.PI*field.sample(17+x*.009,17+y*.009);
    marks.lengthFactor[i]=field.sample(113+x*.013,113+y*.013);
    marks.colourCycles[i]=3*field.sample(271+x*.007,271+y*.007);
  }
  return marks;
}

/** Stream plain drawing values; the adapter owns validation and native execution. */
export function* markCommands(marks,maxLength,colors,bars=false) {
  const palette=cyclicPalette({colors});
  for(let i=0;i<marks.x.length;i++) {
    const x=marks.x[i],y=marks.y[i],cos=Math.cos(marks.heading[i]),sin=Math.sin(marks.heading[i]);
    const length=maxLength*marks.lengthFactor[i];
    if(length===0)continue;
    const dx=.5*length*cos,dy=.5*length*sin,rgb=palette.sample(marks.colourCycles[i]);
    if(bars) {
      const nx=-sin*1.25,ny=cos*1.25;
      yield {kind:'quad2',vertices:[[x-dx-nx,y-dy-ny],[x+dx-nx,y+dy-ny],
        [x+dx+nx,y+dy+ny],[x-dx+nx,y-dy+ny]],rgb,opacity8:180};
    } else {
      yield {kind:'segment2',from:[x-dx,y-dy],to:[x+dx,y+dy],rgb,opacity8:180,width:1,cap:'round'};
    }
  }
}
