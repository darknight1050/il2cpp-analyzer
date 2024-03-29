const Struct = require("structron"),
    {
        DWARFEncodings,
        getDWARFEncodingName,
        isBlock,
        isConstant,
        isRefOffset,
        readDWARFForm,
    } = require("./dwarfencodings"),
    PositionalBuffer = require("./positionalBuffer");
require("./types");

const DWARFDebugLineHeader = new Struct()
    .addMember(Struct.TYPES.UINT, "unit_length")
    .addMember(Struct.TYPES.USHORT, "version")
    .addMember(Struct.TYPES.UINT, "header_length")
    .addMember(Struct.TYPES.BYTE, "minimum_instruction_length")
    .addMember(Struct.TYPES.BYTE, "maximum_operations_per_instruction")
    .addMember(Struct.TYPES.BYTE, "default_is_stmt")
    .addMember(Struct.TYPES.SBYTE, "line_base")
    .addMember(Struct.TYPES.BYTE, "line_range")
    .addMember(Struct.TYPES.BYTE, "opcode_base");

const isAddressInDIE = (debugInformationEntry, address) => {
    const ranges =
        debugInformationEntry.attributes[DWARFEncodings.DW_AT_ranges];
    if (ranges) {
        for (const range of ranges) {
            if (address >= range[0] && address <= range[1]) return true;
        }
    }
    const low_pc =
        debugInformationEntry.attributes[DWARFEncodings.DW_AT_low_pc];
    const high_pc =
        debugInformationEntry.attributes[DWARFEncodings.DW_AT_high_pc];
    if (low_pc && high_pc) {
        if (address >= low_pc && address <= high_pc) return true;
    }
    return false;
};

const searchDIE = (debugInformationEntry, address) => {
    if (
        isAddressInDIE(debugInformationEntry, address) ||
        debugInformationEntry.tag == DWARFEncodings.DW_TAG_namespace
    ) {
        for (let child of debugInformationEntry.children) {
            const result = searchDIE(child, address);
            if (result && result.tag != DWARFEncodings.DW_TAG_namespace)
                return result;
        }
        return debugInformationEntry;
    }
    return undefined;
};

const searchDWARFLines = (inBuffer, sections, addresses) => {
    let searchResults = {};
    const buffer = new PositionalBuffer(inBuffer);
    let offset = 0;
    do {
        const cu = readDWARFInfoCUStart(buffer, sections, offset);
        //    length (4)
        offset += 4 + cu.header.unit_length;
        const stmt_list =
            cu.topDebugInformationEntry.attributes[
                DWARFEncodings.DW_AT_stmt_list
            ];
        for (const address of Object.assign([], addresses)) {
            if (isAddressInDIE(cu.topDebugInformationEntry, address)) {
                if (!cu.fullRead) readDWARFInfoCUFull(cu, sections);
                const lines = readDWARFLineCU(buffer, sections, stmt_list);
                const searchResult = [];
                for (let i = 1; i < lines.matrix.length; i++) {
                    const register = lines.matrix[i];
                    if (register.address > address) {
                        const lastRegister = lines.matrix[i - 1];
                        const file = lines.file_names[lastRegister.file - 1];
                        let directory;
                        if (file.dir == 0) {
                            directory =
                                cu.topDebugInformationEntry.attributes[
                                    DWARFEncodings.DW_AT_comp_dir
                                ];
                        } else {
                            directory = lines.include_directories[file.dir - 1];
                        }
                        searchResult.push({
                            file: directory + "/" + file.name,
                            line: lastRegister.line,
                            column: lastRegister.column,
                        });
                        break;
                    }
                }
                const result = searchDIE(cu.topDebugInformationEntry, address);
                if (result) {
                    let currentDebugInformationEntry = result;
                    while (currentDebugInformationEntry) {
                        if (
                            currentDebugInformationEntry.attributes[
                                DWARFEncodings.DW_AT_call_file
                            ]
                        ) {
                            const file =
                                lines.file_names[
                                    currentDebugInformationEntry.attributes[
                                        DWARFEncodings.DW_AT_call_file
                                    ] - 1
                                ];
                            let directory;
                            if (file.dir == 0) {
                                directory =
                                    cu.topDebugInformationEntry.attributes[
                                        DWARFEncodings.DW_AT_comp_dir
                                    ];
                            } else {
                                directory =
                                    lines.include_directories[file.dir - 1];
                            }
                            searchResult.push({
                                file: directory + "/" + file.name,
                                line: currentDebugInformationEntry.attributes[
                                    DWARFEncodings.DW_AT_call_line
                                ],
                                column: currentDebugInformationEntry.attributes[
                                    DWARFEncodings.DW_AT_call_column
                                ],
                            });
                        }
                        currentDebugInformationEntry =
                            currentDebugInformationEntry.parent;
                    }
                }
                if (searchResult.length > 0) {
                    searchResults[address] = searchResult;
                    addresses.splice(addresses.indexOf(address), 1);
                    if (addresses.length <= 0) return searchResults;
                }
            }
        }
    } while (offset < sections[".debug_info"].size);
    return searchResults;
};

const readDWARFLineCU = (inBuffer, sections, offset) => {
    const buffer = inBuffer.copy(sections[".debug_line"].offset + offset);
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
        file_names.push({
            name: buffer.readCString(),
            dir: buffer.readULEB128(),
            time: buffer.readULEB128(),
            size: buffer.readULEB128(),
        });
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
    };
    const matrix = [];
    let registers = Object.assign({}, startRegisters);
    //                  length (4)
    while (buffer.position < 4 + header.unit_length) {
        //const opcodeAddress = sectionOffset + buffer.position;
        const opcode = buffer.readUInt8();
        if (opcode == 0) {
            const instruction_length = buffer.readULEB128();
            const instruction_end = buffer.position + instruction_length;
            const extended_opcode = buffer.readUInt8();
            switch (extended_opcode) {
                case DWARFEncodings.DW_LNE_end_sequence: {
                    registers.end_sequence = true;
                    matrix.push(Object.assign({}, registers));
                    registers = Object.assign({}, startRegisters);
                    //console.log("[" + (opcodeAddress).toString(16) + "] Extended opcode "  + extended_opcode + ": End of Sequence");
                    //console.log("");
                    break;
                }
                case DWARFEncodings.DW_LNE_set_address: {
                    registers.address = buffer.readBigUInt64();
                    registers.op_index = 0;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Extended opcode "  + extended_opcode + ": set Address to "  + registers.address.toString(16));
                    break;
                }
                case DWARFEncodings.DW_LNE_define_file: {
                    //Unimplemented
                    console.log("Warning: DW_LNE_define_file unimplemented");
                    break;
                }
                case DWARFEncodings.DW_LNE_set_discriminator: {
                    registers.discriminator = buffer.readULEB128();
                    break;
                }
            }
            buffer.position = instruction_end;
        } else if (opcode < header.opcode_base) {
            switch (opcode) {
                case DWARFEncodings.DW_LNS_copy: {
                    matrix.push(Object.assign({}, registers));
                    registers.discriminator = 0;
                    registers.basic_block = false;
                    registers.prologue_end = false;
                    registers.epilogue_begin = false;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Copy");
                    break;
                }
                case DWARFEncodings.DW_LNS_advance_pc: {
                    const operation_advance = buffer.readULEB128();
                    const advanceAddress = BigInt(
                        Math.floor(
                            header.minimum_instruction_length *
                                ((registers.op_index + operation_advance) /
                                    header.maximum_operations_per_instruction)
                        )
                    );
                    registers.address += advanceAddress;
                    if (header.maximum_operations_per_instruction != 1)
                        registers.op_index =
                            (registers.op_index + operation_advance) %
                            header.maximum_operations_per_instruction;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance PC by " + advanceAddress + " to " + registers.address.toString(16));
                    break;
                }
                case DWARFEncodings.DW_LNS_advance_line: {
                    registers.line += buffer.readLEB128();
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance Line by " + operand.value + " to " + registers.line);
                    break;
                }
                case DWARFEncodings.DW_LNS_set_file: {
                    registers.file = buffer.readULEB128();
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set File Name to entry " +  registers.file + " in the File Name Table");
                    break;
                }
                case DWARFEncodings.DW_LNS_set_column: {
                    registers.column = buffer.readULEB128();
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set column to " + registers.column);
                    break;
                }
                case DWARFEncodings.DW_LNS_negate_stmt: {
                    registers.is_stmt = !registers.is_stmt;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set is_stmt to " + Number(registers.is_stmt));
                    break;
                }
                case DWARFEncodings.DW_LNS_set_basic_block: {
                    registers.basic_block = true;
                    break;
                }
                case DWARFEncodings.DW_LNS_const_add_pc: {
                    const adjusted_opcode = 255 - header.opcode_base;
                    const operation_advance =
                        adjusted_opcode / header.line_range;
                    const advanceAddress = BigInt(
                        Math.floor(
                            header.minimum_instruction_length *
                                ((registers.op_index + operation_advance) /
                                    header.maximum_operations_per_instruction)
                        )
                    );
                    registers.address += advanceAddress;
                    if (header.maximum_operations_per_instruction != 1)
                        registers.op_index =
                            (registers.op_index + operation_advance) %
                            header.maximum_operations_per_instruction;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance PC by constant " + advanceAddress + " to " + registers.address.toString(16));
                    break;
                }
                case DWARFEncodings.DW_LNS_fixed_advance_pc: {
                    registers.address += BigInt(buffer.readUInt16());
                    registers.op_index = 0;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Advance PC by fixed " + operand + " to " + registers.address.toString(16));
                    break;
                }
                case DWARFEncodings.DW_LNS_set_prologue_end: {
                    registers.prologue_end = true;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set prologue_end to true");
                    break;
                }
                case DWARFEncodings.DW_LNS_set_epilogue_begin: {
                    registers.epilogue_begin = true;
                    //console.log("[" + (opcodeAddress).toString(16) + "] Set epilogue_begin to true");
                    break;
                }
                case DWARFEncodings.DW_LNS_set_isa: {
                    registers.isa = buffer.readULEB128();
                    break;
                }
                default: {
                    for (
                        let i = 0;
                        i < standard_opcode_lengths[opcode - 1];
                        i++
                    )
                        buffer.readULEB128();
                    break;
                }
            }
        } else {
            const adjusted_opcode = opcode - header.opcode_base;
            const operation_advance = adjusted_opcode / header.line_range;
            const advanceAddress = BigInt(
                Math.floor(
                    header.minimum_instruction_length *
                        ((registers.op_index + operation_advance) /
                            header.maximum_operations_per_instruction)
                )
            );
            registers.address += advanceAddress;
            if (header.maximum_operations_per_instruction != 1)
                registers.op_index =
                    (registers.op_index + operation_advance) %
                    header.maximum_operations_per_instruction;
            const advanceLine =
                header.line_base + (adjusted_opcode % header.line_range);
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
        matrix: matrix,
    };
};

const DWARFDebugInfoHeader = new Struct()
    .addMember(Struct.TYPES.UINT, "unit_length")
    .addMember(Struct.TYPES.USHORT, "version")
    .addMember(Struct.TYPES.UINT, "debug_abbrev_offset")
    .addMember(Struct.TYPES.BYTE, "address_size");

const logChildren = (debugInformationEntry, level) => {
    console.log(level);
    console.log(debugInformationEntry);
    /*console.log("  ".repeat(level) + debugInformationEntry.tag);
    for(const [name, value] of Object.entries(debugInformationEntry.attributes)) {
        console.log("  ".repeat(level+1) + getDWARFEncodingName("DW_AT", name) + ": " + value);
    }*/
    for (const child of debugInformationEntry.children) {
        logChildren(child, level + 1);
    }
};

const readDWARFInfoCUStart = (inBuffer, sections, offset) => {
    const buffer = inBuffer.copy(sections[".debug_info"].offset + offset);
    const header = buffer.readStruct(DWARFDebugInfoHeader);
    const abbreviations = readDWARFAbbreviationTable(
        inBuffer,
        sections,
        header.debug_abbrev_offset
    );
    const address = buffer.position;
    const abbreviationCode = buffer.readULEB128();
    const abbreviation = abbreviations[abbreviationCode];
    const debugInformationEntry = {
        address: offset + address,
        tag: abbreviation.tag,
        children: [],
        attributes: {},
    };
    for (const attribute of abbreviation.attributes) {
        debugInformationEntry.attributes[attribute.name] = readDWARFAttribute(
            buffer,
            sections,
            debugInformationEntry,
            attribute
        );
    }
    return {
        buffer: buffer,
        header: header,
        abbreviations: abbreviations,
        topDebugInformationEntry: debugInformationEntry,
        fullRead: false,
    };
};

const readDWARFInfoCUFull = (compilationUnit, sections) => {
    const offset = compilationUnit.offset;
    const buffer = compilationUnit.buffer;
    const header = compilationUnit.header;
    const abbreviations = compilationUnit.abbreviations;
    let parentDebugInformationEntry = compilationUnit.topDebugInformationEntry;
    while (buffer.position < header.unit_length) {
        const address = buffer.position;
        const abbreviationCode = buffer.readULEB128();
        if (abbreviationCode == 0) {
            parentDebugInformationEntry = parentDebugInformationEntry.parent;
        } else {
            const abbreviation = abbreviations[abbreviationCode];
            const debugInformationEntry = {
                address: offset + address,
                parent: parentDebugInformationEntry,
                tag: abbreviation.tag,
                children: [],
                attributes: {},
            };
            if (abbreviation.hasChildren)
                parentDebugInformationEntry = debugInformationEntry;
            if (debugInformationEntry.parent)
                debugInformationEntry.parent.children.push(
                    debugInformationEntry
                );
            for (const attribute of abbreviation.attributes) {
                debugInformationEntry.attributes[attribute.name] =
                    readDWARFAttribute(
                        buffer,
                        sections,
                        debugInformationEntry,
                        attribute
                    );
            }
        }
    }
    //logChildren(topCompilationUnit, 0);
    compilationUnit.fullRead = true;
};

const readDWARFAbbreviationTable = (inBuffer, sections, offset) => {
    const abbreviations = {};
    const buffer = inBuffer.copy(sections[".debug_abbrev"].offset + offset);
    while ((abbreviationCode = buffer.readULEB128()) != 0) {
        const tag = buffer.readULEB128();
        const hasChildren = buffer.readUInt8();
        const attributes = [];
        let attributeName;
        let attributeForm;
        do {
            attributeName = buffer.readULEB128();
            attributeForm = buffer.readULEB128();
            if (!(attributeName == 0 && attributeForm == 0)) {
                attributes.push({ name: attributeName, form: attributeForm });
            } else {
                break;
            }
        } while (true);
        abbreviations[abbreviationCode] = {
            tag: tag,
            hasChildren: hasChildren,
            attributes,
        };
    }
    return abbreviations;
};

const readDWARFRanges = (inBuffer, sections, offset) => {
    const ranges = [];
    const buffer = inBuffer.copy(sections[".debug_ranges"].offset + offset);
    let start;
    let end;
    do {
        start = buffer.readBigUInt64();
        end = buffer.readBigUInt64();
        if (start != end) {
            ranges.push([start, end]);
        } else if (start == 0 && end == 0) {
            break;
        }
    } while (true);
    return ranges;
};

const readDWARFString = (buffer, sections, form, value) => {
    switch (form) {
        case DWARFEncodings.DW_FORM_string: {
            return value;
        }
        case DWARFEncodings.DW_FORM_strp: {
            return buffer
                .copy(sections[".debug_str"].offset + value)
                .readCString();
        }
    }
};

const readConstant = (form, value) => {
    switch (form) {
        case DWARFEncodings.DW_FORM_data1: {
            return value.readInt8();
        }
        case DWARFEncodings.DW_FORM_data2: {
            return value.readInt16LE();
        }
        case DWARFEncodings.DW_FORM_data4: {
            return value.readInt32LE();
        }
        case DWARFEncodings.DW_FORM_data8: {
            return value.readBigInt64LE();
        }
    }
    return value;
};

const readUConstant = (form, value) => {
    switch (form) {
        case DWARFEncodings.DW_FORM_data1: {
            return value.readUInt8();
        }
        case DWARFEncodings.DW_FORM_data2: {
            return value.readUInt16LE();
        }
        case DWARFEncodings.DW_FORM_data4: {
            return value.readUInt32LE();
        }
        case DWARFEncodings.DW_FORM_data8: {
            return value.readBigUInt64LE();
        }
    }
    return value;
};

const readDWARFAttribute = (
    buffer,
    sections,
    debugInformationEntry,
    attribute
) => {
    const form = attribute.form;
    const value = readDWARFForm(buffer, form);
    switch (attribute.name) {
        case DWARFEncodings.DW_AT_name:
        case DWARFEncodings.DW_AT_comp_dir: {
            return readDWARFString(buffer, sections, form, value);
        }
        case DWARFEncodings.DW_AT_high_pc: {
            return (
                debugInformationEntry.attributes[DWARFEncodings.DW_AT_low_pc] +
                BigInt(readUConstant(form, value))
            );
        }
        case DWARFEncodings.DW_AT_ranges: {
            return readDWARFRanges(buffer, sections, value);
        }
        case DWARFEncodings.DW_AT_decl_column:
        case DWARFEncodings.DW_AT_call_column:
        case DWARFEncodings.DW_AT_decl_file:
        case DWARFEncodings.DW_AT_call_file:
        case DWARFEncodings.DW_AT_decl_line:
        case DWARFEncodings.DW_AT_call_line: {
            return readUConstant(form, value);
        }
    }
    return value;
};

module.exports = { searchDWARFLines };
