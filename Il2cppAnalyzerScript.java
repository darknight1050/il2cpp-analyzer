import java.io.*;
import java.util.Iterator;
import java.util.List;
import java.nio.charset.StandardCharsets;

import com.google.gson.*;
import com.google.gson.stream.JsonWriter;

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.app.util.bin.format.elf.info.NoteGnuBuildId;

public class Il2cppAnalyzerScript extends GhidraScript {
	
	public PrintWriter demangleWriter;
	public InputStream is;
    public BufferedReader demangleReader;
	
	@Override
	public void run() throws Exception {
		if (currentProgram == null) {
			println("Must have an open program!");
			return;
		}
		NoteGnuBuildId buildID = NoteGnuBuildId.fromProgram(getCurrentProgram());
		if(buildID == null) {
			println("BuildID not found!");
			return;
		}
		String buildIDHex = bytesToHex(buildID.getDescription());
		//https://github.com/nico/demumble/
		Process p = Runtime.getRuntime().exec("demumble -u");
		
        demangleWriter = new PrintWriter(p.getOutputStream());
		is = p.getInputStream();
        demangleReader = new BufferedReader(new InputStreamReader(is));
		
		File outputFile = askFile("Please Select Output File", "Choose");
		JsonWriter jsonWriter = new JsonWriter(new FileWriter(outputFile));
		//jsonWriter.setIndent("  ");
		jsonWriter.beginObject();
		jsonWriter.name("buildID").value(buildIDHex);
		jsonWriter.name("functions");
		jsonWriter.beginArray();

		Listing listing = currentProgram.getListing();
		FunctionIterator iter = listing.getFunctions(true);
		while (iter.hasNext() && !monitor.isCancelled()) {
			Function function = iter.next();

			Address entry = function.getEntryPoint();
			
			jsonWriter.beginObject();
			jsonWriter.name("name").value(demangle(function.getName()));
			jsonWriter.name("sig").value(removeNullReturnType(demangle(function.getName(), function.getSignature().getPrototypeString().replace(" *", "*"))));
			jsonWriter.name("ranges");
			jsonWriter.beginArray();
			AddressRangeIterator iterRange = function.getBody().getAddressRanges();
			while (iterRange.hasNext() && !monitor.isCancelled()) {
				AddressRange range = iterRange.next();
				jsonWriter.beginArray();
				jsonWriter.value("0x" + range.getMinAddress());
				jsonWriter.value("0x" + range.getMaxAddress());
				jsonWriter.endArray();
			}
			jsonWriter.endArray();
			jsonWriter.endObject();
		}

		jsonWriter.endArray();
		jsonWriter.endObject();
		jsonWriter.close();

		demangleWriter.close();
		demangleReader.close();
		p.destroy();
		println("Wrote functions to " + outputFile);
		
		println("Done!");
	}
	
	private static final byte[] HEX_ARRAY = "0123456789ABCDEF".getBytes(StandardCharsets.US_ASCII);
	public static String bytesToHex(byte[] bytes) {
		byte[] hexChars = new byte[bytes.length * 2];
		for (int j = 0; j < bytes.length; j++) {
			int v = bytes[j] & 0xFF;
			hexChars[j * 2] = HEX_ARRAY[v >>> 4];
			hexChars[j * 2 + 1] = HEX_ARRAY[v & 0x0F];
		}
		return new String(hexChars, StandardCharsets.UTF_8);
	}
	
	public String demangle(String name, String mangled) throws IOException {
		if(!isMangled(name))
			return mangled;
		
		int index = mangled.indexOf("(");
		if(index > 0)
			mangled = mangled.substring(0, index);
		demangleWriter.println(mangled);
		demangleWriter.flush();
		int c = 0;
		while(is.available() < 1 && !monitor.isCancelled() && c < 1000000) {
			c++;
		}
		if(is.available() > 0 && !monitor.isCancelled()){
			String demangled = demangleReader.readLine();
			if(name.equals(mangled)) {
				index = demangled.indexOf("(");
				if(index > 0)
					demangled = demangled.substring(0, index);
			}
			println(mangled + " -> " + demangled);
			return demangled;
		}

		return mangled;
	}
	
	public String demangle(String name) throws IOException {
		return demangle(name, name);
	}
	
	public static String removeNullReturnType(String name) {
		if(name.startsWith("undefined ") || name.startsWith("void "))
			return name.substring(name.indexOf(" ") + 1);
		return name;
	}
	
	public boolean isMangled(String mangled) {

		return 
			mangled.startsWith("_Z") ||
			mangled.startsWith("__Z") ||
			mangled.startsWith("h__") ||
			mangled.startsWith("?") ||
			mangled.startsWith("_GLOBAL_.I.") ||
			mangled.startsWith("_GLOBAL_.D.") ||
			mangled.startsWith("_GLOBAL__I__Z") ||
			mangled.startsWith("_GLOBAL__D__Z");

	}
	
}
