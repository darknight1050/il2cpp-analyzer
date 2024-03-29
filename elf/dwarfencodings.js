DWARFEncodings = {
    DW_LNS_copy: 1,
    DW_LNS_advance_pc: 2,
    DW_LNS_advance_line: 3,
    DW_LNS_set_file: 4,
    DW_LNS_set_column: 5,
    DW_LNS_negate_stmt: 6,
    DW_LNS_set_basic_block: 7,
    DW_LNS_const_add_pc: 8,
    DW_LNS_fixed_advance_pc: 9,
    DW_LNS_set_prologue_end: 10,
    DW_LNS_set_epilogue_begin: 11,
    DW_LNS_set_isa: 12,

    DW_LNE_end_sequence: 1,
    DW_LNE_set_address: 2,
    DW_LNE_define_file: 3,
    DW_LNE_set_discriminator: 4,

    DW_TAG_array_type: 0x01,
    DW_TAG_class_type: 0x02,
    DW_TAG_entry_point: 0x03,
    DW_TAG_enumeration_type: 0x04,
    DW_TAG_formal_parameter: 0x05,
    DW_TAG_imported_declaration: 0x08,
    DW_TAG_label: 0x0a,
    DW_TAG_lexical_block: 0x0b,
    DW_TAG_member: 0x0d,
    DW_TAG_pointer_type: 0x0f,
    DW_TAG_reference_type: 0x10,
    DW_TAG_compile_unit: 0x11,
    DW_TAG_string_type: 0x12,
    DW_TAG_structure_type: 0x13,
    DW_TAG_subroutine_type: 0x15,
    DW_TAG_typedef: 0x16,
    DW_TAG_union_type: 0x17,
    DW_TAG_unspecified_parameters: 0x18,
    DW_TAG_variant: 0x19,
    DW_TAG_common_block: 0x1a,
    DW_TAG_common_inclusion: 0x1b,
    DW_TAG_inheritance: 0x1c,
    DW_TAG_inlined_subroutine: 0x1d,
    DW_TAG_module: 0x1e,
    DW_TAG_ptr_to_member_type: 0x1f,
    DW_TAG_set_type: 0x20,
    DW_TAG_subrange_type: 0x21,
    DW_TAG_with_stmt: 0x22,
    DW_TAG_access_declaration: 0x23,
    DW_TAG_base_type: 0x24,
    DW_TAG_catch_block: 0x25,
    DW_TAG_const_type: 0x26,
    DW_TAG_constant: 0x27,
    DW_TAG_enumerator: 0x28,
    DW_TAG_file_type: 0x29,
    DW_TAG_friend: 0x2a,
    DW_TAG_namelist: 0x2b,
    DW_TAG_namelist_item: 0x2c,
    DW_TAG_packed_type: 0x2d,
    DW_TAG_subprogram: 0x2e,
    DW_TAG_template_type_parameter: 0x2f,
    DW_TAG_template_value_parameter: 0x30,
    DW_TAG_thrown_type: 0x31,
    DW_TAG_try_block: 0x32,
    DW_TAG_variant_part: 0x33,
    DW_TAG_variable: 0x34,
    DW_TAG_volatile_type: 0x35,
    DW_TAG_dwarf_procedure: 0x36,
    DW_TAG_restrict_type: 0x37,
    DW_TAG_interface_type: 0x38,
    DW_TAG_namespace: 0x39,
    DW_TAG_imported_module: 0x3a,
    DW_TAG_unspecified_type: 0x3b,
    DW_TAG_partial_unit: 0x3c,
    DW_TAG_imported_unit: 0x3d,
    DW_TAG_condition: 0x3f,
    DW_TAG_shared_type: 0x40,
    DW_TAG_type_unit: 0x41,
    DW_TAG_rvalue_reference_type: 0x42,
    DW_TAG_template_alias: 0x43,
    DW_TAG_lo_user: 0x4080,
    DW_TAG_hi_user: 0xffff,

    DW_CHILDREN_no: 0x00,
    DW_CHILDREN_yes: 0x01,

    DW_AT_name: 0x03,
    DW_AT_stmt_list: 0x10,
    DW_AT_low_pc: 0x11,
    DW_AT_high_pc: 0x12,
    DW_AT_ranges: 0x55,
    DW_AT_comp_dir: 0x1b,
    DW_AT_decl_column: 0x39,
    DW_AT_decl_file: 0x3a,
    DW_AT_decl_line: 0x3b,
    DW_AT_call_column: 0x57,
    DW_AT_call_file: 0x58,
    DW_AT_call_line: 0x59,

    DW_FORM_addr: 0x01,
    DW_FORM_block2: 0x03,
    DW_FORM_block4: 0x04,
    DW_FORM_data2: 0x05,
    DW_FORM_data4: 0x06,
    DW_FORM_data8: 0x07,
    DW_FORM_string: 0x08,
    DW_FORM_block: 0x09,
    DW_FORM_block1: 0x0a,
    DW_FORM_data1: 0x0b,
    DW_FORM_flag: 0x0c,
    DW_FORM_sdata: 0x0d,
    DW_FORM_strp: 0x0e,
    DW_FORM_udata: 0x0f,
    DW_FORM_ref_addr: 0x10,
    DW_FORM_ref1: 0x11,
    DW_FORM_ref2: 0x12,
    DW_FORM_ref4: 0x13,
    DW_FORM_ref8: 0x14,
    DW_FORM_ref_udata: 0x15,
    DW_FORM_indirect: 0x16,
    DW_FORM_sec_offset: 0x17,
    DW_FORM_exprloc: 0x18,
    DW_FORM_flag_present: 0x19,
    DW_FORM_ref_sig8: 0x20,
};

const getDWARFEncodingName = (type, encoding) => {
    const entry = Object.entries(DWARFEncodings).find(
        (entry) => entry[0].startsWith(type) && entry[1] == encoding
    );
    if (entry) {
        return entry[0];
    }
    return encoding.toString(16);
};

const isBlock = (form) => {
    return (
        form == DWARFEncodings.DW_FORM_block ||
        form == DWARFEncodings.DW_FORM_block1 ||
        form == DWARFEncodings.DW_FORM_block2 ||
        form == DWARFEncodings.DW_FORM_block4 ||
        form == DWARFEncodings.DW_FORM_block8
    );
};

const isConstant = (form) => {
    return (
        form == DWARFEncodings.DW_FORM_data1 ||
        form == DWARFEncodings.DW_FORM_data2 ||
        form == DWARFEncodings.DW_FORM_data4 ||
        form == DWARFEncodings.DW_FORM_data8 ||
        form == DWARFEncodings.DW_FORM_sdata ||
        form == DWARFEncodings.DW_FORM_udata
    );
};

const isRefOffset = (form) => {
    return (
        form == DWARFEncodings.DW_FORM_ref1 ||
        form == DWARFEncodings.DW_FORM_ref2 ||
        form == DWARFEncodings.DW_FORM_ref4 ||
        form == DWARFEncodings.DW_FORM_ref8 ||
        form == DWARFEncodings.DW_FORM_ref_udata
    );
};

const readDWARFForm = (buffer, form) => {
    switch (form) {
        case DWARFEncodings.DW_FORM_addr: {
            return buffer.readBigUInt64();
        }
        case DWARFEncodings.DW_FORM_block: {
            return buffer.readBuffer(buffer.readULEB128());
        }
        case DWARFEncodings.DW_FORM_block1: {
            return buffer.readBuffer(buffer.readUInt8());
        }
        case DWARFEncodings.DW_FORM_block2: {
            return buffer.readBuffer(buffer.readUInt16());
        }
        case DWARFEncodings.DW_FORM_block4: {
            return buffer.readBuffer(buffer.readUInt32());
        }
        case DWARFEncodings.DW_FORM_data1: {
            return buffer.readBuffer(1);
        }
        case DWARFEncodings.DW_FORM_data2: {
            return buffer.readBuffer(2);
        }
        case DWARFEncodings.DW_FORM_data4: {
            return buffer.readBuffer(4);
        }
        case DWARFEncodings.DW_FORM_data8: {
            return buffer.readBuffer(8);
        }
        case DWARFEncodings.DW_FORM_sdata: {
            return buffer.readLEB128();
        }
        case DWARFEncodings.DW_FORM_udata: {
            return buffer.readULEB128();
        }
        case DWARFEncodings.DW_FORM_exprloc: {
            return buffer.readBuffer(buffer.readULEB128());
        }
        case DWARFEncodings.DW_FORM_flag: {
            return buffer.readUInt8() != 0;
        }
        case DWARFEncodings.DW_FORM_flag_present: {
            return true;
        }
        case DWARFEncodings.DW_FORM_sec_offset: {
            return buffer.readUInt32();
        }
        case DWARFEncodings.DW_FORM_ref1: {
            return buffer.readUInt8();
        }
        case DWARFEncodings.DW_FORM_ref2: {
            return buffer.readUInt16();
        }
        case DWARFEncodings.DW_FORM_ref4: {
            return buffer.readUInt32();
        }
        case DWARFEncodings.DW_FORM_ref8: {
            return buffer.readBigUInt64();
        }
        case DWARFEncodings.DW_FORM_ref_udata: {
            return buffer.readULEB128();
        }
        case DWARFEncodings.DW_FORM_ref_addr: {
            return buffer.readUInt32();
        }
        case DWARFEncodings.DW_FORM_ref_sig8: {
            return buffer.readBigUInt64();
        }
        case DWARFEncodings.DW_FORM_string: {
            return buffer.readCString();
        }
        case DWARFEncodings.DW_FORM_strp: {
            return buffer.readUInt32();
        }
        case DWARFEncodings.DW_FORM_indirect: {
            return readDWARFForm(buffer.readULEB128());
        }
    }
};

module.exports = {
    DWARFEncodings,
    getDWARFEncodingName,
    isBlock,
    isConstant,
    isRefOffset,
    readDWARFForm,
};
