const {encodedArrayType, nullArgument} = require("./ABIEncoder.js");
const {EthereumABIParseError} = require("./errors.js");
const {toChecksumAddress} = require("./ethAddressChecksum.js");

const decodeBoolean = function(hexStr, offset){
	hexStr = hexStr.substring(offset, offset + 64);
	return hexStr !== nullArgument; // Anything not 0 is true.
}
const decodeNumber = function(hexStr, offset){ // uint8 to uint48
	return parseInt(hexStr.substring(offset, offset + 64), 16);
}
const decodeBigNumber = function(hexStr, offset){ // uint56 to uint256
	return BigInt("0x" + hexStr.substring(offset, offset + 64))
}

const decodeSignedNumber = function(hexStr,offset,bitLength){
	hexStr = hexStr.substring(offset, offset + 64);
	const hexLength = bitLength / 4;
	hexStr = hexStr.substring(64 - hexLength); // remove any overflow bits
	if (bitLength <= 48){ // Implementation using Numbers
		let num = parseInt(hexStr, 16);
		
		// TODO: cache maxPositiveValue and subtractValue
		const maxPositiveValue = (2 ** (bitLength - 1)) - 1;
		if (num > maxPositiveValue){
			num -= 2 ** bitLength;
		}
		return num;
	}else{ // Implementation using BigNumbers
		let num = BigInt("0x" + hexStr);
		
		// TODO: cache maxPositiveValue and subtractValue
		const maxPositiveValue = (2n ** BigInt(bitLength - 1)) - 1n;
		if (num > maxPositiveValue){
			num -= 2n ** BigInt(bitLength);
		}
		return num;
	}
}

const decodeAddress = function(hexStr,offset){
	return toChecksumAddress(hexStr.substring(offset + 24,offset + 64 + 24), true);
}

const deocdeFixedBuffer = function(hexStr, offset, byteLength){
	return Buffer.from(hexStr.substring(offset, offset + byteLength * 2), "hex");
}

const decodeBuffer = function(hexStr,offset){
	let stringPos = decodeNumber(hexStr,offset)*2;
	if ((stringPos+64) > hexStr.length){
		throw new EthereumABIParseError("A buffer pointer pointed outside the ABI buffer. (Pointed to "+(stringPos/2)+"), buffer length was "+(hexStr.length/2)+" bytes");
	}
	let len = decodeNumber(hexStr,stringPos);
	if (len > 0){
		stringPos += 64;
		let endPos = stringPos+(len*2);
		if (endPos > hexStr.length){
			throw new EthereumABIParseError("Attemped to read outside the ABI buffer (Tried to read from "+(stringPos/2)+" to "+(endPos/2)+", buffer length was "+(hexStr.length/2)+" bytes");
		}
		return Buffer.from(hexStr.substring(stringPos, endPos), "hex");
	}else{
		return Buffer.alloc(0);
	}
}

//hexToString
const decodeString = function(hexStr,offset){
	let stringPos = decodeNumber(hexStr,offset)*2;
	if ((stringPos+64) > hexStr.length){
		throw new EthereumABIParseError("A string pointer pointed outside the ABI buffer. (Pointed to "+(stringPos/2)+"), buffer length was "+(hexStr.length/2)+" bytes");
	}
	let len = decodeNumber(hexStr,stringPos);
	if (len > 0){
		stringPos += 64;
		let endPos = stringPos+(len*2);
		if (endPos > hexStr.length){
			throw new EthereumABIParseError("Attemped to read outside the ABI buffer (Tried to read from "+(stringPos/2)+" to "+(endPos/2)+", buffer length was "+(hexStr.length/2)+" bytes");
		}
		return Buffer.from(hexStr.substring(stringPos,endPos), "hex").toString("utf8");
	}else{
		return "";
	}
}

const decodeFunctions = {
	address:decodeAddress,
	bool:decodeBoolean,
	bytes:decodeBuffer,
	string:decodeString
}
// > Actually copy/pasting
for (let i=8;i<=48;i+=8){
	decodeFunctions["uint"+i] = decodeNumber;
	let ii = i;
	decodeFunctions["int"+ii] = function(hexStr,offset){
		return decodeSignedNumber(hexStr,offset,ii);
	};
}
for (let i=56;i<=256;i+=8){
	decodeFunctions["uint"+i] = decodeBigNumber;
	let ii = i;
	decodeFunctions["int"+ii] = function(hexStr,offset){
		return decodeSignedNumber(hexStr,offset,ii);
	};
}
for (let i=1;i<=32;i+=1){
	let ii = i;
	decodeFunctions["bytes"+ii] = function(hexStr,offset){
		return deocdeFixedBuffer(hexStr,offset,ii);
	};
}
decodeFunctions.byte = decodeFunctions["bytes1"];
decodeFunctions.uint = decodeFunctions["uint256"];

const decodeArgument = function(hexStr,offset,type,argData,arrayLevel){
	let arrType = encodedArrayType(type);
	
	let nestedArg = argData;
	for (let i=0;i<arrayLevel.length;i+=1){
		nestedArg = nestedArg[arrayLevel[i]];
	}
	if (arrType[0]){ // Is an array
		arrayLevel.push(nestedArg.length);
		let innerArr = [];
		nestedArg.push(innerArr);
		if (arrType[1] == null){ // It has a dynamic length
			let arrayPos = decodeNumber(hexStr,offset)*2;
			
			let len = decodeNumber(hexStr,arrayPos);
			arrayPos += 64;
			for (let i=0;i<len;i+=1){
				arrayPos = decodeArgument(hexStr,arrayPos,arrType[2],argData,arrayLevel);
			}
			offset += 64;
		}else{
			for (let i=0;i<arrType[1];i+=1){
				offset = decodeArgument(hexStr,offset,arrType[2],argData,arrayLevel);
			}
		}
		arrayLevel.pop();
	}else{
		nestedArg.push(decodeFunctions[type](hexStr,offset));
		offset += 64;
	}
	return offset;
	/*
	
	*/
}
const decodeArguments = function(hexStr,types){
	let offset = 0;
	let arrayLevel = [];
	let argData = [];
	for (let i=0;i<types.length;i+=1){
		offset = decodeArgument(hexStr,offset,types[i],argData,arrayLevel);
	}
	return argData;
}
const decode = function(hexStr,abiSnippet){
	let types = [];
	if (abiSnippet.outputs.length > 0){
		types[0] = abiSnippet.outputs[0].type;
	}
	for (let i=1;i<abiSnippet.outputs.length;i+=1){
		types[i] = abiSnippet.outputs[i].type;
	}
	if (hexStr.substring(0,2) === "0x"){
		hexStr = hexStr.substring(2);
	}
	return decodeArguments(hexStr,types);
}
module.exports = {
	decodeFunctions,
	decodeString,
	decodeArguments,
	decode
}
