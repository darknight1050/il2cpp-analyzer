//https://github.com/bmancini55/node-buffer-cursor

const assert = require("assert"),
    Bn = require("bn.js");

class PositionalBuffer {

    constructor(buffer, startPosition = 0) {
        assert(Buffer.isBuffer(buffer), "No buffer");
        this._buffer = buffer;
        this._startPosition = startPosition;
        this._position = startPosition;
    }
    
    get position() {
        return this._position - this._startPosition;
    }

    set position(value) {
        this._position = this._startPosition + Number(value);
    }

    get buffer() {
        return this._buffer;
    }

    copy(startPosition = 0) {
        return new PositionalBuffer(this._buffer, startPosition);
    }

    readInt8(length = 1) {
        const result = this._buffer.readInt8(this._position);
        this._position += length;
        return result;
        //return this._readStandard("readInt8", length);
    }

    readUInt8(length = 1) {
        const result = this._buffer.readUInt8(this._position);
        this._position += length;
        return result;
        //return this._readStandard("readUInt8", length);
    }
    
    readInt16(length = 2) {
        const result = this._buffer.readInt16LE(this._position);
        this._position += length;
        return result;
        //return this._readStandard("readInt16LE", length);
    }
    
    readUInt16(length = 2) {
        const result = this._buffer.readUInt16LE(this._position);
        this._position += length;
        return result;
        //return this._readStandard("readUInt16LE", length);
    }

    readInt32(length = 4) {
        const result = this._buffer.readInt32LE(this._position);
        this._position += length;
        return result;
        //return this._readStandard("readInt32LE", length);
    }

    readUInt32(length = 4) {
        const result = this._buffer.readUInt32LE(this._position);
        this._position += length;
        return result;
        //return this._readStandard("readUInt32LE", length);
    }

    readBigInt64(length = 8) {
        const result = this._buffer.readBigInt64LE(this._position);
        this._position += length;
        return result;
        //return this._readStandard("readBigInt64LE", length);
    }

    readBigUInt64(length = 8) {
        const result = this._buffer.readBigUInt64LE(this._position);
        this._position += length;
        return result;
    }

    _readStandard(fn, length) {
        const result = this._buffer[fn](this._position);
        this._position += length;
        return result;
    }

    //https://gitlab.com/mjbecze/leb128
    readLEB128() {
        const num = new Bn(0);
        let shift = 0;
        while (true) {
            const byt = this.readUInt8();
            num.ior(new Bn(byt & 0x7f).shln(shift));
            shift += 7;
            if (byt >> 7 === 0) {
                break;
            }
        }
        return Number(num.fromTwos(shift));
    }

    readULEB128() {
        const num = new Bn(0);
        let shift = 0;
        while (true) {
            const byt = this.readUInt8();
            num.ior(new Bn(byt & 0x7f).shln(shift));
            if (byt >> 7 === 0) {
                break;
            } else {
                shift += 7;
            }
        }
        return Number(num);
    }

    readStruct(struct) {
        const result = struct.read(this._buffer, this._position);
        this._position += struct.SIZE;
        return result;
    }

    readCString() {
        let len = 0;
        while (this._buffer.readUInt8(this._position + len) != 0) {
            len++;
            if (len >= this._buffer.length) {
                throw new Error("Null terminated string went outside buffer!");
            }
        }
        const result = this._buffer.toString("ASCII", this._position, this._position + len);
        this._position += len + 1;
        return result;
    }

    readBuffer(length) {
        const result = Uint8Array.prototype.slice.call(this._buffer, this._position, this._position + length);
        this._position += length;
        return result;
    }

}

module.exports = PositionalBuffer;