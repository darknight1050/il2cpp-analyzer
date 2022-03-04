import json
import os

def GetScriptDirectory():
    return getSourceFile().getParentFile().toString()  
    
jsonData = {"functions":[]}

def DumpFunction(fn):
    ranges = []
    for range in fn.getBody().toList():
        ranges.append([ "0x" + str(range.getMinAddress()), "0x" + str(range.getMaxAddress()) ] )
    jsonData["functions"].append({ "name": fn.getName(), "sig": fn.getSignature().getPrototypeString(), "ranges": ranges });

for fn in getCurrentProgram().getFunctionManager().getFunctions(True):
    DumpFunction(fn)

with open(os.path.join(GetScriptDirectory(), ".\\export.json"), "w") as outfile:
    json.dump(jsonData, outfile, indent=2)