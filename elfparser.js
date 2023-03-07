const Struct = require("structron");

https://github.com/facebookincubator/oculus-linux-kernel/blob/oculus-quest-kernel-master/include/uapi/linux/elf.h

Struct.TYPES.ULONG = {
    read(buffer, offset) {
        return Number(buffer.readBigUInt64LE(offset));
    },
    write(value, context, offset) {
        context.buffer.writeBigUInt64LE(BigInt(value), offset);
    },
    SIZE: 8
};

Struct.TYPES.SBYTE = {
    read(buffer, offset) {
      return buffer.readInt8(offset)
    },
    write(value, context, offset) {
      context.buffer.writeInt8(value, offset);
    },
    SIZE: 1
};

const SHT_PROGBITS = 1;
const SHT_NOTE = 7;

const Elf64_Ehdr = new Struct()
    .addMember(Struct.TYPES.SKIP(16), "e_ident")
    .addMember(Struct.TYPES.USHORT, "e_type")
    .addMember(Struct.TYPES.USHORT, "e_machine")
    .addMember(Struct.TYPES.UINT, "e_version")
    .addMember(Struct.TYPES.ULONG, "e_entry")
    .addMember(Struct.TYPES.ULONG, "e_phoff")
    .addMember(Struct.TYPES.ULONG, "e_shoff")
    .addMember(Struct.TYPES.UINT, "e_flags")
    .addMember(Struct.TYPES.USHORT, "e_ehsize")
    .addMember(Struct.TYPES.USHORT, "e_phentsize")
    .addMember(Struct.TYPES.USHORT, "e_phnum")
    .addMember(Struct.TYPES.USHORT, "e_shentsize")
    .addMember(Struct.TYPES.USHORT, "e_shnum")
    .addMember(Struct.TYPES.USHORT, "e_shstrndx");

const Elf64_Shdr = new Struct()
    .addMember(Struct.TYPES.UINT, "sh_name")
    .addMember(Struct.TYPES.UINT, "sh_type")
    .addMember(Struct.TYPES.ULONG, "sh_flags")
    .addMember(Struct.TYPES.ULONG, "sh_addr")
    .addMember(Struct.TYPES.ULONG, "sh_offset")
    .addMember(Struct.TYPES.ULONG, "sh_size")
    .addMember(Struct.TYPES.UINT, "sh_link")
    .addMember(Struct.TYPES.UINT, "sh_info")
    .addMember(Struct.TYPES.ULONG, "sh_addralign")
    .addMember(Struct.TYPES.ULONG, "sh_entsize");

const Elf64_Nhdr = new Struct()
    .addMember(Struct.TYPES.UINT, "n_namesz")
    .addMember(Struct.TYPES.UINT, "n_descsz")
    .addMember(Struct.TYPES.UINT, "n_type");
    
const readNullTerminatedString = (buffer, offset) => {
    let len = 0;
    while (buffer.readUInt8(offset + len) != 0) {
        len++;
        if (len >= buffer.length) {
            throw new Error("Null terminated string went outside buffer!");
        }
    }
    return buffer.toString("ASCII", offset, offset + len);
};

const readArray = (buffer, struct, offset, entsize, num) => {
    let array = [];
    for(let i = 0; i < num; i++) {
        array.push(struct.readContext(buffer, offset + i * entsize).data);
    }
    return array;
}

const readELF = (buffer) => {
    let buildID = "";
    let debug_lineSection;
    const elf = Elf64_Ehdr.readContext(buffer).data;
    let sectionHeaders = readArray(buffer, Elf64_Shdr, elf.e_shoff, elf.e_shentsize, elf.e_shnum);
    const shstrtab = sectionHeaders[elf.e_shstrndx]
    sectionHeaders.forEach(section => {
        const name = readNullTerminatedString(buffer, shstrtab.sh_offset + section.sh_name);
        if(section.sh_type == SHT_NOTE && name === ".note.gnu.build-id") {
            const note = Elf64_Nhdr.readContext(buffer, section.sh_offset).data;
            if(note.n_descsz == 20) {
                const buildIDOffset = section.sh_offset + Elf64_Nhdr.SIZE + note.n_namesz;
                buildID = buffer.toString("hex", buildIDOffset, buildIDOffset + note.n_descsz);
            }
        }
        if(section.sh_type == SHT_PROGBITS && name === ".debug_line") {
            debug_lineSection = {offset: section.sh_offset, size: section.sh_size};
        }
    });
    return { buildID: buildID, section: debug_lineSection };
}


const leb128 = require("leb128");

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

const readString = (buffer, offset) => {
    let len = 0;
    while (buffer.readUInt8(offset + len) != 0) {
        len++;
        if (len >= buffer.length) {
            throw new Error("Null terminated string went outside buffer!");
        }
    }
    return {value: buffer.toString("ASCII", offset, offset + len), length: len + 1};
}

const readULEB128 = (buffer, offset) => {
    let leb = Number(leb128.unsigned.decode(buffer.slice(offset)));
    return {value: leb, length: leb128.unsigned.encode(leb).length};
}

const readLEB128 = (buffer, offset) => {
    let leb = Number(leb128.signed.decode(buffer.slice(offset)));
    return {value: leb, length: leb128.signed.encode(leb).length};
}

const searchDWARFLines = (buffer, section, addresses) => {
    const startOffset = section.offset;
    let searchResults = {};
    const compilationUnits = [];
    let offset = startOffset;
    do {
        const cu = readDWARFLineCU(buffer, offset, startOffset);
        offset += cu.header.length + 4;
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

const readDWARFLineCU = (buffer, startOffset, sectionOffset) => {
    let offset = startOffset;
    const header = DWARFDebugLineHeader.readContext(buffer, offset).data;
    offset += DWARFDebugLineHeader.SIZE;
    const standard_opcode_lengths = [header.opcode_base];
    for (let i = 0; i < header.opcode_base - 1; i++)
        standard_opcode_lengths[i] = buffer.readInt8(offset + i);
    offset += header.opcode_base - 1;

    const include_directories = [];
    while (buffer.readUInt8(offset) != 0) {
        const str = readString(buffer, offset);
        include_directories.push(str.value);
        offset += str.length;
    }
    offset += 1;
    
    //console.log(header);
    //console.log(standard_opcode_lengths);
    //console.log(include_directories);
    
    const file_names = [];
    while (buffer.readUInt8(offset) != 0) {
        const name = readString(buffer, offset);
        offset += name.length;
        const dir = readULEB128(buffer, offset);
        offset += dir.length;
        const time = readULEB128(buffer, offset);
        offset += time.length;
        const size = readULEB128(buffer, offset);
        offset += size.length;
        file_names.push({name: name.value, dir: dir.value, time: time.value, size: size.value });
    }
    //console.log(file_names);
    offset = startOffset + 4 + 2 + 4 + header.header_length;

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
    while(offset - startOffset < header.length + 4) {
        const opcodeAddress = offset - sectionOffset;
        const opcode = buffer.readUInt8(offset);
        offset += 1;
        if(opcode == 0) {
            const operand = readULEB128(buffer, offset);
            offset += operand.length;
            const instruction_length = operand.value;
            const instruction_end = offset + instruction_length;
            const extended_opcode = buffer.readUInt8(offset);
            offset += 1;
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
                    registers.address = buffer.readBigUInt64LE(offset);
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
                    const operand = readULEB128(buffer, offset);
                    registers.discriminator = operand.value;
                    break;
                }
            }
            offset = instruction_end;
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
                    const operand = readULEB128(buffer, offset);
                    offset += operand.length;
                    const operation_advance = operand.value;
                    const advanceAddress = BigInt(Math.floor(header.minimum_instruction_length * ((registers.op_index + operation_advance)/header.maximum_operations_per_instruction)));
                    registers.address += advanceAddress;
                    if(header.maximum_operations_per_instruction != 1)
                        registers.op_index = (registers.op_index + operation_advance) % header.maximum_operations_per_instruction;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance PC by " + advanceAddress + " to " + registers.address.toString(16));
                    break;
                }
                case DW_LNS_advance_line:
                {
                    const operand = readLEB128(buffer, offset);
                    offset += operand.length;
                    registers.line += operand.value;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance Line by " + operand.value + " to " + registers.line);
                    break;
                }
                case DW_LNS_set_file:
                {
                    const operand = readULEB128(buffer, offset);
                    offset += operand.length;
                    registers.file = operand.value;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set File Name to entry " +  registers.file + " in the File Name Table");
                    break;
                }
                case DW_LNS_set_column:
                {
                    const operand = readULEB128(buffer, offset);
                    offset += operand.length;
                    registers.column = operand.value;
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
                    const operand = buffer.readUInt16LE(offset);
                    offset += 2;
                    registers.address += BigInt(operand);
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
                    const operand = readULEB128(buffer, offset);
                    offset += operand.length;
                    registers.isa = operand.value;
                    break;
                }
                default:
                {   
                    for(let i = 0; i < standard_opcode_lengths[opcode - 1]; i++) 
                        offset += readULEB128(buffer, offset).length;
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



module.exports = { readELF, searchDWARFLines };