const BigNumber = require("./bignumber.js");
const keccak256 = require('js-sha3').keccak256;


const {EthereumContractRevertError,EthereumABIParseError} = require("./errors.js");
const {ExtensibleFunction} = require("./extensibleFunction.js");
const {EthereumAccount} = require("./account.js");
const {EthereumContractEventEmitter} = require("./smartContractEvents.js");

const {decode,decodeString} = require("./ABIDecoder.js");
const {encode} = require("./ABIEncoder.js");
let conversionChart = {
	"address":"Address",
	"int":"BigNumber",
	"uint":"BigNumber",
	"bool":"Boolean",
	"bytes":"Buffer",
	"function":"EthereumFunc",
	"string":"String"
}
// > Actually copy/pasting
for (let i = 8; i <= 48; i += 8){
	conversionChart["uint"+i] = "Number";
	conversionChart["int"+i] = "Number";
}
for (let i = 56; i <= 256; i += 1){
	conversionChart["uint"+i] = "BigNumber";
	conversionChart["int"+i] = "BigNumber";
}

for (let i = 1; i <= 32; i += 1){
	conversionChart["bytes"+i] = "Buffer."+i;
}

/*
class Smth extends ExtensibleFunction {
	constructor(x){
		super(function() { return this.x; }); // closure
		this.x = x;
		console.log(this); // function() { return x; }
		console.log(this.prototype); // {constructor: …}
	}
}
*/

let determineType = function(thing,findArrayType){
	if (thing == null){
		return "Null";
	}
	switch(typeof thing){
		case "number":
			return "Number";
		break;
		case "boolean":
			return "Boolean";
		break;
		case "string":
			if (/^0x[0-9a-f]{40}$/i.test(thing)){
				return "Address";
			}else{
				return "String";
			}
		break;
	}
	if (BigNumber.isBigNumber(thing)){
		return "BigNumber";
	}
	if (thing instanceof EthereumContractFunction || thing instanceof EthereumContractMultiFunction){
		return "EthereumFunc";
	}
	if (thing instanceof Uint8Array){
		return "Buffer";
	}
	if (thing instanceof Array){
		if (thing.length == 0){
			return "Array"+(findArrayType ? ":Empty" : "");
		}else{
			return "Array"+(findArrayType ? ":"+determineType(thing[0]) : "");
		}
		
	}
}


class EthereumContractFunction extends ExtensibleFunction {
	constructor(contract,abiIndex){
		let abiSnippet = contract._jsproperties.abi[abiIndex];
		if (abiSnippet.stateMutability === "pure" || abiSnippet.stateMutability === "view"){
			super((...args) => { // By using arrow functions, "this" becomes the function itself
				return this.contract._wrapperFuncRead(this._i, args, this.selectorHash);
			});
		}else{
			super((...args) => {
				return this.contract._wrapperFuncWrite(this._i, args, this.selectorHash);
			});
		}
		this.contract = contract;
		this._i = abiIndex;
		
		let types = [];
		let funcID = abiSnippet.name+"(";
		if (abiSnippet.inputs.length > 0){
			types[0] = abiSnippet.inputs[0].type;
			funcID += types[0];
		}
		for (let i = 1; i < abiSnippet.inputs.length; i += 1){
			types[i] = abiSnippet.inputs[i].type;
			funcID += ","+types[i];
		}
		funcID += ")";
		
		this.selector = funcID;
		this.selectorHash = "0x"+keccak256(funcID).substring(0,8);
		this.contract[this.selector] = this;
		this.contract[this.selectorHash] = this;
	}
	call(...args){
		return this.contract._wrapperFuncRead(this._i,args,this.selectorHash);
	}
	toString(){
		return "[EthereumContractFunction "+this.contract.address+"."+this.selector+"]";
	}
}

class EthereumContractMultiFunction extends ExtensibleFunction {
	constructor(contract,funcArgs,funcName){
		super(async (...args) => { // Even though no async operations are done here, thrown errors should still be rejected promises.
			let possible = [];
			let minVars = Number.POSITIVE_INFINITY;
			let maxVars = 0;
			
			// Please do know that I cringe looking at this. This really has to be improved.
			// First up we're going to use number of arguments. Because that's how I'd personally be using functions with the same name. (ERC223 transfer function for example.)
			for (let i = 0; i < funcArgs.length; i += 1){
				let argArray = funcArgs[i];
				if (args.length == argArray.length){
					possible.push(argArray);
				}
				// These 2 blocks are just here for debug purposes
				if (argArray.length < minVars){
					minVars = argArray.length;
				}
				if (argArray.length > maxVars){
					maxVars = argArray.length;
				}
			}
			if (possible.length == 0){
				throw new Error(contract.address+"."+funcName+": Expected amount of arguments to be "+minVars+" <= x <="+maxVars+", got "+args.length);
			}
			if (possible.length == 1){
				return possible[0]._f(...args);
			}
			let oldPossible = possible;
			possible = [];
			
			// Next up we'll actually consider argument types (but ignoring fixed length arrays)
			let argTypes = [];
			for (let i = 0; i < args.length; i += 1){
				if (args[i] == null){
					throw new Error(contract.address+"."+funcName+": null or undefined arguments are not allowed.");
				}
				argTypes[i] = determineType(args[i],true);
			}
			
			
			for (let i = 0; i < oldPossible.length; i += 1){
				let isPossible = true;
				for (let ii = 0; ii < args.length; ii += 1){
					let shortType = oldPossible[i][ii];
					let shortTypeIndex = shortType.indexOf(".");
					if (shortTypeIndex >= 0){
						let arrayTypeIndex = shortType.indexOf(":");
						if (arrayTypeIndex >= 0){
							shortType = shortType.substring(0,shortTypeIndex) + shortType.substring(arrayTypeIndex);
						}else{
							shortType = shortType.substring(0,shortTypeIndex);
						}
					}
					// Array:Null can only happen if the string is empty ()
					if (argTypes[ii] != shortType && !(argTypes[ii] == "Array:Empty" && shortType.substring(0,5) == "Array")){
						isPossible = false;
						break;
					}
				}
				if (isPossible){
					possible.push(oldPossible[i]);
				}
			}
			if (possible.length == 0){
				throw new Error(contract.address+"."+funcName+": Type mismatch."); // I really hate every time I write Something Happened™
			}
			if (possible.length == 1){
				return possible[0]._f(...args);
			}
			
			oldPossible = possible;
			possible = [];			
			
			// Now we'll check for functions that use fixed length arrays.
			// Most contracts shouldn't require us to get here, this is only here if this function can take fixed lengthed arrays with differing lengths.
			let anyPriority = false;
			for (let i = 0; i < oldPossible.length; i += 1){
				let isPossible = true;
				for (let ii = 0; ii < args.length; ii += 1){
					let fullType = oldPossible[i][ii];
					if (fullType.substring(0,5) != "Array" && fullType.substring(0,6) != "Buffer"){
						continue; // Ignore all non-length'd entities for this check
					}
					let shortTypeIndex = fullType.indexOf(".");
					if (shortTypeIndex >= 0){
						let arrayTypeIndex = fullType.indexOf(":"); // Yeah I don't know why I love strings either.
						let len;
						if (arrayTypeIndex >= 0){
							len = fullType.substring(shortTypeIndex+1,arrayTypeIndex) | 0;
						}else{
							len = fullType.substring(shortTypeIndex+1) | 0;
						}
						if (len == args[ii].length){
							oldPossible[i]._priority = true; // If the function name can accept a veriable length Array and a fixed length array, I want to prioritize the fixed length array.
							anyPriority = true;
						}else{
							isPossible = false;
						}
					}
					
				}
				if (isPossible){
					possible.push(oldPossible[i]);
				}
			}
			
			if (possible.length == 0){
				throw new Error(contract.address+"."+funcName+": Array length mismatch."); // I really hate every time I write Something Happened™
			}
			if (possible.length == 1){
				return possible[0]._f(...args);
			}
			oldPossible = possible;
			possible = [];	
			
			// Now we'll do the fixed vs dynamic array check before.
			if (anyPriority){
				for (let i = 0; i < oldPossible.length; i += 1){
					if (oldPossible[i]._priority){
						possible.push(oldPossible[i]);
					}
				}
				if (possible.length == 0){
					throw new Error(contract.address+"."+funcName+": This shouldn't happen? (There was and wasn't matching fixed length arrays at the same time.)");
				}
			}

			if (possible.length == 1){
				return possible[0]._f(...args);
			}
			throw new Error(contract.address+"."+funcName+": There are multiple functions with the same name; Unable to determine which function to use with the given arguments.");
			
		});
		this.contract = contract;
		this.name = funcName;
		for (let i = 0; i < funcArgs.length; i += 1){
			let argArray = funcArgs[i];
			argArray._f = new EthereumContractFunction(contract,argArray._i);
			argArray._n = contract._jsproperties.abiSelectors[argArray._i];
		}
	}
	toString(){
		return "[EthereumContractMultiFunction "+this.contract.address+"."+this.name+"]";
	}
}

class EthereumContractResult{
	constructor(args,abiSnippetoutputs){
		for (let i = 0; i < args.length; i += 1){
			let name = abiSnippetoutputs[i].name;
			if (name){
				this[name] = args[i];
			}
			this[i] = args[i];
		}
	}
}

class EthereumContract{
	constructor(connection,address,abi){
		let functionArgs = {};
		this._jsproperties = {
			abi,
			abiSelectors: [],
			connection,
			account: new EthereumAccount(connection,address)
		};
		this._account = this._jsproperties.account;
		this.address = this._jsproperties.account.address;
		
		// This will go through multiple iterations in order to make it easier to maintain.
		// First we figure out which JavaScript type the functions will accept.
		// Also, I'm fully aware of the absolutly ass performance this will have if there's loads of functions with the same name.
		for (let i = 0; i < abi.length; i += 1){
			let abiSnip = abi[i];
			if (abiSnip.type != "function"){
				continue;
			}
			let funcSelector = abiSnip.name+"("
			let args = [];
			args._i = i;
			for (let ii=0;ii<abiSnip.inputs.length;ii+=1){
				let type = abiSnip.inputs[ii].type;
				funcSelector += type+",";
				let iii = type.lastIndexOf("[");
				if (iii === -1){ // Not an array
					args[ii] = conversionChart[type];
					if (args[ii] == null){
						throw new Error("The ABI function \""+abiSnip.name+"\" has an unknown argument type: "+type);
					}
				}else{
					let arrayLength = type.substring(iii+1,type.length-1); // I'm assuming the last char is "]"
					let iv = type.indexOf("[");
					type = type.substring(0,iv);
					if (arrayLength === ""){
						args[ii] = "Array";
					}else{
						args[ii] = "Array."+arrayLength;
					}
					if (iii == iv){
						args[ii]+=":"+conversionChart[type];
					}else{
						args[ii]+=":Array"; // We're not going to look deeper than "Arrays of Arrays" (Hey if anyone wants to submit a PR go ahead.)
					}
				}
			}
			if (abiSnip.inputs.length > 0){
				funcSelector = funcSelector.substring(0,funcSelector.length-1);
			}
			this._jsproperties.abiSelectors[i] = funcSelector+")";
			
			if (functionArgs[abiSnip.name] == null){
				functionArgs[abiSnip.name] = [];
			}
			functionArgs[abiSnip.name].push(args);
		}
		this.event = new EthereumContractEventEmitter(this, abi);
		for (let funcName in functionArgs){
			let args = functionArgs[funcName];
			if (this[funcName] == null){
				if (args.length == 1){
					this[funcName] = new EthereumContractFunction(this,args[0]._i);
				}else{
					this[funcName] = new EthereumContractMultiFunction(this,args,funcName);
				}
			}
		}
		//console.log(this._jsproperties.abiSelectors);
	}
	async _wrapperFuncRead(index,args,selectorHash){
		const abiSnippet = this._jsproperties.abi[index];
		
		let options = args[0]; // Only a potential one at this point
		let finalOptions = {
			to:this._jsproperties.account.address
		};
		if (
			typeof options == "object" &&
			!(options instanceof Uint8Array) &&
			!(options instanceof Array) &&
			!(options instanceof EthereumContract) &&
			!(options instanceof EthereumAccount) &&
			!(BigNumber.isBigNumber(options))
			// !(options instanceof EthereumContractFunction) && // Removed because typeof (new ExtensibleFunction()) == "function"
			// !(options instanceof EthereumContractMultiFunction)
		){
			args.shift();
		}else{
			options = {};
		}
		if (abiSnippet.inputs.length !== args.length){
			throw new Error(this._jsproperties.account.address+"."+this._jsproperties.abiSelectors[index]+": Expected "+(abiSnippet.inputs.length)+" arguments, got "+args.length);
		}
		
		if (this._jsproperties.account.address == null){
			throw new Error(this._jsproperties.account.address+"."+this._jsproperties.abiSelectors[index]+": Contract address is null.");
		}
		
		
		
		if (options.from instanceof EthereumAccount){
			finalOptions.from = options.from.address;
		}else{
			if (options.from === undefined){
				let signingAccount = this._jsproperties.signer;
				if (signingAccount != null){
					finalOptions.from = signingAccount.address.toLowerCase();
				}
			}else{
				finalOptions.from = options.from;
			}
		}
		finalOptions.gas = options.gasLimit || options.gas;
		finalOptions.gasPrice = options.gasPrice;
		finalOptions.value = options.value;
		finalOptions.data = encode(args,abiSnippet,selectorHash);
		let rawData = await this._jsproperties.connection.call(finalOptions,options.blockNumber);
		//let rawData = await this._jsproperties.connection.estimateGas(finalOptions);
		
		if (rawData.substring(0,10) === "0x08c379a0" && (rawData.length%64) == 10){ //TODO: Improve this check somehow... if it can be improved. decodeString already does checking anyway
			try{
				throw new EthereumContractRevertError(decodeString(rawData.substring(10),0));
			}catch(ex){
				if (!(ex instanceof EthereumABIParseError)){
					throw ex;
				}
			}
		}
		//console.log(rawData);
		let returnValues = decode(rawData,abiSnippet);
		
		switch(returnValues.length){
			case 0:
				return;
			case 1:
				return returnValues[0];
			default:
				return new EthereumContractResult(returnValues,abiSnippet.outputs);
		}
	}
	async _wrapperFuncWrite(index,args,selectorHash){
		const abiSnippet = this._jsproperties.abi[index];
		
		let options = args[0]; // Only a potential one at this point
		let finalOptions = {
			to:this._jsproperties.account.address
		};
		if (
			typeof options == "object" &&
			!(options instanceof Uint8Array) &&
			!(options instanceof Array) &&
			!(options instanceof EthereumContract) &&
			!(options instanceof EthereumAccount) &&
			!(BigNumber.isBigNumber(options))
			// !(options instanceof EthereumContractFunction) && // Removed because typeof (new ExtensibleFunction()) == "function"
			// !(options instanceof EthereumContractMultiFunction)
		){
			args.shift();
		}else{
			options = {};
		}
		if (abiSnippet.inputs.length !== args.length){
			throw new Error(this._jsproperties.account.address+"."+this._jsproperties.abiSelectors[index]+": Expected "+(abiSnippet.inputs.length)+" arguments, got "+args.length);
		}
		
		if (this._jsproperties.account.address == null){
			throw new Error(this._jsproperties.account.address+"."+this._jsproperties.abiSelectors[index]+": Contract address is null.");
		}
		let signingAccount = options.from;
		if (signingAccount == null || !(signingAccount instanceof EthereumAccount)){
			signingAccount = this._jsproperties.signer;
		}
		if (signingAccount == null){
			throw new Error("The transaction needs to come from somewhere!");
		}


		finalOptions.gasLimit = options.gasLimit || options.gas;
		finalOptions.gasPrice = options.gasPrice;
		finalOptions.value = options.value;
		finalOptions.data = encode(args,abiSnippet,selectorHash);
		if (options.forceSend){
			if (finalOptions.gasLimit == null){
				throw new Error("You must specify a gas limit if you're forcing a transaction to be sent");
			}
		}else{
			const rawData = await this._jsproperties.connection.call({
				from: signingAccount.address,
				to: this.address,
				gas: finalOptions.gasLimit,
				gasPrice: finalOptions.gasPrice,
				value: finalOptions.value,
				data: finalOptions.data
			},options.blockNumber);
			if (rawData.substring(0,10) === "0x08c379a0" && (rawData.length%64) == 10){
				try{
					throw new EthereumContractRevertError(decodeString(rawData.substring(10),0));
				}catch(ex){
					if (!(ex instanceof EthereumABIParseError)){
						throw ex;
					}
				}
			}
		}
		return signingAccount.sendTransaction(finalOptions);
	}
	toString(){
		return "[EthereumContract "+this.address+"]";
	}
}

module.exports = {
	EthereumContractFunction,
	EthereumContractMultiFunction,
	EthereumContract,
	EthereumContractResult
}

