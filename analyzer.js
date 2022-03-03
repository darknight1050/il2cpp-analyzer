module.exports = (json, addr) => {
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
}
