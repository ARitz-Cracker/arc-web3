const BufferLib = require("arc-bufferlib");

const {encodedArrayType,nullArgument} = require("./ABIEncoder.js");
const {EthereumABIParseError} = require("./errors.js");

const BigNumber = require("bignumber.js");
const {keccak256} = require('js-sha3');

let decodeBoolean = function(hexStr,offset){
	hexStr = hexStr.substring(offset,offset+64);
	return hexStr !== nullArgument; // Anything not 0 is true.
}
let decodeNumber = function(hexStr,offset){ // uint8 to uint48
	return parseInt(hexStr.substring(offset,offset+64),16);
}
let decodeBigNumber = function(hexStr,offset){ // uint56 to uint256
	return new BigNumber(hexStr.substring(offset,offset+64),16);
}

let two = new BigNumber(2);
let decodeSignedNumber = function(hexStr,offset,bitLength){
	hexStr = hexStr.substring(offset,offset+64);
	let hexLength = bitLength/4;
	hexStr = hexStr.substring(64-hexLength); // remove any overflow bits
	if (bitLength <= 48){ // Implementation using Numbers
		let num = parseInt(hexStr,16);
		
		// TODO: cache maxPositiveValue and subtractValue
		let maxPositiveValue = (2**(bitLength-1))-1;
		if (num > maxPositiveValue){
			let subtractValue = 2**bitLength;
			num -= subtractValue;
		}
		return num;
	}else{ // Implementation using BigNumbers
		let num = new BigNumber(hexStr,16);
		
		// TODO: cache maxPositiveValue and subtractValue
		let maxPositiveValue = two.pow(bitLength-1).minus(1);
		if (num.isGreaterThan(maxPositiveValue)){
			let subtractValue = two.pow(bitLength);
			num = num.minus(subtractValue);
		}
		return num;
	}
}

let decodeAddress = function(hexStr,offset){
	// TODO: add checksum
	return "0x"+hexStr.substring(offset+24,offset+64+24);
}

let deocdeFixedBuffer = function(hexStr,offset,byteLength){
	return BufferLib.hexToBuffer(hexStr.substring(offset,offset+byteLength*2),false);
}

let decodeBuffer = function(hexStr,offset){
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
		return BufferLib.hexToBuffer(hexStr.substring(stringPos,endPos),false);
	}else{
		return BufferLib.newBufferUnsafe(0);
	}
}

//hexToString
let decodeString = function(hexStr,offset){
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
		return BufferLib.hexToString(hexStr.substring(stringPos,endPos),false);
	}else{
		return "";
	}
}

let decodeFunctions = {
	"address":decodeAddress,
	"bool":decodeBoolean,
	"bytes":decodeBuffer,
	"string":decodeString
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
decodeFunctions["byte"] = decodeFunctions["bytes1"];
decodeFunctions["uint"] = decodeFunctions["uint256"];

let decodeArgument = function(hexStr,offset,type,argData,arrayLevel){
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
let decodeArguments = function(hexStr,types){
	let offset = 0;
	let arrayLevel = [];
	let argData = [];
	for (let i=0;i<types.length;i+=1){
		offset = decodeArgument(hexStr,offset,types[i],argData,arrayLevel);
	}
	return argData;
}
let decode = function(hexStr,abiSnippet){
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
	decodeString:decodeString,
	decodeArguments:decodeArguments,
	decode:decode
}

