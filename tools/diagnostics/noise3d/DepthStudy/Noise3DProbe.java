package org.procedurals.fields;

/** Independently specified private CP18 probe, not package API or Processing noise. */
public final strictfp class Noise3DProbe {
    private static final int[][] GRAD = {
        {1,1,0},{-1,1,0},{1,-1,0},{-1,-1,0},
        {1,0,1},{-1,0,1},{1,0,-1},{-1,0,-1},
        {0,1,1},{0,-1,1},{0,1,-1},{0,-1,-1}
    };
    private final int seed;
    public Noise3DProbe(long seed) {
        if (seed < 0 || seed > 4294967295L) throw new IllegalArgumentException();
        this.seed = (int) seed;
    }
    private static void valid(double q) {
        if (!Double.isFinite(q) || Math.abs(q) > 1000000) throw new IllegalArgumentException();
    }
    public double sample(double x, double y, double z) {
        valid(x); valid(y); valid(z);
        int i = (int)Math.floor(x), j = (int)Math.floor(y), k = (int)Math.floor(z);
        double u = x-i, v = y-j, w = z-k;
        double fx = fade(u), fy = fade(v), fz = fade(w);
        double a = lerp(dot(i,j,k,u,v,w), dot(i+1,j,k,u-1,v,w), fx);
        double b = lerp(dot(i,j+1,k,u,v-1,w), dot(i+1,j+1,k,u-1,v-1,w), fx);
        double c = lerp(dot(i,j,k+1,u,v,w-1), dot(i+1,j,k+1,u-1,v,w-1), fx);
        double d = lerp(dot(i,j+1,k+1,u,v-1,w-1), dot(i+1,j+1,k+1,u-1,v-1,w-1), fx);
        double raw = lerp(lerp(a,b,fy),lerp(c,d,fy),fz);
        return Math.max(0.0,Math.min(1.0,0.5+0.5*raw));
    }
    private double dot(int i,int j,int k,double x,double y,double z) {
        int h = GradientNoise2D01.mix(GradientNoise2D01.corner(seed,i,j)^k^0xc2b2ae35);
        int[] g = GRAD[(int)(Integer.toUnsignedLong(h)%12)];
        double xy = g[0]*x + g[1]*y;
        return xy + g[2]*z;
    }
    private static double fade(double t) {
        double cube=t*t*t, a=t*6-15, b=t*a+10;
        return cube*b;
    }
    private static double lerp(double a,double b,double t) { return a+t*(b-a); }
}
