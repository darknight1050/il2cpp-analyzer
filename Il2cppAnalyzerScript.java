import java.io.*;
import java.util.Iterator;
import java.util.List;
import java.nio.charset.StandardCharsets;

import com.google.gson.*;
import com.google.gson.stream.JsonWriter;

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.app.util.bin.format.elf.GnuBuildIdSection;

public class Il2cppAnalyzerScript extends GhidraScript {

	@Override
	public void run() throws Exception {

		if (currentProgram == null) {
			println("Must have an open program!");
			return;
		}
		GnuBuildIdSection.GnuBuildIdValues buildID = GnuBuildIdSection.fromProgram(getCurrentProgram());
		if(buildID == null || !buildID.isValid()) {
			println("BuildID not found!");
			return;
		}
		String buildIDHex = bytesToHex(GnuBuildIdSection.fromProgram(getCurrentProgram()).getDescription());

		File outputFile = askFile("Please Select Output File", "Choose");
		JsonWriter jsonWriter = new JsonWriter(new FileWriter(outputFile));
		jsonWriter.setIndent("  ");
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
			jsonWriter.name("name").value(function.getName());
			jsonWriter.name("sig").value(function.getSignature().getPrototypeString().replace(" *", "*"));
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
}
