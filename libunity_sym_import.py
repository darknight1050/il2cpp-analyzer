import json
import os
from ghidra.program.model.symbol import SourceType

def GetScriptDirectory():
    return getSourceFile().getParentFile().toString()  
    
jsonData = {"functions":[]}

def ImportFunction(fn):
    fun = getCurrentProgram().getFunctionManager().getFunctionAt(toAddr(fn["entry"]))
    if fun:
        fun.setName(fn["name"], SourceType.DEFAULT)

with open(os.path.join(GetScriptDirectory(), ".\\libunity_sym.json"), "r") as infile:
    jsonData = json.load(infile)
    
for fn in jsonData["functions"]:
    ImportFunction(fn)
