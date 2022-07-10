module.exports.analyzeSingle = (json, addr) => {
    let functions = json.functions;
    for (let i = 0; i < functions.length; i++) {
        let func = functions[i];
        let ranges = func.ranges;
        for (let j = 0; j < ranges.length; j++) {
            let range = ranges[j];
            if(parseInt(range[0], 16) <= addr && parseInt(range[1], 16) >= addr)
                return func;
        }
    }
    return 0;
}

module.exports.analyzeMultiple = (json, toAnalyze) => {
    let analyzed = {};
    let functions = json.functions;
    for (let i = 0; i < functions.length; i++) {
        let func = functions[i];
        let ranges = func.ranges;
        for (let j = 0; j < ranges.length; j++) {
            let range = ranges[j];
            let result = toAnalyze.filter(addr => parseInt(range[0], 16) <= addr && parseInt(range[1], 16) >= addr);
            if(result.length > 0) {
                result.forEach(addr => {
                    toAnalyze.splice(toAnalyze.indexOf(addr), 1);
                    analyzed[addr] = func;
                });
                if(toAnalyze.length <= 0)
                    return analyzed;
            }
        }
    }
    return analyzed;
}