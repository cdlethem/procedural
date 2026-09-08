package org.procedurals.topology;


import java.lang.reflect.Field;

import java.math.BigDecimal;

import java.math.BigInteger;

import java.util.ArrayList;

import java.util.Arrays;

import java.util.LinkedHashMap;

import java.util.LinkedList;

import java.util.List;

import java.util.Map;


/** Native Java carrier, ownership, indexed-access, and bounded-work checks for CP6. */
public final class BranchTreeNative {

    private static int assertions;

    private static volatile long sink;

    private interface Action {
         void run();
         }

    private static final class UnsupportedNumber extends Number {

        public int intValue() {
             return 1;
             }
         public long longValue() {
             return 1L;
             }

        public float floatValue() {
             return 1f;
             }
         public double doubleValue() {
             return 1d;
             }

    }

    private static void check(boolean value, String message) {
         assertions++;
         if (!value) throw new AssertionError(message);
         }

    private static List<Object> list(Object... values) {
         return new ArrayList<Object>(Arrays.asList(values));
         }

    private static Map<String,Object> map(Object... values) {
         Map<String,Object> m=new LinkedHashMap<String,Object>();
         for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]);
         return m;
         }

    private static Map<String,Object> root(Object x,Object y,Object h,Object length) {
         return map("origin",list(x,y),"heading",h,"length",length);
         }

    private static Map<String,Object> slot(Object p,Object lo,Object hi) {
         return map("probability",p,"turn",list(lo,hi));
         }

    private static Map<String,Object> rule(Object lo,Object hi,List<Object> slots) {
         return map("lengthScale",list(lo,hi),"slots",slots);
         }

    private static Map<String,Object> config(Object seed,Map<String,Object> root,List<Object> rules,Object max) {
         return map("seed",seed,"root",root,"rules",rules,"maxSegments",max);
         }

    private static Map<String,Object> ordinary() {
         return config(42.0,root(0.0,0.0,0.0,16.0),list(rule(.5,.5,list(slot(1.0,0.0,0.0)))),100.0);
         }

    private static void expected(String code,Action action) {
         try {
             action.run();
             throw new AssertionError("expected "+code);
             }
         catch (BranchTree2D.BranchException e) {
             check(code.equals(e.code),"expected "+code+" got "+e.code);
             }
         }

    private static void invalid(Map<String,Object> input) {
         expected("INVALID_INPUT", () -> BranchTree2D.generate(input));
         }

    private static long checksum(BranchTree2D r) {
         long h=0xcbf29ce484222325L;
         double[] s=new double[4];
         for(int i=0;i<r.size();i++){
            r.segmentInto(i,s,0);
            for(double v:s)h=(h^Double.doubleToRawLongBits(v))*0x100000001b3L;
            h=(h^r.parentAt(i))*0x100000001b3L;
            h=(h^r.generationAt(i))*0x100000001b3L;
            h=(h^r.childCountAt(i))*0x100000001b3L;
            h=(h^Double.doubleToRawLongBits(r.headingAt(i)))*0x100000001b3L;
            h=(h^Double.doubleToRawLongBits(r.lengthAt(i)))*0x100000001b3L;
            }
        return h;
         }


    private static void nonfinite() {

        double[] bad={
            Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY}
        ;

        for(double v:bad){

            Map<String,Object> x=ordinary();
             ((List<Object>)((Map<String,Object>)x.get("root")).get("origin")).set(0,v);
             invalid(x);

            x=ordinary();
             ((Map<String,Object>)x.get("root")).put("heading",v);
             invalid(x);

            x=ordinary();
             ((Map<String,Object>)x.get("root")).put("length",v);
             invalid(x);

            x=ordinary();
             ((List<Object>)((Map<String,Object>)((List<Object>)x.get("rules")).get(0)).get("lengthScale")).set(0,v);
             invalid(x);

            x=ordinary();
             ((Map<String,Object>)((List<Object>)((Map<String,Object>)((List<Object>)x.get("rules")).get(0)).get("slots")).get(0)).put("probability",v);
             invalid(x);

            x=ordinary();
             ((List<Object>)((Map<String,Object>)((List<Object>)((Map<String,Object>)((List<Object>)x.get("rules")).get(0)).get("slots")).get(0)).get("turn")).set(0,v);
             invalid(x);

            x=ordinary();
             x.put("seed",v);
             invalid(x);
             x=ordinary();
             x.put("maxSegments",v);
             invalid(x);

        }

    }

    private static void carriersAndContainers() {

        Object[] accepted={
            Byte.valueOf((byte)42),Short.valueOf((short)42),Integer.valueOf(42),Long.valueOf(42L),Float.valueOf(42f),Double.valueOf(42d)}
        ;

        for(Object c:accepted){
            Map<String,Object>x=ordinary();
            x.put("seed",c);
            x.put("maxSegments",c);
            check(BranchTree2D.generate(x).size()>0,"integral carrier");
            }

        Object[] rejected={
            Boolean.TRUE,"42",new UnsupportedNumber(),BigInteger.ONE,BigDecimal.ONE}
        ;

        for(Object c:rejected){
            Map<String,Object>x=ordinary();
            x.put("seed",c);
            invalid(x);
            }

        Map<String,Object>x=ordinary();
        x.put("root",new double[]{
            0,0}
        );
        invalid(x);

        x=ordinary();
        x.put("rules",new Object[0]);
        invalid(x);

        x=ordinary();
        x.put("extra",1.0);
        invalid(x);

        x=ordinary();
        ((List<Object>)((Map<String,Object>)((List<Object>)x.get("rules")).get(0)).get("lengthScale")).set(1,-1.0);
        invalid(x);

        List<Object> slots=new LinkedList<Object>();
        slots.add(slot(1.0,0.0,0.0));
        List<Object> rules=new LinkedList<Object>();
        rules.add(rule(1.0,1.0,slots));
        check(BranchTree2D.generate(config(7.0,root(0.0,0.0,0.0,1.0),rules,2.0)).size()==2,"linked lists");

    }

    private static void negativeZero() {

        BranchTree2D r=BranchTree2D.generate(config(-0.0,root(-0.0,-0.0,-0.0,-0.0),list(rule(-0.0,-0.0,list(slot(-0.0,-0.0,-0.0)))),1.0));

        for(double value:r.segmentAt(0L))check(Double.doubleToRawLongBits(value)==0L,"geometry +0");

        check(Double.doubleToRawLongBits(r.headingAt(0L))==0L,"heading +0");
        check(Double.doubleToRawLongBits(r.lengthAt(0L))==0L,"length +0");

    }

    private static void accessAndAtomic() {

        BranchTree2D r=BranchTree2D.generate(ordinary());

        Action[] invalid={
            ()->r.segmentAt(Double.NaN),()->r.headingAt(Double.NEGATIVE_INFINITY),()->r.lengthAt(-1L),()->r.parentAt(new BigInteger("1")),()->r.generationAt(Boolean.TRUE),()->r.childCountAt(.5),()->r.segmentAt(9007199254740992.0)}
        ;

        for(Action a:invalid)expected("INVALID_INDEX",a);

        Action[] out={
            () -> r.segmentAt(9007199254740991L),
            () -> r.segmentAt((long) r.size()), () -> r.headingAt((long) r.size()),
            () -> r.lengthAt((long) r.size()), () -> r.parentAt((long) r.size()),
            () -> r.generationAt((long) r.size()), () -> r.childCountAt((long) r.size())}
        ;
        for(Action a:out)expected("INDEX_OUT_OF_RANGE",a);

        double[] sent={
            11,12,13,14,15,16}
        ,before=sent.clone();
        expected("INVALID_INDEX",()->r.segmentInto(Double.NaN,sent,-1));
        check(Arrays.equals(before,sent),"invalid index atomic");
        expected("INDEX_OUT_OF_RANGE",()->r.segmentInto((long)r.size(),sent,-1));
        check(Arrays.equals(before,sent),"outside atomic");
        expected("INVALID_OUTPUT",()->r.segmentInto(0L,null,0));
        check(Arrays.equals(before,sent),"null atomic");
        expected("INVALID_OUTPUT",()->r.segmentInto(0L,sent,-1));
        check(Arrays.equals(before,sent),"offset atomic");
        expected("INVALID_OUTPUT",()->r.segmentInto(0L,sent,3));
        check(Arrays.equals(before,sent),"short atomic");
        r.segmentInto(0L,sent,1);
        check(sent[0]==11&&sent[5]==16,"outer sentinels");
        double[] actual=r.segmentAt(0L);
        for(int i=0;i<4;i++)check(Double.doubleToRawLongBits(sent[i+1])==Double.doubleToRawLongBits(actual[i]),"successful write");

    }

    private static void ownership() {

        Map<String,Object> in=ordinary();
        BranchTree2D r=BranchTree2D.generate(in);
        long retained=checksum(r);
        ((List<Object>) ((Map<String,Object>) in.get("root")).get("origin")).set(0, 99.0);
        Map<String,Object> suppliedRule = (Map<String,Object>) ((List<Object>) in.get("rules")).get(0);
        ((List<Object>) suppliedRule.get("lengthScale")).set(0, 99.0);
        Map<String,Object> suppliedSlot = (Map<String,Object>) ((List<Object>) suppliedRule.get("slots")).get(0);
        ((List<Object>) suppliedSlot.get("turn")).set(0, 99.0);
        ((List<Object>) in.get("rules")).clear();
        check(checksum(r) == retained, "input detached");

        double[] s=r.segmentAt(0L);
        s[0]=99.0;
        Map<String,Object> v=r.toValues();
        ((List<Object>)((List<Object>)v.get("segments")).get(0)).set(0,88.0);
        for(String key:new String[]{
            "headings","lengths","parents","generations","childCounts"}
        )((List<Object>)v.get(key)).clear();
        check(checksum(r)==retained,"output detached");
        check(((List<?>)r.toValues().get("segments")).size()==r.size(),"fresh values detached");

    }

    private static void capacity() throws Exception {
         BranchTree2D r=BranchTree2D.generate(config(42.0,root(0.0,0.0,0.0,1.0),list(),357913941.0));
        check(r.size()==1,"root maximum");
        Field f=BranchTree2D.class.getDeclaredField("startX");
        f.setAccessible(true);
        check(((double[])f.get(r)).length==1,"no maximum preallocation");
         }

    private static List<Object> chainRules(int n){
        List<Object>out=new ArrayList<Object>(n);
        for(int i=0;i<n;i++)out.add(rule(1.0,1.0,list(slot(1.0,0.0,0.0))));
        return out;
        }

    private static List<Object> branchingRules(){
        return list(rule(.9,.9,list(slot(1.0,-.2,-.2),slot(1.0,.2,.2),slot(1.0,0.0,0.0))),rule(.9,.9,list(slot(1.0,-.1,-.1),slot(1.0,.1,.1),slot(1.0,0.0,0.0))),rule(.9,.9,list(slot(1.0,0.0,0.0),slot(1.0,.3,.3))));
        }

    private static List<Object> probabilisticRules(int count) {
        List<Object> rules = new ArrayList<Object>(count);
        for (int index = 0; index < count; index++) {
            rules.add(rule(.65, .85, list(slot(.7, -.25, -.1), slot(.7, .1, .25), slot(.4, 0.0, 0.0))));
        }
        return rules;
    }

    private static String workload(String id, Map<String,Object> input, int warmups, int reps) {
        for (int index = 0; index < warmups; index++) sink ^= checksum(BranchTree2D.generate(input));
        long elapsed = 0L;
        long aggregate = 0L;
        long treeChecksum = 0L;
        int nodes = 0;
        for (int index = 0; index < reps; index++) {
            long started = System.nanoTime();
            BranchTree2D result = BranchTree2D.generate(input);
            elapsed += System.nanoTime() - started;
            long current = checksum(result);
            if (index == 0) { treeChecksum = current; nodes = result.size(); }
            else { check(nodes == result.size(), "repeat node count"); check(treeChecksum == current, "repeat checksum"); }
            aggregate = (aggregate * 0x100000001b3L) ^ current;
        }
        sink ^= aggregate;
        long payload = 60L * nodes;
        return "{\"id\":\"" + id + "\",\"nodes\":" + nodes
            + ",\"warmups\":" + warmups + ",\"repetitions\":" + reps
            + ",\"elapsed_nanos\":" + elapsed + ",\"tree_checksum\":\""
            + Long.toUnsignedString(treeChecksum, 16) + "\",\"aggregate_checksum\":\""
            + Long.toUnsignedString(aggregate, 16) + "\",\"payload_bytes\":" + payload
            + "}";
    }

    private static String workloads() {
        String rootOnly = workload("tiny-root-only", config(42.0, root(0.0, 0.0, 0.0, 1.0), list(), 1.0), 2, 3);
        String branching = workload("representative-branching", config(42.0, root(0.0, 0.0, 0.0, 16.0), branchingRules(), 1000.0), 2, 3);
        String motivatingSeven = workload("motivating-seven-rule-probabilistic", config(42.0, root(0.0, 0.0, 0.0, 16.0), probabilisticRules(7), 100000.0), 1, 2);
        String motivatingEight = workload("motivating-eight-rule-probabilistic", config(42.0, root(0.0, 0.0, 0.0, 16.0), probabilisticRules(8), 100000.0), 1, 2);
        String chain = workload("iterative-20001-node-chain", config(42.0, root(0.0, 0.0, 0.0, 1.0), chainRules(20000), 20001.0), 1, 2);
        return "[" + rootOnly + "," + branching + "," + motivatingSeven + "," + motivatingEight + "," + chain + "]";
    }

    public static void main(String[] args) {
         try {
             nonfinite();
            carriersAndContainers();
            negativeZero();
            accessAndAtomic();
            ownership();
            capacity();
            String performance=workloads();
            System.out.println("{\"status\":\"passed\",\"assertions\":"+assertions+",\"native_only_requirements\":10,\"resource_failure\":\"not executed; controlled heap exhaustion is intentionally not claimed\",\"heap_max_bytes\":"+Runtime.getRuntime().maxMemory()+",\"workloads\":"+performance+"}");
             }
         catch(Throwable e){
            String message = String.valueOf(e).replace("\\", "\\\\").replace("\"", "'");
            System.out.println("{\"status\":\"failed\",\"assertions\":" + assertions + ",\"error\":\"" + message + "\"}");
            System.exit(1);
        }
    }
}
