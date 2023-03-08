const Struct = require("structron");
require("./types");

//https://github.com/facebookincubator/oculus-linux-kernel/blob/oculus-quest-kernel-master/include/uapi/linux/elf.h

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

module.exports = { readELF };