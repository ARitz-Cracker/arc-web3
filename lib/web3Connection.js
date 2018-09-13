
const {JSONRPCer} = require("../wrappers-node/jsonrpc.js");
const buffConvert = require("../wrappers-node/bufferconversion.js");

const BigNumber = require("bignumber.js");

let convertTo = {
	"String":buffConvert.stringToHex,
	"Bytes":buffConvert.bufferToHex,
	"Number":function(num){
		let str = num.toString(16);
		let ni = str.indexOf(".");
		if (ni >= 0){
			str = str.substring(0,ni);
		}
		return "0x"+str;
	},
	"HexString":function(str){
		return str;
	}
	/*,
	"Boolean":function(str){
		return str;
	}*/
	
}
convertTo.BigNumber = convertTo.Number;
convertTo["BigNumber or Number"] = convertTo.Number;
convertTo.Object = convertTo.HexString;

let convertFrom = {
	"String":buffConvert.hexToString,
	"Bytes":buffConvert.hexToBuffer,
	"Number":function(str){
		return str | 0;
	},
	"BigNumber":function(str){
		return new BigNumber(str);
	},
	"Whatever":function(str){
		return str;
	},
	"Boolean":function(str){
		return Boolean(str);// !== "0x0";
	}
}

let argumentCheck = {
	"HexString":function(v){
		return typeof v === "string" && v.substring(0,2) === "0x"; // TODO: have a better check for this
	},
	"String":function(v){
		return typeof v === "string";
	},
	"Number":function(v){
		return typeof v === "number";
	},
	"BigNumber":function(v){
		return BigNumber.isBigNumber(v);
	},
	"BigNumber or Number":function(v){
		return typeof v === "number" || BigNumber.isBigNumber(v);
	},
	"Bytes":function(v){
		return v instanceof Buffer;
	},
	"Boolean":function(v){
		return typeof v === "boolean";
	},
	"Object":function(v){
		return typeof v === "object";
	}
}

class Web3Connection{
	constructor(endpoint){
		if (endpoint.substring(0,8) !== "https://" && endpoint.substring(0,7) !== "http://"){
			throw new Error("Web3Connection.constructor: only http and https endpoints are supported right now");
		}
		this.endpoint = new JSONRPCer(endpoint);
		this.connectionType = 0; //0: http/1.1, 1: ws
	}
	async _wrapperFunc(data,...args){
		if (data.defaults == null){
			if (args.length !== data.args.length){
				throw new RangeError("Web3Connection."+data.func+": Expected "+data.args.length+" arguments, got "+args.length);
			}
			for (let i=0;i<args.length;i+=1){
				// TODO: Figure out if object type checking is a good idea.
				
				if (data.args[i] === "Object"){
					if (typeof args[i] !== "object"){
						throw new TypeError("Web3Connection."+data.func+": Argument #"+(i+1)+" is not an Object");
					}
					let ref = data.objectArgs[i];
					let result = {};
					for (let k in ref){
						let v = args[i][k];
						if (v != null){
							if (!argumentCheck[ref[k]](v)){
								throw new TypeError("Web3Connection."+data.func+": Argument (#"+(i+1)+")."+k+" is not a "+data.args[i]);
							}
							result[k] = convertTo[ref[k]](v);
						}

					}
					args[i] = result;
				}else{
				
					if (!argumentCheck[data.args[i]](args[i])){
						throw new TypeError("Web3Connection."+data.func+": Argument #"+(i+1)+" is not a "+data.args[i]);
					}
					args[i] = convertTo[data.args[i]](args[i]);
				}

			}
		}else{
			if (args.length > data.args.length){
				throw new RangeError("Web3Connection."+data.func+": Expected "+data.args.length+" arguments, got "+args.length);
			}
			for (let i=0;i<data.defaults.length;i+=1){
				if (args[i] == null){
					args[i] = data.defaults[i];
				}else if(data.args[i] === "Object"){
					if (typeof args[i] !== "object"){
						throw new TypeError("Web3Connection."+data.func+": Argument #"+(i+1)+" is not an Object");
					}
					let ref = data.objectArgs[i];
					let result = {};
					for (let k in ref){
						let v = args[i][k];
						if (v != null){
							if (!argumentCheck[ref[k]](v)){
								throw new TypeError("Web3Connection."+data.func+": Argument (#"+(i+1)+")."+k+" is not a "+ref[k]);
							}
							result[k] = convertTo[ref[k]](v);
						}
					}
					args[i] = result;
				
				}else if (argumentCheck[data.args[i]](args[i])){
					args[i] = convertTo[data.args[i]](args[i]);
				}else{
					throw new TypeError("Web3Connection."+data.func+": Argument #"+(i+1)+" is not a "+data.args[i]);
				}
			}
		}
		let result = await this.endpoint.doRequest(data.method,args);
		if (typeof result == "object" && data.returns !== "Whatever"){
			for (let k in data.objectReturns){
				let v = result[k];
				if (v == null){
					result[k] = null;
				}else{
					result[k] = convertFrom[data.objectReturns[k]](result[k]);
				}
			}
		}else{
			result = convertFrom[data.returns](result);
		}
		return result;
	}
	// TODO: Proper type checking for these convenience functions
	async getBlockTransactionCount(block){
		if (block == null){
			return this.getBlockTransactionCountByNumber();
		}else if (typeof block === "number"){
			return this.getBlockTransactionCountByNumber(block);
		}else{
			return this.getBlockTransactionCountByHash(block);
		}
	}
	async getUncleCount(block){
		if (block == null){
			return this.getUncleCountByBlockNumber();
		}else if (typeof block === "number"){
			return this.getUncleCountByBlockNumber(block);
		}else{
			return this.getUncleCountByBlockHash(block);
		}
	}
	async getBlock(block){
		if (block == null){
			return this.getBlockByNumber();
		}else if (typeof block === "number"){
			return this.getBlockByNumber(block);
		}else{
			return this.getBlockByHash(block);
		}
	}
	async getTransaction(blockOrTx,index){ 
		if (typeof index === "number"){
			if (typeof blockOrTx === "number"){
				return this.getTransactionByBlockNumberAndIndex(blockOrTx,index);
			}else{
				return this.getTransactionByBlockHashAndIndex(blockOrTx,index);
			}
		}else{
			return this.getTransactionByHash(blockOrTx);
		}
	}
	async getUncle(block,index){ 
		if (typeof blockOrTx === "number"){
			return this.getUncleByBlockHashAndIndex(block,index);
		}else{
			return this.getUncleByBlockNumberAndIndex(block,index);
		}
	}
}

// Why copy/paste functions when the computer can do it for you? :^)
let wrapperFuncs = [
	{
		func:"clientVersion",
		method:"web3_clientVersion",
		args:[],
		returns:"Whatever" // Already a UTF-8 string, no conversion needed
	},
	{
		func:"keccak256",
		method:"web3_sha3",
		args:["Bytes"],
		returns:"Bytes"
	},
	{
		func:"networkID",
		method:"net_version",
		args:[],
		returns:"Number"
	},
	{
		func:"networkListening",
		method:"net_listening",
		args:[],
		returns:"Boolean"
	},
	{
		func:"networkPeerCount",
		method:"net_peerCount",
		args:[],
		returns:"Number"
	},
	{
		func:"protocolVersion",
		method:"eth_protocolVersion",
		args:[],
		returns:"Number"
	},
	{
		func:"isSyncing",
		method:"eth_syncing",
		args:[],
		returns:"Boolean",
		objectReturns:{
			startingBlock:"Number",
			currentBlock:"Number",
			highestBlock:"Number"
		}
	},
	{
		func:"coinbase",
		method:"eth_coinbase",
		args:[],
		returns:"Whatever"
	},
	{
		func:"isMining",
		method:"eth_mining",
		args:[],
		returns:"Boolean"
	},
	{
		func:"hashrate",
		method:"eth_hashrate",
		args:[],
		returns:"BigNumber"
	},
	{
		func:"gasPrice",
		method:"eth_gasPrice",
		args:[],
		returns:"BigNumber"
	},
	/*
	// This library is intended to use accounts stored locally, _not_ on the remote node.
	{
		func:"accounts",
		method:"eth_accounts",
		args:[],
		returns:"BigNumber"
	},
	*/
	{
		func:"blockNumber",
		method:"eth_blockNumber",
		args:[],
		returns:"Number"
	},
	{
		func:"getBalance",
		method:"eth_getBalance",
		args:["HexString","Number"], // TODO: Allow for Number or String so we can select "latest", "earliest" or "pending"
		defaults:[,"latest"],
		returns:"BigNumber"
	},
	// I have no idea what this is used for, if I was going to get a public variable from a contract, I'd use the getter function.
	{
		func:"getStorageAt",
		method:"eth_getStorageAt",
		args:["HexString","BigNumber","Number"], // TODO: Allow for Number or String so we can select "latest", "earliest" or "pending"
		defaults:[,,"latest"],
		returns:"Bytes"
	},
	{
		func:"getTransactionCount",
		method:"eth_getTransactionCount",
		args:["HexString","Number"], // TODO: Allow for Number or String so we can select "latest", "earliest" or "pending"
		defaults:[,"latest"],
		returns:"BigNumber"
	},
	{
		func:"getBlockTransactionCountByHash",
		method:"eth_getBlockTransactionCountByHash",
		args:["HexString"],
		returns:"BigNumber"
	},
	{
		func:"getBlockTransactionCountByNumber",
		method:"eth_getBlockTransactionCountByNumber",
		args:["Number"],
		defaults:["latest"],
		returns:"BigNumber"
	},
	{
		func:"getUncleCountByBlockHash",
		method:"eth_getUncleCountByBlockHash",
		args:["HexString"],
		returns:"BigNumber"
	},
	{
		func:"getUncleCountByBlockNumber",
		method:"eth_getUncleCountByBlockNumber",
		args:["Number"],
		defaults:["latest"],
		returns:"BigNumber"
	},
	{
		func:"getCode",
		method:"eth_getCode",
		args:["HexString","Number"],
		defaults:[,"latest"],
		returns:"Bytes"
	},
	{
		func:"sendRawTransaction",
		method:"eth_sendRawTransaction",
		args:["Bytes"],
		returns:"Whatever" // actually a HexString
	},
	/*
	// This library is intended to use accounts stored locally, _not_ on the remote node.
	{
		func:"sign",
		method:"eth_sign",
		args:["HexString","Bytes"],
		defaults:[,"latest"],
		returns:"Bytes"
	},
	// same goes for eth_sendTransaction
	*/
	// TODO: Implement eth_call and eth_estimateGas
	{
		func:"call",
		method:"eth_call",
		args:["Object","Number"],
		objectArgs:[{
			from:"HexString",
			to:"HexString",
			gas:"Number",
			gasPrice:"BigNumber",
			value:"BigNumber",
			data:"HexString"
		}],
		defaults:[,"latest"],
		returns:"Whatever" // actually a HexString
	},
	{
		func:"estimateGas",
		method:"eth_estimateGas",
		args:["Object"],
		objectArgs:[{
			from:"HexString",
			to:"HexString",
			gas:"Number",
			gasPrice:"BigNumber",
			value:"BigNumber",
			data:"HexString"
		}],
		defaults:[],
		returns:"Whatever" // actually a HexString
	},
	{
		func:"getBlockByHash",
		method:"eth_getBlockByHash",
		args:["HexString"],
		defaults:[,false],
		returns:"Object",
		objectReturns:{
			number:"Number",
			hash:"Whatever", // actually a HexString
			parentHash:"Whatever", // actually a HexString
			nonce:"Whatever", // actually a HexString
			sha3Uncles:"Whatever", // actually a HexString
			logsBloom:"Whatever", // actually a HexString
			transactionsRoot:"Whatever", // actually a HexString
			stateRoot:"Whatever", // actually a HexString
			miner:"Whatever", // actually a HexString (address?)
			difficulty:"BigNumber",
			totalDifficulty:"BigNumber",
			extraData:"Bytes", 
			// These numbers probably should be BigNumbers in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size:"Number",
			gasLimit:"Number",
			gasUsed:"Number",
			
			timestamp:"Number", // Should I convert this to a date object?
			transactions:"Whatever", // Array of HexStrings
			uncles:"Whatever" // Array of HexStrings
		}
	},
	{
		func:"getBlockByNumber",
		method:"eth_getBlockByNumber",
		args:["Number"],
		defaults:["latest",false],
		returns:"Object",
		objectReturns:{ // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			number:"Number",
			hash:"Whatever", // actually a HexString
			parentHash:"Whatever", // actually a HexString
			nonce:"Whatever", // actually a HexString
			sha3Uncles:"Whatever", // actually a HexString
			logsBloom:"Whatever", // actually a HexString
			transactionsRoot:"Whatever", // actually a HexString
			stateRoot:"Whatever", // actually a HexString
			miner:"Whatever", // actually a HexString (address?)
			difficulty:"BigNumber",
			totalDifficulty:"BigNumber",
			extraData:"Bytes", 
			// These numbers probably should be BigNumbers in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size:"Number",
			gasLimit:"Number",
			gasUsed:"Number",
			
			timestamp:"Number", // Should I convert this to a date object?
			transactions:"Whatever", // Array of HexStrings
			uncles:"Whatever" // Array of HexStrings
		}
	},
	{
		func:"getTransactionByHash",
		method:"eth_getTransactionByHash",
		args:["HexString"],
		returns:"Object",
		objectReturns:{
			hash:"Whatever", // actually a HexString
			nonce:"Number", // If anyone opens a issue linked to an address which has a nonce of 9,007,199,254,740,991 I will change this to a BigNumber
			blockHash:"Whatever", // actually a HexString
			blockNumber:"Number", // Can be null if it's pending
			transactionIndex:"Number", // I doubt 9,007,199,254,740,991 transactions can be allowed in a block. (Unless sharding??)
			from:"Whatever", // actually an AddressString
			to:"Whatever", // actually an AddressString
			value:"BigNumber",
			gas:"Number",
			gasPrice:"BigNumber",
			input:"Bytes"
		}
	},
	{
		func:"getTransactionByBlockHashAndIndex",
		method:"eth_getTransactionByBlockHashAndIndex",
		args:["HexString","Number"],
		returns:"Object",
		objectReturns:{ // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			hash:"Whatever", // actually a HexString
			nonce:"Number", // If anyone opens a issue linked to an address which has a nonce of 9,007,199,254,740,991 I will change this to a BigNumber
			blockHash:"Whatever", // actually a HexString
			blockNumber:"Number", // Can be null if it's pending
			transactionIndex:"Number", // I doubt 9,007,199,254,740,991 transactions can be allowed in a block. (Unless sharding??)
			from:"Whatever", // actually an AddressString
			to:"Whatever", // actually an AddressString
			value:"BigNumber",
			gas:"Number",
			gasPrice:"BigNumber",
			input:"Bytes"
		}
	},
	{
		func:"getTransactionByBlockNumberAndIndex",
		method:"eth_getTransactionByBlockNumberAndIndex",
		args:["Number","Number"],
		returns:"Object",
		objectReturns:{ // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			hash:"Whatever", // actually a HexString
			nonce:"Number", // If anyone opens a issue linked to an address which has a nonce of 9,007,199,254,740,991 I will change this to a BigNumber
			blockHash:"Whatever", // actually a HexString
			blockNumber:"Number", // Can be null if it's pending
			transactionIndex:"Number", // I doubt 9,007,199,254,740,991 transactions can be allowed in a block. (Unless sharding??)
			from:"Whatever", // actually an AddressString
			to:"Whatever", // actually an AddressString
			value:"BigNumber",
			gas:"Number",
			gasPrice:"BigNumber",
			input:"Bytes"
		}
	},
	{
		func:"getTransactionReceipt",
		method:"eth_getTransactionReceipt",
		args:["HexString"],
		returns:"Object",
		objectReturns:{
			transactionHash:"Whatever", // actually a HexString
			transactionIndex:"Number",
			blockHash:"Whatever", // actually a HexString
			blockNumber:"Number",
			from:"Whatever", // actually an AddressString
			to:"Whatever", // actually an AddressString
			cumulativeGasUsed:"Number",
			gasUsed:"Number",
			contractAddress:"Whatever",
			logs:"Whatever", // Array of log objects, which this transaction generated.
			logsBloom:"Bytes", // "256 Bytes - Bloom filter for light clients to quickly retrieve related logs."
			status:"Number" // either 1 (success) or 0 (failure) (Should I make this a boolean?)
		}
	},
	{
		func:"getUncleByBlockHashAndIndex",
		method:"eth_getUncleByBlockHashAndIndex",
		args:["HexString","Number"],
		returns:"Object",
		objectReturns:{ // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			number:"Number",
			hash:"Whatever", // actually a HexString
			parentHash:"Whatever", // actually a HexString
			nonce:"Whatever", // actually a HexString
			sha3Uncles:"Whatever", // actually a HexString
			logsBloom:"Whatever", // actually a HexString
			transactionsRoot:"Whatever", // actually a HexString
			stateRoot:"Whatever", // actually a HexString
			miner:"Whatever", // actually a HexString (address?)
			difficulty:"BigNumber",
			totalDifficulty:"BigNumber",
			extraData:"Bytes", 
			// These numbers probably should be BigNumbers in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size:"Number",
			gasLimit:"Number",
			gasUsed:"Number",
			
			timestamp:"Number", // Should I convert this to a date object?
			transactions:"Whatever", // Array of HexStrings
			uncles:"Whatever" // Array of HexStrings
		}
	},
	{
		func:"getUncleByBlockNumberAndIndex",
		method:"eth_getUncleByBlockNumberAndIndex",
		args:["Number","Number"],
		returns:"Object",
		objectReturns:{ // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			number:"Number",
			hash:"Whatever", // actually a HexString
			parentHash:"Whatever", // actually a HexString
			nonce:"Whatever", // actually a HexString
			sha3Uncles:"Whatever", // actually a HexString
			logsBloom:"Whatever", // actually a HexString
			transactionsRoot:"Whatever", // actually a HexString
			stateRoot:"Whatever", // actually a HexString
			miner:"Whatever", // actually a HexString (address?)
			difficulty:"BigNumber",
			totalDifficulty:"BigNumber",
			extraData:"Bytes", 
			// These numbers probably should be BigNumbers in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size:"Number",
			gasLimit:"Number",
			gasUsed:"Number",
			
			timestamp:"Number", // Should I convert this to a date object?
			transactions:"Whatever", // Array of HexStrings
			uncles:"Whatever" // Array of HexStrings
		}
	},
	// TODO: eth_newFilter, eth_newBlockFilter, eth_newPendingTransactionFilter, eth_uninstallFilter, eth_getFilterChanges, eth_getFilterLogs are unimplimented
	// Though I don't think that's very useful unless we're using websocket.
	{
		func:"getLogs",
		method:"eth_getLogs",
		args:["Object"],
		objectArgs:[{
			fromBlock:"Number",
			toBlock:"Number",
			address:"HexString",
			topics:"Object", // Array of 32 Bytes DATA topics. Topics are order-dependent. Each topic can also be an array of DATA with "or" options.
			blockhash:"HexString"
		}],
		returns:"Whatever" // This will be processed by the contract object
	},
	{
		func:"getWork",
		method:"eth_getWork",
		args:[],
		returns:"Object",
		objectReturns:["Bytes","Bytes","Bytes"]
	},
	{
		func:"submitWork",
		method:"eth_submitWork",
		args:["Bytes","Bytes","Bytes"],
		returns:"Boolean"
	},
	{
		func:"submitHashrate",
		method:"eth_submitHashrate",
		args:["Bytes","Bytes"],
		returns:"Boolean"
	}
];

for (let i=0;i<wrapperFuncs.length;i+=1){
	let data = wrapperFuncs[i];
	// Is this gross or ingenious? 🤔
	Web3Connection.prototype[data.func] = function(...args){
		return this._wrapperFunc(data,...args);
	}
}
delete wrapperFuncs;

module.exports = {
	Web3Connection
}