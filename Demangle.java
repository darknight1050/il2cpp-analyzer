import java.io.*;
import java.util.*;
import java.util.Iterator;

import ghidra.app.script.GhidraScript;
import ghidra.app.cmd.function.*;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.data.*;
import ghidra.program.model.symbol.*;
import ghidra.app.util.parser.*;

public class Demangle extends GhidraScript {

	@Override
	public void run() throws Exception {

		if (currentProgram == null) {
			println("Must have an open program!");
			return;
		}
		Process p = Runtime.getRuntime().exec("c++filt");
		
        PrintWriter demangleWriter = new PrintWriter(p.getOutputStream());
		InputStream is = p.getInputStream();
        BufferedReader demangleReader = new BufferedReader(new InputStreamReader(is));
		
		FunctionSignatureParser parser = new FunctionSignatureParser(currentProgram.getDataTypeManager(), null);
		Listing listing = currentProgram.getListing();
		FunctionIterator iter = listing.getFunctions(true);
		int count = 0;
		while (iter.hasNext() && !monitor.isCancelled()) {
			Function function = iter.next();
			//Function function = currentProgram.getFunctionManager().getFunctionContaining(currentProgram.parseAddress("0124ee20")[0]);

			Address entry = function.getEntryPoint();
			FunctionDefinitionDataType origDt = new FunctionDefinitionDataType​(function, true);
			String origName = origDt.getName();
			if(!isMangled(origName))
				continue;
			String orig = origDt.getPrototypeString();
			orig = orig.substring(0, orig.indexOf("("));
			int nameIndex = orig.indexOf(origName);
			if(nameIndex > 0)
				orig = orig.substring(nameIndex);
			demangleWriter.println(orig);
			demangleWriter.flush();
			int c = 0;
			while(is.available() < 1 && !monitor.isCancelled() && c < 1000000) {
				c++;
			}
			if(is.available() > 0 && !monitor.isCancelled()){
				String demangled = demangleReader.readLine();
				if(!demangled.equals(orig)) {
					demangled = demangled.replace("(anonymous namespace)", "ANON_NS");
					demangled = demangled.replace("const", "");
					demangled = demangled.replace("[]", "ARRAY");
					FunctionDefinitionDataType dt = null;
					if(!(demangled.indexOf(" ") > 0 && demangled.indexOf(" ") < demangled.indexOf("<") && demangled.indexOf(" ") < demangled.indexOf("(")))
						demangled = "undefined " + demangled;
					try {
						dt = parser.parse(function.getSignature(), demangled);
						dt.setReturnType(origDt.getReturnType());
						println(orig + " -> " + demangled);
						new ApplyFunctionSignatureCmd(entry, dt, SourceType.USER_DEFINED, true, true).applyTo(currentProgram);
						count++;
					}catch(Exception e) {
						println("Couldn't demangle: " + demangled);
					}
				}
			}
		}
		demangleWriter.close();
		demangleReader.close();
		p.destroy();
		println("Demangled: " + count);
	}
	
	private boolean isMangled(String mangled) {

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
