const Struct = require("structron");

https://github.com/facebookincubator/oculus-linux-kernel/blob/oculus-quest-kernel-master/include/uapi/linux/elf.h
/*
typedef __s64	Elf64_Sxword;
typedef __u64	Elf64_Addr;
typedef __u64	Elf64_Xword;
typedef __u64	Elf64_Off;
typedef __s32	Elf64_Sword;
typedef __u32	Elf64_Word;
typedef __u16	Elf64_Half;
typedef __s16	Elf64_SHalf;

sh_type
#define SHT_NULL	0
#define SHT_PROGBITS	1
#define SHT_SYMTAB	2
#define SHT_STRTAB	3
#define SHT_RELA	4
#define SHT_HASH	5
#define SHT_DYNAMIC	6
#define SHT_NOTE	7
#define SHT_NOBITS	8
#define SHT_REL		9
#define SHT_SHLIB	10
#define SHT_DYNSYM	11
#define SHT_NUM		12
#define SHT_LOPROC	0x70000000
#define SHT_HIPROC	0x7fffffff
#define SHT_LOUSER	0x80000000
#define SHT_HIUSER	0xffffffff

sh_flags
#define SHF_WRITE	0x1
#define SHF_ALLOC	0x2
#define SHF_EXECINSTR	0x4
#define SHF_MASKPROC	0xf0000000

typedef struct elf64_hdr {
  unsigned char	e_ident[EI_NIDENT];	ELF "magic number"
  Elf64_Half e_type;
  Elf64_Half e_machine;
  Elf64_Word e_version;
  Elf64_Addr e_entry;		Entry point virtual address
  Elf64_Off e_phoff;		Program header table file offset
  Elf64_Off e_shoff;		Section header table file offset
  Elf64_Word e_flags;
  Elf64_Half e_ehsize;
  Elf64_Half e_phentsize;
  Elf64_Half e_phnum;
  Elf64_Half e_shentsize;
  Elf64_Half e_shnum;
  Elf64_Half e_shstrndx;
} Elf64_Ehdr;

typedef struct elf64_shdr {
  Elf64_Word sh_name;		Section name, index in string tbl
  Elf64_Word sh_type;		Type of section
  Elf64_Xword sh_flags;		Miscellaneous section attributes
  Elf64_Addr sh_addr;		Section virtual addr at execution
  Elf64_Off sh_offset;		Section file offset
  Elf64_Xword sh_size;		Size of section in bytes
  Elf64_Word sh_link;		Index of another section
  Elf64_Word sh_info;		Additional section information
  Elf64_Xword sh_addralign;	Section alignment
  Elf64_Xword sh_entsize;	Entry size if section holds table
} Elf64_Shdr;

Note header in a PT_NOTE section
typedef struct elf64_note {
    Elf64_Word n_namesz;	Name size
    Elf64_Word n_descsz;	Content size
    Elf64_Word n_type;	    Content type
} Elf64_Nhdr;
*/
Struct.TYPES.ULONG = {
    read(buffer, offset) {
        return Number(buffer.readBigUInt64LE(offset));
    },
    write(value, context, offset) {
        context.buffer.writeBigUInt64LE(BigInt(value), offset);
    },
    SIZE: 8
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
    });
    console.log(buildID);
}

module.exports = { readELF };