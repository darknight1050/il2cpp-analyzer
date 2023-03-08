const Struct = require("structron");

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
