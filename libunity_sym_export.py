import json
import os

def GetScriptDirectory():
    return getSourceFile().getParentFile().toString()  
    
jsonData = {"functions":[]}

def DumpFunction(fn):
    jsonData["functions"].append({ "name": fn.getName(), "entry": str(fn.getEntryPoint()) });

for fn in getCurrentProgram().getFunctionManager().getFunctions(True):
    DumpFunction(fn)

with open(os.path.join(GetScriptDirectory(), ".\\libunity_sym.json"), "w") as outfile:
    json.dump(jsonData, outfile, indent=2)
