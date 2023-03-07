const Struct = require("structron");
const PositionalBuffer = require("./positionalBuffer");

const DW_LNS_copy = 1;
const DW_LNS_advance_pc = 2;
const DW_LNS_advance_line = 3;
const DW_LNS_set_file = 4;
const DW_LNS_set_column = 5;
const DW_LNS_negate_stmt = 6;
const DW_LNS_set_basic_block = 7;
const DW_LNS_const_add_pc = 8;
const DW_LNS_fixed_advance_pc = 9;
const DW_LNS_set_prologue_end = 10;
const DW_LNS_set_epilogue_begin = 11;
const DW_LNS_set_isa = 12;

const DW_LNE_end_sequence = 1;
const DW_LNE_set_address = 2;
const DW_LNE_define_file = 3;
const DW_LNE_set_discriminator = 4;

const DWARFDebugLineHeader = new Struct()
    .addMember(Struct.TYPES.UINT, "length")
    .addMember(Struct.TYPES.USHORT, "version")
    .addMember(Struct.TYPES.UINT, "header_length")
    .addMember(Struct.TYPES.BYTE, "minimum_instruction_length")
    .addMember(Struct.TYPES.BYTE, "maximum_operations_per_instruction")
    .addMember(Struct.TYPES.BYTE, "default_is_stmt")
    .addMember(Struct.TYPES.SBYTE, "line_base")
    .addMember(Struct.TYPES.BYTE, "line_range")
    .addMember(Struct.TYPES.BYTE, "opcode_base");

const searchDWARFLines = (buffer, section, addresses) => {
    const startOffset = section.offset;
    let searchResults = {};
    const compilationUnits = [];
    let offset = startOffset;
    do {
        const cu = readDWARFLineCU(buffer, offset);
        //    length (4)
        offset += 4 + cu.header.length;
        compilationUnits.push(cu);
    } while(offset < startOffset + section.size);
    for (let cu of compilationUnits) {
        for (let i = 1; i < cu.matrix.length; i++) {
            const register = cu.matrix[i];
            addresses.filter(address => !searchResults[address]).forEach(address => {
                if(register.address > address) {
                    const lastRegister = cu.matrix[i-1];
                    const file = cu.file_names[lastRegister.file-1];
                    searchResults[address] = { file: cu.include_directories[file.dir-1] + "/" + file.name, line: lastRegister.line, column: lastRegister.column };
                }
            });
        }
    }
    return searchResults;
}

const readDWARFLineCU = (inBuffer, startOffset) => {
    const buffer = new PositionalBuffer(inBuffer, startOffset);
    const header = buffer.readStruct(DWARFDebugLineHeader);
    const standard_opcode_count = header.opcode_base - 1;
    const standard_opcode_lengths = [standard_opcode_count];
    for (let i = 0; i < standard_opcode_count; i++)
        standard_opcode_lengths[i] = buffer.readUInt8();
    
    const include_directories = [];
    while (buffer.readUInt8(0) != 0) {
        include_directories.push(buffer.readCString());
    }
    buffer.position += 1;

    const file_names = [];
    while (buffer.readUInt8(0) != 0) {
        file_names.push({name: buffer.readCString(), dir: buffer.readULEB128(), time: buffer.readULEB128(), size: buffer.readULEB128() });
    }

    //length (4) + version (2) + header_length (4)
    buffer.position = 4 + 2 + 4 + header.header_length;

    const startRegisters = {
        address: BigInt(0),
        op_index: 0,
        file: 1,
        line: 1,
        column: 0,
        is_stmt: header.default_is_stmt,
        basic_block: false,
        end_sequence: false,
        prologue_end: false,
        epilogue_begin: false,
        isa: 0,
        discriminator: 0,
    }
    const matrix = [];
    let registers = Object.assign({}, startRegisters);
    //                  length (4)
    while(buffer.position < 4 + header.length) {
        //const opcodeAddress = sectionOffset + buffer.position;
        const opcode = buffer.readUInt8();
        if(opcode == 0) {
            const instruction_length = buffer.readULEB128();
            const instruction_end = buffer.position + instruction_length;
            const extended_opcode = buffer.readUInt8();
            switch(extended_opcode) {
                case DW_LNE_end_sequence:
                {
                    registers.end_sequence = true;
                    matrix.push(Object.assign({}, registers));
                    registers = Object.assign({}, startRegisters);
                    //console.log("[" + (opcodeAddress).toString(16) + "] Extended opcode "  + extended_opcode + ": End of Sequence");
                    //console.log("");
                    break;
                }
                case DW_LNE_set_address:
                {
                    registers.address = buffer.readBigUInt64();
                    registers.op_index = 0;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Extended opcode "  + extended_opcode + ": set Address to "  + registers.address.toString(16));
                    break;
                }
                case DW_LNE_define_file:
                {
                    break;
                }
                case DW_LNE_set_discriminator:
                {
                    registers.discriminator = buffer.readULEB128();
                    break;
                }
            }
            buffer.position = instruction_end;
        } else if(opcode < header.opcode_base) {
            switch(opcode) {
                case DW_LNS_copy:
                {
                    matrix.push(Object.assign({}, registers));
                    registers.discriminator = 0;
                    registers.basic_block = false;
                    registers.prologue_end = false;
                    registers.epilogue_begin = false;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Copy");
                    break;
                }
                case DW_LNS_advance_pc:
                {
                    const operation_advance = buffer.readULEB128();
                    const advanceAddress = BigInt(Math.floor(header.minimum_instruction_length * ((registers.op_index + operation_advance)/header.maximum_operations_per_instruction)));
                    registers.address += advanceAddress;
                    if(header.maximum_operations_per_instruction != 1)
                        registers.op_index = (registers.op_index + operation_advance) % header.maximum_operations_per_instruction;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance PC by " + advanceAddress + " to " + registers.address.toString(16));
                    break;
                }
                case DW_LNS_advance_line:
                {
                    registers.line += buffer.readLEB128();
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance Line by " + operand.value + " to " + registers.line);
                    break;
                }
                case DW_LNS_set_file:
                {
                    registers.file = buffer.readULEB128();
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set File Name to entry " +  registers.file + " in the File Name Table");
                    break;
                }
                case DW_LNS_set_column:
                {
                    registers.column = buffer.readULEB128();
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set column to " + registers.column);
                    break;
                }
                case DW_LNS_negate_stmt:
                {
                    registers.is_stmt = !registers.is_stmt;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set is_stmt to " + Number(registers.is_stmt));
                    break;
                }
                case DW_LNS_set_basic_block:
                {
                    registers.basic_block = true;
                    break;
                }
                case DW_LNS_const_add_pc:
                {
                    const adjusted_opcode = 255 - header.opcode_base;
                    const operation_advance = adjusted_opcode / header.line_range;
                    const advanceAddress = BigInt(Math.floor(header.minimum_instruction_length * ((registers.op_index + operation_advance)/header.maximum_operations_per_instruction)));
                    registers.address += advanceAddress;
                    if(header.maximum_operations_per_instruction != 1)
                        registers.op_index = (registers.op_index + operation_advance) % header.maximum_operations_per_instruction;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance PC by constant " + advanceAddress + " to " + registers.address.toString(16));
                    break;
                }
                case DW_LNS_fixed_advance_pc:
                {
                    registers.address += BigInt(buffer.readUInt16());
                    registers.op_index = 0;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance PC by fixed " + operand + " to " + registers.address.toString(16));
                    break;
                }
                case DW_LNS_set_prologue_end:
                {
                    registers.prologue_end = true;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set prologue_end to true");
                    break;
                }
                case DW_LNS_set_epilogue_begin:
                {
                    registers.epilogue_begin = true;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set epilogue_begin to true");
                    break;
                }
                case DW_LNS_set_isa:
                {
                    registers.isa = buffer.readULEB128();
                    break;
                }
                default:
                {   
                    for(let i = 0; i < standard_opcode_lengths[opcode - 1]; i++) 
                        buffer.readULEB128();
                    break;
                }
            }
        } else {
            const adjusted_opcode = opcode - header.opcode_base;
            const operation_advance = adjusted_opcode / header.line_range;
            const advanceAddress = BigInt(Math.floor(header.minimum_instruction_length * ((registers.op_index + operation_advance)/header.maximum_operations_per_instruction)));
            registers.address += advanceAddress;
            if(header.maximum_operations_per_instruction != 1)
                registers.op_index = (registers.op_index + operation_advance) % header.maximum_operations_per_instruction;
            const advanceLine = header.line_base + (adjusted_opcode % header.line_range);
            registers.line += advanceLine;

            matrix.push(Object.assign({}, registers));

            registers.basic_block = false;
            registers.prologue_end = false;
            registers.epilogue_begin = false;
            registers.discriminator = 0;
            //console.log("[" + (opcodeAddress).toString(16) + "] Special opcode " + adjusted_opcode + ": advance Address by " + advanceAddress + " to " + registers.address.toString(16) + " and Line by "+ advanceLine  + " to " + registers.line);
        }
    }
    return {
        header: header,
        include_directories: include_directories,
        file_names: file_names,
        matrix: matrix
    }
}

module.exports = { searchDWARFLines };