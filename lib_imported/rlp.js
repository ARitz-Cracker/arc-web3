/* 
 * Imported library: ethereumjs/rlp
 * Imported from https://github.com/ethereumjs/rlp/blob/5849c7b8d19458cb2e591ce6ee303e45e4756f5d/index.js
 * Copyright © 2014-2018 wanderer (https://github.com/wanderer); Carey Janecka (https://github.com/figitaki); Jaco Greeff; https://github.com/jacogr
 * This file is Used, modified, and redistributed under the terms defined in the "Mozilla Public License 2.0" Lisence. Visit https://github.com/ethereumjs/rlp/blob/5849c7b8d19458cb2e591ce6ee303e45e4756f5d/LICENSE to obtain a copy of this lisence.
 */
const BigNumber = require("bignumber.js");
const BufferLib = require("../wrappers-node/bufferconversion.js");
 
/**
 * RLP Encoding based on: https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-RLP
 * This function takes in a data, convert it to buffer if not, and a length for recursion
 *
 * @param {Buffer,String,Integer,Array,Uint8Array} data - will be converted to buffer
 * @returns {Buffer} - returns buffer of encoded data
 **/
exports.encode = function (input) {
	if (input instanceof Array) {
		var output = []
		for (var i = 0; i < input.length; i++) {
			output.push(exports.encode(input[i]))
		}
		var buf = BufferLib.concat(output)
		return BufferLib.concat([encodeLength(buf.length, 192), buf])
	} else {
		input = toBuffer(input)
		if (input.length === 1 && input[0] < 128) {
			return input
		} else {
			return BufferLib.concat([encodeLength(input.length, 128), input])
		}
	}
}

function safeParseInt (v, base) {
	if (v.slice(0, 2) === '00') {
		throw (new Error('invalid RLP: extra zeros'))
	}

	return parseInt(v, base)
}

function encodeLength (len, offset) {
	if (len < 56) {
		return BufferLib.from([len + offset])
	} else {
		var hexLength = intToHex(len)
		var lLength = hexLength.length / 2
		var firstByte = intToHex(offset + 55 + lLength)
		return BufferLib.hexToBuffer(firstByte + hexLength,false);
	}
}

/**
 * RLP Decoding based on: {@link https://github.com/ethereum/wiki/wiki/%5BEnglish%5D-RLP|RLP}
 * @param {Buffer,String,Integer,Array} data - will be converted to buffer
 * @returns {Array} - returns decode Array of Buffers containg the original message
 **/
exports.decode = function (input, stream) {
	if (!input || input.length === 0) {
		return BufferLib.newBufferUnsafe(0);
	}

	input = toBuffer(input)
	var decoded = _decode(input)

	if (stream) {
		return decoded
	}

	if (decoded.remainder.length !== 0){
		throw new Error("invalid remainder");
	}
	return decoded.data
}

exports.getLength = function (input) {
	if (!input || input.length === 0) {
		return BufferLib.newBufferUnsafe(0);
	}

	input = toBuffer(input)
	var firstByte = input[0]
	if (firstByte <= 0x7f) {
		return input.length
	} else if (firstByte <= 0xb7) {
		return firstByte - 0x7f
	} else if (firstByte <= 0xbf) {
		return firstByte - 0xb6
	} else if (firstByte <= 0xf7) {
		// a list between	0-55 bytes long
		return firstByte - 0xbf
	} else {
		// a list	over 55 bytes long
		var llength = firstByte - 0xf6
		var length = safeParseInt(input.slice(1, llength).toString('hex'), 16)
		return llength + length
	}
}

function _decode (input) {
	var length, llength, data, innerRemainder, d
	var decoded = []
	var firstByte = input[0]

	if (firstByte <= 0x7f) {
		// a single byte whose value is in the [0x00, 0x7f] range, that byte is its own RLP encoding.
		return {
			data: input.slice(0, 1),
			remainder: input.slice(1)
		}
	} else if (firstByte <= 0xb7) {
		// string is 0-55 bytes long. A single byte with value 0x80 plus the length of the string followed by the string
		// The range of the first byte is [0x80, 0xb7]
		length = firstByte - 0x7f

		// set 0x80 null to 0
		if (firstByte === 0x80) {
			data = BufferLib.newBufferUnsafe(0);
		} else {
			data = input.slice(1, length)
		}

		if (length === 2 && data[0] < 0x80) {
			throw new Error('invalid rlp encoding: byte must be less 0x80')
		}

		return {
			data: data,
			remainder: input.slice(length)
		}
	} else if (firstByte <= 0xbf) {
		llength = firstByte - 0xb6
		length = safeParseInt(input.slice(1, llength).toString('hex'), 16)
		data = input.slice(llength, length + llength)
		if (data.length < length) {
			throw (new Error('invalid RLP'))
		}

		return {
			data: data,
			remainder: input.slice(length + llength)
		}
	} else if (firstByte <= 0xf7) {
		// a list between	0-55 bytes long
		length = firstByte - 0xbf
		innerRemainder = input.slice(1, length)
		while (innerRemainder.length) {
			d = _decode(innerRemainder)
			decoded.push(d.data)
			innerRemainder = d.remainder
		}

		return {
			data: decoded,
			remainder: input.slice(length)
		}
	} else {
		// a list	over 55 bytes long
		llength = firstByte - 0xf6
		length = safeParseInt(input.slice(1, llength).toString('hex'), 16)
		var totalLength = llength + length
		if (totalLength > input.length) {
			throw new Error('invalid rlp: total length is larger than the data')
		}

		innerRemainder = input.slice(llength, totalLength)
		if (innerRemainder.length === 0) {
			throw new Error('invalid rlp, List has a invalid length')
		}

		while (innerRemainder.length) {
			d = _decode(innerRemainder)
			decoded.push(d.data)
			innerRemainder = d.remainder
		}
		return {
			data: decoded,
			remainder: input.slice(totalLength)
		}
	}
}

function isHexPrefixed (str) {
	return str.slice(0, 2) === '0x'
}

function intToHex (i) {
	var hex = i.toString(16)
	if (hex.length % 2) {
		hex = '0' + hex
	}

	return hex
}

function padToEven (a) {
	if (a.length % 2) a = '0' + a
	return a
}

function intToBuffer (i) {
	var hex = intToHex(i)
	return BufferLib.hexToBuffer(hex,false);
}

function toBuffer (v) {
	if (!(v instanceof Uint8Array)) {
		if (typeof v === 'string') {
			if (isHexPrefixed(v)) {
				v = BufferLib.hexToBuffer(v);
			} else {
				v = BufferLib.stringToBuffer(v);
			}
		} else if (typeof v === 'number') {
			if (!v) {
				v = BufferLib.newBufferUnsafe(0);
			} else {
				v = intToBuffer(v)
			}
		} else if (v === null || v === undefined) {
			v = BufferLib.newBufferUnsafe(0);
		/*
		} else if (v.toArray) {
			// converts a BN to a Buffer
			v = Buffer.from(v.toArray())
		*/
		} else if (BigNumber.isBigNumber(v)) {
			if (v.isZero()) {
				v = BufferLib.newBufferUnsafe(0);
			} else {
				v = intToBuffer(v)
			}
		} else {
			throw new Error('invalid type')
		}
	}
	return v
}

