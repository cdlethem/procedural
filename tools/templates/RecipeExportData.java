import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.security.*;
import java.util.*;

/** Bounded reader for the private recipe-data.bin export artifact. */
public final class RecipeExportData {
    private static final int MAX_BYTES=4*1024*1024, MAX_DEPTH=64, MAX_VALUES=20000;
    private RecipeExportData() { }
    public static Map<String,Object> read(String expectedSha256) {
        try {
            byte[] bytes=bytes();
            if(!hex(MessageDigest.getInstance("SHA-256").digest(bytes)).equals(expectedSha256)) throw bad("recipe data digest differs");
            Reader r=new Reader(bytes); r.header(); Object root=r.value(0); if(!(root instanceof Map))throw bad("recipe data root must be object"); if(r.in.hasRemaining())throw bad("recipe data trailing bytes");
            @SuppressWarnings("unchecked") Map<String,Object> result=(Map<String,Object>)root; return result;
        } catch(GeneralSecurityException e) { throw bad("SHA-256 unavailable",e); }
    }
    private static byte[] bytes() {
        InputStream source=RecipeExportData.class.getResourceAsStream("/recipe-data.bin"); if(source==null)throw bad("recipe data resource missing");
        try (InputStream input=source) { ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] b=new byte[8192]; int n; while((n=input.read(b))>=0){if(out.size()>MAX_BYTES-n)throw bad("recipe data exceeds 4 MiB");out.write(b,0,n);} return out.toByteArray(); }
        catch(IOException e){throw bad("recipe data read failed",e);}
    }
    private static String hex(byte[] b){StringBuilder s=new StringBuilder();for(byte x:b)s.append(String.format("%02x",x&255));return s.toString();}
    private static IllegalArgumentException bad(String m){return new IllegalArgumentException(m);} private static IllegalArgumentException bad(String m,Exception e){return new IllegalArgumentException(m,e);}
    private static final class Reader {
        final ByteBuffer in; int values;
        Reader(byte[] b){in=ByteBuffer.wrap(b).order(ByteOrder.BIG_ENDIAN);}
        void header(){need(4);if(in.get()!='P'||in.get()!='R'||in.get()!='D'||in.get()!='1')throw bad("recipe data header differs");}
        Object value(int depth){if(depth>MAX_DEPTH)throw bad("recipe data depth limit");if(++values>MAX_VALUES)throw bad("recipe data value limit");need(1);switch(in.get()&255){case 0:return null;case 1:return Boolean.FALSE;case 2:return Boolean.TRUE;case 3:need(8);double n=in.getDouble();if(!Double.isFinite(n))throw bad("recipe data nonfinite number");return Double.valueOf(n);case 4:return text();case 5:return array(depth);case 6:return object(depth);default:throw bad("recipe data tag unknown");}}
        List<Object> array(int depth){int n=count();if(n>MAX_VALUES-values||n>in.remaining())throw bad("recipe data array count");List<Object> a=new ArrayList<Object>(n);for(int i=0;i<n;i++)a.add(value(depth+1));return Collections.unmodifiableList(a);}
        Map<String,Object> object(int depth){int n=count();if(n>MAX_VALUES-values||n>in.remaining()/5)throw bad("recipe data object count");Map<String,Object> o=new LinkedHashMap<String,Object>();for(int i=0;i<n;i++){String k=text();if(o.containsKey(k))throw bad("recipe data duplicate key");o.put(k,value(depth+1));}return Collections.unmodifiableMap(o);}
        String text(){int n=count();if(n>in.remaining())throw bad("recipe data string length");byte[] b=new byte[n];in.get(b);try{CharsetDecoder d=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT);return d.decode(ByteBuffer.wrap(b)).toString();}catch(CharacterCodingException e){throw bad("recipe data malformed UTF-8",e);}}
        int count(){need(4);int n=in.getInt();if(n<0)throw bad("recipe data negative length");return n;} void need(int n){if(n<0||in.remaining()<n)throw bad("recipe data truncated");}
    }
}
