package org.procedurals.fields;

/** Private algorithm investigation; not public operation conformance. */
public final class Noise3DCheck {
    private static void require(boolean value) { if(!value) throw new AssertionError(); }
    public static void main(String[] args) {
        long[] seeds={0,42,2147483648L};
        double[][] expected={{0.366039514541626,0.4834578037261963},
            {0.2388155460357666,0.6809909343719482},{0.3924393653869629,0.5797119140625}};
        for(int i=0;i<seeds.length;i++) {
            Noise3DProbe field=new Noise3DProbe(seeds[i]);
            require(field.sample(.25,.5,.75)==expected[i][0]);
            require(field.sample(-.25,1.5,-2.75)==expected[i][1]);
            require(field.sample(0,0,0)==.5 && field.sample(-1,2,-3)==.5);
            for(int axis=0;axis<3;axis++) {
                double[] a={.31,.67,.43},b=a.clone();a[axis]=1-1e-7;b[axis]=1+1e-7;
                require(Math.abs(field.sample(a[0],a[1],a[2])-field.sample(b[0],b[1],b[2]))<1e-5);
            }
            require(field.sample(.25,.5,.75)==expected[i][0]);
        }
        System.out.println("PASS:6 independently calculated dyadic vectors; lattice centers, repeat purity and three-axis boundary continuity checks");
    }
}
