const {EthereumAccount} = require("./account.js");
const {EthereumContract, EthereumContractFunction, EthereumContractMultiFunction} = require("./smartContract.js");
// const {decode,decodeString} = require("./ABIDecoder.js");
const {isValidAddress} = require("./ethAddressChecksum.js");

const {keccak256} = require("keccak-wasm");

const nullArgument = "0000000000000000000000000000000000000000000000000000000000000000";
const guardBytes = "fefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefe"; // If I ever see this in the end result, should be a cause for concern.
const maxValue = BigInt("0x10000000000000000000000000000000000000000000000000000000000000000");

// Encoding functions
const encodeBoolean = function(bool){
	if(bool){
		return "0000000000000000000000000000000000000000000000000000000000000001"; // Truly a waste.
	}
	return nullArgument;
};
const encodeNumber = function(num){
	if(typeof num === "number"){
		num = BigInt(num);
	}
	if(typeof num !== "bigint"){
		return nullArgument;
	}
	if(num < 0){
		num = maxValue + num; // Number is already negative.
		if(num < 0){
			throw new RangeError("Cannot have a negative number less than -115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,935."); // Though at this point they already underflowed multiple times.
		}
	}
	const str = num.toString(16);
	if(str.length > 64){
		throw new RangeError("Cannot have a number larger than 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,935.");
	}
	return "0".repeat(64 - str.length) + str;
};
const encodeAddress = function(thing){
	if(typeof thing == "string"){
		if(isValidAddress(thing)){
			return "0".repeat(24) + thing.substring(2).toLowerCase();
		}
		// throw new TypeError("Invalid 'address' argument.");
		return nullArgument;
	}else if(thing instanceof EthereumAccount || thing instanceof EthereumContract){
		return "0".repeat(24) + thing.address.substring(2).toLowerCase();
	}
	// throw new TypeError("Invalid 'address' argument.");
	return nullArgument;
};
const encodeFunction = function(contractFunc){
	if(contractFunc instanceof EthereumContractMultiFunction){
		throw new TypeError("This EthereumContract has multiple functions with the same name. You must select the function using its name and argument types.");
	}
	if(!(contractFunc instanceof EthereumContractFunction)){
		throw new TypeError("Only EthereumContractFunctions can be passed to EthereumContracts");
	}
	return contractFunc.contract._jsproperties.account.address.substring(2).toLowerCase() + contractFunc.selectorHash.substring(2) + ("0".repeat(16));
};
const encodeFixedBuffer = function(buff, len){
	if(!(buff instanceof Uint8Array)){
		return nullArgument;
	}
	if(buff.length !== len){
		throw new RangeError("a bytes" + len + " was expected but a bytes" + buff.length + " was given.");
	}
	if(!Buffer.isBuffer(buff)){
		buff = Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength);
	}
	const str = buff.toString("hex");
	return str + ("0".repeat(64 - str.length));
};
const encodeBuffer = function(buff){
	if(!(buff instanceof Uint8Array)){
		buff = Buffer.alloc(0);
	}
	if(!Buffer.isBuffer(buff)){
		buff = Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength);
	}
	const hexstr = buff.toString("hex");
	const len = hexstr.length / 2;
	let finalResult;
	if(len == 0){
		finalResult = new String(""); // Allows for the string to have arbetrary properties.
	}else{
		// hexstr += "0".repeat(64-(str.length%64));
		finalResult = new String(encodeNumber(len) + hexstr); // Allows for the string to have arbetrary properties.
	}
	finalResult.requiresPointer = true;
	return finalResult;
};
const encodeString = function(str){
	if(typeof str !== "string"){
		str = "";
	}
	const hexstr = Buffer.from(str).toString("hex");
	const len = hexstr.length / 2;
	let finalResult;
	if(len == 0){
		finalResult = new String("");
	}else{
		// hexstr += "0".repeat(64-(str.length%64));
		finalResult = new String(encodeNumber(len) + hexstr);
	}
	finalResult.requiresPointer = true;
	return finalResult;
};
const encodeFunctions = {
	int: encodeNumber,
	uint: encodeNumber,
	address: encodeAddress,
	bool: encodeBoolean,
	bytes: encodeBuffer,
	string: encodeString,
	func: encodeFunction,
	function: encodeFunction
};
// > Actually copy/pasting
for(let i = 8; i <= 256; i += 8){
	encodeFunctions["uint" + i] = encodeNumber;
	encodeFunctions["int" + i] = encodeNumber;
}
for(let i = 1; i <= 32; i += 1){
	const ii = i;
	encodeFunctions["bytes" + ii] = function(buff){
		return encodeFixedBuffer(buff, ii);
	};
}
encodeFunctions.byte = encodeFunctions.bytes1;


const encodedArrayType = function(type){ // returns [isArray,length,type]
	/* Note: In solidity, the behaviour is uint[][5] -> (uint[])[5]
	   Described as "an array of 5 dynamic arrays" */

	const i = type.lastIndexOf("[");
	if(i === -1){
		return [false];
	}
	const arrayLength = type.substring(i + 1, type.length - 1); // I'm assuming the last char is "]"
	type = type.substring(0, i);
	if(arrayLength === ""){
		return [true, null, type];
	}
	return [true, arrayLength | 0, type];
};

const encodeArgument = function(arg, type, argData, arrayLevel){
	const arrType = encodedArrayType(type);

	let nestedArg = argData;
	for(let i = 0; i < arrayLevel.length; i += 1){
		nestedArg = nestedArg[arrayLevel[i]];
	}
	if(arrType[0]){ // Is an array
		arrayLevel.push(nestedArg.length);
		const innerArr = [];
		nestedArg.push(innerArr);
		if(arrType[1] == null){ // It has a dynamic length
			innerArr.requiresPointer = true;
			for(let i = 0; i < arg.length; i += 1){
				encodeArgument(arg[i], arrType[2], argData, arrayLevel);
			}
		}else{
			for(let i = 0; i < arrType[1]; i += 1){
				encodeArgument(arg[i], arrType[2], argData, arrayLevel);
			}
		}
		arrayLevel.pop();
	}else{
		nestedArg.push(encodeFunctions[type](arg));
	}
};

const encodeArgumentArray = function(args, types){
	const argData = [];
	for(let i = 0; i < types.length; i += 1){
		encodeArgument(args[i], types[i], argData, []);
	}
	return argData;
};
const encodedFixedArray = function(hexStr, pendingHeapEncodes, arr){
	for(let i = 0; i < arr.length; i += 1){
		const arg = arr[i];
		if(arg.requiresPointer){
			pendingHeapEncodes.push({
				offset: hexStr.length,
				data: arg
			});
			hexStr += guardBytes;
		}else if(arg instanceof Array){
			hexStr = encodedFixedArray(hexStr, pendingHeapEncodes, arg);
		}else{
			hexStr += arg;
		}
	}
	return hexStr;
};

const encodeArguments = function(args, types){
	const argData = encodeArgumentArray(args, types);
	let hexStr = "";
	let pendingHeapEncodes = [];
	for(let i = 0; i < argData.length; i += 1){
		const arg = argData[i];
		if(arg.requiresPointer){
			pendingHeapEncodes.push({
				offset: hexStr.length,
				data: arg
			});
			hexStr += guardBytes;
		}else if(arg instanceof Array){
			hexStr = encodedFixedArray(hexStr, pendingHeapEncodes, arg);
		}else{
			hexStr += arg;
		}
	}
	let newPendingHeapEncodes = [];
	const pendingNullEncodes = [];
	while(pendingHeapEncodes.length > 0){
		for(let i = 0; i < pendingHeapEncodes.length; i += 1){
			const heapArg = pendingHeapEncodes[i];
			if(heapArg.data == ""){ // I'm relying on ("" == []) here so no submitting PRs trying to "fix" this line.
				pendingNullEncodes.push(heapArg.offset);
			}else{
				const pointer = encodeNumber(hexStr.length / 2);
				hexStr = hexStr.substring(0, heapArg.offset) + pointer + hexStr.substring(heapArg.offset + 64);

				if(heapArg.data instanceof Array){
					hexStr += encodeNumber(heapArg.data.length);
					for(let ii = 0; ii < heapArg.data.length; ii += 1){
						const arg = heapArg.data[ii];
						if(arg.requiresPointer){
							newPendingHeapEncodes.push({
								offset: hexStr.length,
								data: arg
							});
							hexStr += guardBytes;
						}else if(arg instanceof Array){
							hexStr = encodedFixedArray(hexStr, pendingHeapEncodes, arg);
						}else{
							hexStr += arg;
						}
					}
				}else{ // String or Buffer.
					hexStr += heapArg.data;
				}
			}
		}
		pendingHeapEncodes = newPendingHeapEncodes;
		newPendingHeapEncodes = [];
	}
	if(pendingNullEncodes.length == 0){
		return hexStr;
	}
	// Let's find a 0 amongst the already existing data cuz why the fuck not. Nobody told me that the data had to be within the appended heap
	let dynamicNullOffset = hexStr.indexOf(nullArgument);
	while(dynamicNullOffset % 2 == 1){ // Must be an even number because references are in bytes, not nibbles.
		dynamicNullOffset = hexStr.indexOf(nullArgument, dynamicNullOffset + 1);
	}
	if(dynamicNullOffset >= 0){
		dynamicNullOffset /= 2;
	}else{
		dynamicNullOffset = hexStr.length / 2;
		hexStr += nullArgument;
	}
	const dynamicNullOffsetHex = encodeNumber(dynamicNullOffset);
	let finalHexStr = "";
	for(let i = 0; i < pendingNullEncodes.length; i += 1){
		finalHexStr += hexStr.substring(finalHexStr.length, pendingNullEncodes[i]) + dynamicNullOffsetHex;
	}
	return finalHexStr;
};

const encode = function(args, abiSnippet, selectorHash){
	const types = [];
	if(selectorHash == null){
		let funcID = abiSnippet.name + "(";
		if(abiSnippet.inputs.length > 0){
			types[0] = abiSnippet.inputs[0].type;
			funcID += types[0];
		}
		for(let i = 1; i < abiSnippet.inputs.length; i += 1){
			types[i] = abiSnippet.inputs[i].type;
			funcID += "," + types[i];
		}
		funcID += ")";
		return "0x" + keccak256(funcID).substring(0, 8) + encodeArguments(args, types);
	}
	for(let i = 0; i < abiSnippet.inputs.length; i += 1){
		types[i] = abiSnippet.inputs[i].type;
	}
	return selectorHash + encodeArguments(args, types);
};
module.exports = {
	encodeFunctions,
	encodeArguments,
	encode,
	encodedArrayType,
	nullArgument
};
