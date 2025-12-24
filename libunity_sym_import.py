import json
import os
from ghidra.program.model.symbol import SourceType

def GetScriptDirectory():
    return getSourceFile().getParentFile().toString()  
    
jsonData = {"functions":[]}

def ImportFunction(fn):
    fun = getCurrentProgram().getFunctionManager().getFunctionAt(toAddr(fn["entry"]))
    
    if fun is None:
        # Create new function if none exists
        fun = createFunction(toAddr(fn["entry"]), None)
    fun.setName(fn["name"], SourceType.DEFAULT)

if currentProgram.getExecutableFormat().endswith('(ELF)'):
    currentProgram.setImageBase(toAddr(0), True)
		
# Don't trigger decompiler
setAnalysisOption(currentProgram, "Call Convention ID", "false")
with open(os.path.join(GetScriptDirectory(), ".\\libunity_sym.json"), "r") as infile:
    jsonData = json.load(infile)
    
for fn in jsonData["functions"]:
    ImportFunction(fn)
