
const {HTTPJSONRPCer} = require("../wrappers/jsonrpc_http");
const {WSJSONRPCer} = require("../wrappers/jsonrpc_ws");
const {EthereumProdiderRPCer} = require("../wrappers/jsonrpc_ethereum_provider");
const {toChecksumAddress, isValidAddress} = require("./ethAddressChecksum");
const {decodeString} = require("./ABIDecoder");
const {EthereumContractRevertError, EthereumABIParseError} = require("./errors");

const convertTo = {
	String(str){
		return "0x" + Buffer.from(str).toString("hex");
	},
	Bytes(buff){
		if(!Buffer.isBuffer(buff)){
			buff = Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength);
		}
		return "0x" + buff.toString("hex");
	},
	Number(num){
		let str = num.toString(16);
		const ni = str.indexOf(".");
		if(ni >= 0){
			str = str.substring(0, ni);
		}
		return "0x" + str;
	},
	HexString(str){
		return str;
	},
	Address(str){
		return str.toLowerCase();
	}
	/* ,
	"Boolean":function(str){
		return str;
	}*/

};
convertTo.BigInt = convertTo.Number;
convertTo["BigInt or Number"] = convertTo.Number;
convertTo.Object = convertTo.HexString;
convertTo.Whatever = convertTo.Object;

const convertFrom = {
	String(str){
		return Buffer.from(str.substring(2), "hex").toString("utf8");
	},
	Bytes(str){
		return Buffer.from(str.substring(2), "hex");
	},
	Number(str){
		return parseInt(str);
	},
	BigInt(str){
		return BigInt(str);
	},
	Whatever(str){
		return str;
	},
	Boolean(str){
		return Boolean(str);// !== "0x0";
	},
	Address(str){
		return toChecksumAddress(str);
	}
};

const argumentCheck = {
	HexString(v){
		return typeof v === "string" && /^0x[0-9a-f]*$/i.test(v);
	},
	String(v){
		return typeof v === "string";
	},
	Number(v){
		return typeof v === "number";
	},
	BigInt(v){
		return typeof v === "bigint";
	},
	"BigInt or Number"(v){
		return typeof v === "number" || typeof v === "bigint";
	},
	Bytes(v){
		return v instanceof Uint8Array;
	},
	Boolean(v){
		return typeof v === "boolean";
	},
	Object(v){
		return typeof v === "object";
	},
	Array(v){
		return Array.isArray(v);
	},
	Address(v){
		return isValidAddress(v, true);
	},
	Whatever(){
		return true;
	}
};
const decodeLogObject = function(obj){
	if(obj.logIndex != null){
		obj.logIndex = convertFrom.Number(obj.logIndex);
	}
	if(obj.transactionIndex != null){
		obj.transactionIndex = convertFrom.Number(obj.transactionIndex);
	}
	if(obj.blockNumber != null){
		obj.blockNumber = convertFrom.Number(obj.blockNumber);
	}
	obj.address = toChecksumAddress(obj.address);
	return obj;
};

class Web3Connection {
	constructor(endpoint){
		if(typeof endpoint === "object"){
			this.endpoint = new EthereumProdiderRPCer(endpoint);
			this.connectionType = 3;
		}else if(typeof endpoint !== "string"){
			throw new Error("Endpoint must be a string or object");
		}else if(endpoint.substring(0, 8) == "https://" || endpoint.substring(0, 7) == "http://"){
			this.endpoint = new HTTPJSONRPCer(endpoint);
			this.connectionType = 0;
		}else if(endpoint.substring(0, 6) == "wss://" || endpoint.substring(0, 5) == "ws://"){
			this.endpoint = new WSJSONRPCer(endpoint);
			this.connectionType = 1;
		}else{
			throw new Error("Unknown protocol or protocol wasn't specified");
		}
		this._promisedTransactions = {};
		this._filters = {};
		this._badFilterCallbacks = {};
	}
	closeConnection(){
		if(this.connectionType == 1){
			this.endpoint.closeConnection();
		}
		this._dead = true;
		clearTimeout(this._tickTimeout);
	}
	async _tick(){
		if(this._ticking){
			return;
		}
		this._ticking = true;
		const startTime = Date.now();
		const oldBlockNumber = this.currentBlockNumber;
		let currentBlockNumber;
		while(currentBlockNumber === undefined && !this._dead){
			try{
				currentBlockNumber = await this.blockNumber();
			}catch(ex){
				// Just keep trying until it happens.
				await new Promise(resolve => {
					setTimeout(resolve, 1000);
				});
				console.error("Web3Connection: Failed to get block", ex.stack);
			}
		}
		if(this._dead){
			return;
		}
		this.currentBlockNumber = currentBlockNumber;
		// Number(undefined) === NaN; So this block won't run if oldBlockNumber === undefined
		if(oldBlockNumber < currentBlockNumber){
			const promises = [];
			// Note: I'm not using Promise.all(Object.keys(stuff).map because the property can get deleted while I'm looping
			for(const id in this._filters){
				const filter = this._filters[id];
				promises.push(
					(async() => {
						for(let i = oldBlockNumber + 1; i <= currentBlockNumber; i += 1){
							let events;
							while(events === undefined && !this._dead){
								try{
									events = await this.getLogs({
										fromBlock: i,
										toBlock: i,
										address: filter.address,
										topics: filter.topics
									});
								}catch(ex){
									// Just keep trying until it happens.
									console.error("Web3Connection: Failed to get events", ex.stack);
									await new Promise(resolve => {
										setTimeout(resolve, 1000);
									});
								}
							}
							if(this._dead){
								return;
							}
							const _events = events;
							await Promise.all(filter.callbacks.map(callback => (async() => {
								for(let ii = 0; ii < _events.length; ii += 1){
									try{
										await callback(decodeLogObject(_events[ii]));
									}catch(ex){
										console.error("You've got an unhandled error in your Ethereum event callback!");
										console.error(ex.stack);
									}
								}
							})()));
						}
					})()
				);
			}
			await Promise.all(promises);
		}
		await Promise.all(Object.keys(this._promisedTransactions).map(txHash => (async() => {
			const txData = await this.getTransactionReceipt(txHash);
			if(txData != null && this._promisedTransactions[txHash] !== undefined){
				if(txData.status === 1){
					this._promisedTransactions[txHash].resolve(txData);
				}else if(txData.status === 0){
					const submittedTx = await this.getTransaction(txHash);
					try{
						const rawData = await this.call({
							from: submittedTx.from,
							to: submittedTx.to,
							gas: submittedTx.gas,
							gasPrice: submittedTx.gasPrice,
							value: submittedTx.value,
							data: submittedTx.input
						}, txData.blockNumber);
						if(rawData.substring(0, 10) === "0x08c379a0" && (rawData.length % 64) == 10){
							try{
								throw new EthereumContractRevertError(decodeString(rawData.substring(10), 0));
							}catch(ex){
								if(!(ex instanceof EthereumABIParseError)){
									throw ex;
								}
							}
						}
						throw new EthereumContractRevertError("No reason given (Maybe not enough gas)");
					}catch(ex){
						this._promisedTransactions[txHash].reject(ex);
					}
				}else{
					this._promisedTransactions[txHash].reject(new EthereumContractRevertError("Transaction has unknown status (" + txData.status + ")"));
				}
				delete this._promisedTransactions[txHash];
			}
		})()));

		const timeoutTime = 6500 - (Date.now() - startTime);
		if(timeoutTime < 0){
			this._ticking = false;
			this._tick();
		}else{
			this._tickTimeout = setTimeout(() => {
				this._ticking = false;
				this._tick();
			}, timeoutTime);
		}
	}
	async transactionConfirmed(txHash){
		txHash = await txHash;
		if(this._promisedTransactions[txHash] === undefined){
			let pResolve;
			let pReject;
			const p = new Promise((resolve, reject) => {
				pResolve = resolve;
				pReject = reject;
			});
			p.resolve = pResolve; // This really should be standard.
			p.reject = pReject;
			this._promisedTransactions[txHash] = p;
		}
		this._tick();
		return this._promisedTransactions[txHash];
	}
	ignoreTransactionConfirmed(txHash){
		delete this._promisedTransactions[txHash];
	}
	switchTransactionConfirmed(oldTxHash, newTxHash){
		const promise = this.transactionConfirmed(newTxHash);
		if(this._promisedTransactions[oldTxHash] !== undefined){
			this._promisedTransactions[oldTxHash].resolve(promise);
			delete this._promisedTransactions[oldTxHash];
		}
		return promise;
	}
	unlisten(address, topics, callback){
		let id = JSON.stringify(topics);
		if(address != null){
			address = address.toLowerCase();
			id += address;
		}
		const i = this._filters[id].callbacks.indexOf(callback);
		if(i === -1){
			this._badFilterCallbacks[id].push(callback);
		}else{
			this._filters[id].callbacks.splice(i, 1);
		}
	}
	async listen(address, topics, fromBlock, toBlock, callback){
		let continuous;
		let id = JSON.stringify(topics);
		if(address != null){
			id += address;
		}
		if(this._badFilterCallbacks[id] === undefined){
			this._badFilterCallbacks[id] = [];
		}
		if(this._filters[id] === undefined){
			this._filters[id] = {
				topics,
				address,
				callbacks: []
			};
		}
		if(this._badFilterCallbacks[id].indexOf(callback) !== -1){
			this._badFilterCallbacks[id].splice(this._badFilterCallbacks[id].indexOf(callback));
		}
		if(this._filters[id].callbacks.indexOf(callback) !== -1){
			return;
		}

		if(fromBlock == null){
			continuous = true;
			toBlock = null;
		}else{
			fromBlock |= 0;
			if(toBlock == null){
				continuous = true;
				toBlock = this.currentBlockNumber;
			}
			for(let i = fromBlock; i <= toBlock; i += 1){
				while(toBlock > this.currentBlockNumber){
					await new Promise(resolve => {
						setTimeout(resolve, 7000);
					});
				}
				const events = await this.getLogs({address, topics, fromBlock: i, toBlock: i});
				for(let ii = 0; ii < events.length; ii += 1){
					try{
						if(this._badFilterCallbacks[id].indexOf(callback) === -1){
							break;
						}
						await callback(decodeLogObject(events[ii]));
					}catch(ex){
						console.error("You've got an unhandled error in your Ethereum event callback!");
						console.error(ex.stack);
					}
				}
			}
		}
		if(continuous){
			if(toBlock != null){
				for(let i = toBlock; i <= this.currentBlockNumber; i += 1){
					const events = await this.getLogs({address, topics, fromBlock: i, toBlock: i});
					for(let ii = 0; ii < events.length; ii += 1){
						try{
							if(this._badFilterCallbacks[id].indexOf(callback) === -1){
								break;
							}
							await callback(decodeLogObject(events[ii]));
						}catch(ex){
							console.error("You've got an unhandled error in your Ethereum event callback!");
							console.error(ex.stack);
						}
					}
				}
			}
			const i = this._badFilterCallbacks[id].indexOf(callback);
			if(i === -1){
				this._filters[id].callbacks.push(callback);
			}else{
				this._badFilterCallbacks[id].splice(i, 1);
			}
		}
		this._tick();
	}
	async _wrapperFunc(data, ...args){
		if(data.defaults == null){
			if(args.length !== data.args.length){
				throw new RangeError("Web3Connection." + data.func + ": Expected " + data.args.length + " arguments, got " + args.length);
			}
			for(let i = 0; i < args.length; i += 1){
				// TODO: Figure out if object type checking is a good idea.

				if(data.args[i] === "Object"){
					if(typeof args[i] !== "object"){
						throw new TypeError("Web3Connection." + data.func + ": Argument #" + (i + 1) + " is not an Object");
					}
					const ref = data.objectArgs[i];
					const result = {};
					for(const k in ref){
						const v = args[i][k];
						if(v != null){
							if(!argumentCheck[ref[k]](v)){
								throw new TypeError("Web3Connection." + data.func + ": Argument (#" + (i + 1) + ")." + k + " is not a " + ref[k]);
							}
							result[k] = convertTo[ref[k]](v);
						}
					}
					args[i] = result;
				}else{
					if(!argumentCheck[data.args[i]](args[i])){
						throw new TypeError("Web3Connection." + data.func + ": Argument #" + (i + 1) + " is not a " + data.args[i]);
					}
					args[i] = convertTo[data.args[i]](args[i]);
				}
			}
		}else{
			if(args.length > data.args.length){
				throw new RangeError("Web3Connection." + data.func + ": Expected " + data.args.length + " arguments, got " + args.length);
			}
			for(let i = 0; i < data.defaults.length; i += 1){
				if(args[i] == null){
					args[i] = data.defaults[i];
				}else if(data.args[i] === "Object"){
					if(typeof args[i] !== "object"){
						throw new TypeError("Web3Connection." + data.func + ": Argument #" + (i + 1) + " is not an Object");
					}
					const ref = data.objectArgs[i];
					const result = {};
					for(const k in ref){
						const v = args[i][k];
						if(v != null){
							if(!argumentCheck[ref[k]](v)){
								throw new TypeError("Web3Connection." + data.func + ": Argument (#" + (i + 1) + ")." + k + " is not a " + ref[k]);
							}
							result[k] = convertTo[ref[k]](v);
						}
					}
					args[i] = result;
				}else if(argumentCheck[data.args[i]](args[i])){
					args[i] = convertTo[data.args[i]](args[i]);
				}else{
					throw new TypeError("Web3Connection." + data.func + ": Argument #" + (i + 1) + " is not a " + data.args[i]);
				}
			}
		}
		let result = await this.endpoint.doRequest(data.method, args);
		if(result != null){
			if(typeof result == "object" && data.returns !== "Whatever"){
				for(const k in data.objectReturns){
					const v = result[k];
					if(v == null){
						result[k] = null;
					}else{
						result[k] = convertFrom[data.objectReturns[k]](result[k]);
					}
				}
			}else{
				result = convertFrom[data.returns](result);
			}
		}
		return result;
	}
	// TODO: Proper type checking for these convenience functions
	getBlockTransactionCount(block){
		if(block == null){
			return this.getBlockTransactionCountByNumber();
		}else if(typeof block === "number"){
			return this.getBlockTransactionCountByNumber(block);
		}
		return this.getBlockTransactionCountByHash(block);
	}
	getUncleCount(block){
		if(block == null){
			return this.getUncleCountByBlockNumber();
		}else if(typeof block === "number"){
			return this.getUncleCountByBlockNumber(block);
		}
		return this.getUncleCountByBlockHash(block);
	}
	getBlock(block){
		if(block == null){
			return this.getBlockByNumber();
		}else if(typeof block === "number"){
			return this.getBlockByNumber(block);
		}
		return this.getBlockByHash(block);
	}
	getTransaction(blockOrTx, index){
		if(typeof index === "number"){
			if(typeof blockOrTx === "number"){
				return this.getTransactionByBlockNumberAndIndex(blockOrTx, index);
			}
			return this.getTransactionByBlockHashAndIndex(blockOrTx, index);
		}
		return this.getTransactionByHash(blockOrTx);
	}
	getUncle(block, index){
		if(typeof blockOrTx === "number"){
			return this.getUncleByBlockHashAndIndex(block, index);
		}
		return this.getUncleByBlockNumberAndIndex(block, index);
	}
	async getAccounts(){
		return (await this.getChecksumlessAccounts()).map(address => toChecksumAddress(address));
	}
}

// Why copy/paste functions when the computer can do it for you? :^)
const wrapperFuncs = [
	{
		func: "clientVersion",
		method: "web3_clientVersion",
		args: [],
		returns: "Whatever" // Already a UTF-8 string, no conversion needed
	},
	{
		func: "keccak256",
		method: "web3_sha3",
		args: ["Bytes"],
		returns: "Bytes"
	},
	{
		func: "networkID",
		method: "net_version",
		args: [],
		returns: "Number"
	},
	{
		func: "networkListening",
		method: "net_listening",
		args: [],
		returns: "Boolean"
	},
	{
		func: "networkPeerCount",
		method: "net_peerCount",
		args: [],
		returns: "Number"
	},
	{
		func: "protocolVersion",
		method: "eth_protocolVersion",
		args: [],
		returns: "Number"
	},
	{
		func: "isSyncing",
		method: "eth_syncing",
		args: [],
		returns: "Boolean",
		objectReturns: {
			startingBlock: "Number",
			currentBlock: "Number",
			highestBlock: "Number"
		}
	},
	{
		func: "coinbase",
		method: "eth_coinbase",
		args: [],
		returns: "Whatever"
	},
	{
		func: "isMining",
		method: "eth_mining",
		args: [],
		returns: "Boolean"
	},
	{
		func: "hashrate",
		method: "eth_hashrate",
		args: [],
		returns: "BigInt"
	},
	{
		func: "gasPrice",
		method: "eth_gasPrice",
		args: [],
		returns: "BigInt"
	},
	{
		func: "getChecksumlessAccounts",
		method: "eth_accounts",
		args: [],
		returns: "Whatever" // Array of HexStrings
	},
	{
		func: "blockNumber",
		method: "eth_blockNumber",
		args: [],
		returns: "Number"
	},
	{
		func: "getBalance",
		method: "eth_getBalance",
		args: ["Address", "Number"], // TODO: Allow for Number or String so we can select "latest", "earliest" or "pending"
		defaults: [undefined, "latest"],
		returns: "BigInt"
	},
	// I have no idea what this is used for, if I was going to get a public variable from a contract, I'd use the getter function.
	{
		func: "getStorageAt",
		method: "eth_getStorageAt",
		args: ["Address", "BigInt", "Number"], // TODO: Allow for Number or String so we can select "latest", "earliest" or "pending"
		defaults: [undefined, undefined, "latest"],
		returns: "Bytes"
	},
	{
		func: "getTransactionCount",
		method: "eth_getTransactionCount",
		args: ["Address", "Number"], // TODO: Allow for Number or String so we can select "latest", "earliest" or "pending"
		defaults: [undefined, "latest"],
		returns: "Number" // If anyone opens a issue linked to an address which has a nonce of 9,007,199,254,740,991 I will change this to a BigInt
	},
	{
		func: "getBlockTransactionCountByHash",
		method: "eth_getBlockTransactionCountByHash",
		args: ["HexString"],
		returns: "BigInt"
	},
	{
		func: "getBlockTransactionCountByNumber",
		method: "eth_getBlockTransactionCountByNumber",
		args: ["Number"],
		defaults: ["latest"],
		returns: "BigInt"
	},
	{
		func: "getUncleCountByBlockHash",
		method: "eth_getUncleCountByBlockHash",
		args: ["HexString"],
		returns: "BigInt"
	},
	{
		func: "getUncleCountByBlockNumber",
		method: "eth_getUncleCountByBlockNumber",
		args: ["Number"],
		defaults: ["latest"],
		returns: "BigInt"
	},
	{
		func: "getCode",
		method: "eth_getCode",
		args: ["HexString", "Number"],
		defaults: [undefined, "latest"],
		returns: "Bytes"
	},
	{
		func: "sendRawTransaction",
		method: "eth_sendRawTransaction",
		args: ["Bytes"],
		returns: "Whatever" // actually a HexString
	},
	{
		func: "sendTransaction",
		method: "eth_sendTransaction",
		args: ["Object"],
		objectArgs: [
			{
				from: "HexString",
				to: "HexString",
				gas: "Number",
				gasPrice: "BigInt",
				value: "BigInt",
				data: "HexString",
				nonce: "Number"
			}
		],
		returns: "Whatever" // actually a HexString
	},
	{
		func: "sign",
		method: "eth_sign",
		args: ["HexString", "Bytes"],
		defaults: [undefined, "latest"],
		returns: "Bytes"
	},
	{
		func: "call",
		method: "eth_call",
		args: ["Object", "Number"],
		objectArgs: [
			{
				from: "HexString",
				to: "HexString",
				gas: "Number",
				gasPrice: "BigInt",
				value: "BigInt",
				data: "HexString"
			}
		],
		defaults: [undefined, "latest"],
		returns: "Whatever" // actually a HexString
	},
	{
		func: "estimateGas",
		method: "eth_estimateGas",
		args: ["Object"],
		objectArgs: [
			{
				from: "HexString",
				to: "HexString",
				gas: "Number",
				gasPrice: "BigInt",
				value: "BigInt",
				data: "HexString"
			}
		],
		returns: "Number"
	},
	{
		func: "getBlockByHash",
		method: "eth_getBlockByHash",
		args: ["HexString"],
		defaults: [undefined, false],
		returns: "Object",
		objectReturns: {
			number: "Number",
			hash: "Whatever", // actually a HexString
			parentHash: "Whatever", // actually a HexString
			nonce: "Whatever", // actually a HexString
			sha3Uncles: "Whatever", // actually a HexString
			logsBloom: "Whatever", // actually a HexString
			transactionsRoot: "Whatever", // actually a HexString
			stateRoot: "Whatever", // actually a HexString
			miner: "Address", // actually a HexString (address?)
			difficulty: "BigInt",
			totalDifficulty: "BigInt",
			extraData: "Bytes",
			// These numbers probably should be BigInts in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size: "Number",
			gasLimit: "Number",
			gasUsed: "Number",

			timestamp: "Number", // Should I convert this to a date object?
			transactions: "Whatever", // Array of HexStrings
			uncles: "Whatever" // Array of HexStrings
		}
	},
	{
		func: "getBlockByNumber",
		method: "eth_getBlockByNumber",
		args: ["Number"],
		defaults: ["latest", false],
		returns: "Object",
		objectReturns: { // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			number: "Number",
			hash: "Whatever", // actually a HexString
			parentHash: "Whatever", // actually a HexString
			nonce: "Whatever", // actually a HexString
			sha3Uncles: "Whatever", // actually a HexString
			logsBloom: "Whatever", // actually a HexString
			transactionsRoot: "Whatever", // actually a HexString
			stateRoot: "Whatever", // actually a HexString
			miner: "Address", // actually a HexString (address?)
			difficulty: "BigInt",
			totalDifficulty: "BigInt",
			extraData: "Bytes",
			// These numbers probably should be BigInts in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size: "Number",
			gasLimit: "Number",
			gasUsed: "Number",

			timestamp: "Number", // Should I convert this to a date object?
			transactions: "Whatever", // Array of HexStrings
			uncles: "Whatever" // Array of HexStrings
		}
	},
	{
		func: "getTransactionByHash",
		method: "eth_getTransactionByHash",
		args: ["HexString"],
		returns: "Object",
		objectReturns: {
			hash: "Whatever", // actually a HexString
			nonce: "Number", // If anyone opens a issue linked to an address which has a nonce of 9,007,199,254,740,991 I will change this to a BigInt
			blockHash: "Whatever", // actually a HexString
			blockNumber: "Number", // Can be null if it's pending
			transactionIndex: "Number", // I doubt 9,007,199,254,740,991 transactions can be allowed in a block. (Unless sharding??)
			from: "Address", // actually an AddressString
			to: "Address", // actually an AddressString
			value: "BigInt",
			gas: "Number",
			gasPrice: "BigInt",
			input: "Whatever", // actually a HexString

			v: "Number",
			r: "Whatever",
			s: "Whatever"
		}
	},
	{
		func: "getTransactionByBlockHashAndIndex",
		method: "eth_getTransactionByBlockHashAndIndex",
		args: ["HexString", "Number"],
		returns: "Object",
		objectReturns: { // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			hash: "Whatever", // actually a HexString
			nonce: "Number", // If anyone opens a issue linked to an address which has a nonce of 9,007,199,254,740,991 I will change this to a BigInt
			blockHash: "Whatever", // actually a HexString
			blockNumber: "Number", // Can be null if it's pending
			transactionIndex: "Number", // I doubt 9,007,199,254,740,991 transactions can be allowed in a block. (Unless sharding??)
			from: "Address", // actually an AddressString
			to: "Address", // actually an AddressString
			value: "BigInt",
			gas: "Number",
			gasPrice: "BigInt",
			input: "Whatever", // actually a HexString

			v: "Number",
			r: "Bytes",
			s: "Bytes"
		}
	},
	{
		func: "getTransactionByBlockNumberAndIndex",
		method: "eth_getTransactionByBlockNumberAndIndex",
		args: ["Number", "Number"],
		returns: "Object",
		objectReturns: { // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			hash: "Whatever", // actually a HexString
			nonce: "Number", // If anyone opens a issue linked to an address which has a nonce of 9,007,199,254,740,991 I will change this to a BigInt
			blockHash: "Whatever", // actually a HexString
			blockNumber: "Number", // Can be null if it's pending
			transactionIndex: "Number", // I doubt 9,007,199,254,740,991 transactions can be allowed in a block. (Unless sharding??)
			from: "Address", // actually an AddressString
			to: "Address", // actually an AddressString
			value: "BigInt",
			gas: "Number",
			gasPrice: "BigInt",
			input: "Whatever" // actually a HexString
		}
	},
	{
		func: "getTransactionReceipt",
		method: "eth_getTransactionReceipt",
		args: ["HexString"],
		returns: "Object",
		objectReturns: {
			transactionHash: "Whatever", // actually a HexString
			transactionIndex: "Number",
			blockHash: "Whatever", // actually a HexString
			blockNumber: "Number",
			from: "Address", // actually an AddressString
			to: "Address", // actually an AddressString
			cumulativeGasUsed: "Number",
			gasUsed: "Number",
			contractAddress: "Address",
			logs: "Whatever", // Array of log objects, which this transaction generated.
			logsBloom: "Bytes", // "256 Bytes - Bloom filter for light clients to quickly retrieve related logs."
			status: "Number" // either 1 (success) or 0 (failure) (Should I make this a boolean?)
		}
	},
	{
		func: "getUncleByBlockHashAndIndex",
		method: "eth_getUncleByBlockHashAndIndex",
		args: ["HexString", "Number"],
		returns: "Object",
		objectReturns: { // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			number: "Number",
			hash: "Whatever", // actually a HexString
			parentHash: "Whatever", // actually a HexString
			nonce: "Whatever", // actually a HexString
			sha3Uncles: "Whatever", // actually a HexString
			logsBloom: "Whatever", // actually a HexString
			transactionsRoot: "Whatever", // actually a HexString
			stateRoot: "Whatever", // actually a HexString
			miner: "Address", // actually a HexString (address?)
			difficulty: "BigInt",
			totalDifficulty: "BigInt",
			extraData: "Bytes",
			// These numbers probably should be BigInts in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size: "Number",
			gasLimit: "Number",
			gasUsed: "Number",

			timestamp: "Number", // Should I convert this to a date object?
			transactions: "Whatever", // Array of HexStrings
			uncles: "Whatever" // Array of HexStrings
		}
	},
	{
		func: "getUncleByBlockNumberAndIndex",
		method: "eth_getUncleByBlockNumberAndIndex",
		args: ["Number", "Number"],
		returns: "Object",
		objectReturns: { // TODO: Copypasting duplicate references eat RAM, perhaps we should define the object before the array and only put in their references here.
			number: "Number",
			hash: "Whatever", // actually a HexString
			parentHash: "Whatever", // actually a HexString
			nonce: "Whatever", // actually a HexString
			sha3Uncles: "Whatever", // actually a HexString
			logsBloom: "Whatever", // actually a HexString
			transactionsRoot: "Whatever", // actually a HexString
			stateRoot: "Whatever", // actually a HexString
			miner: "Address", // actually a HexString (address?)
			difficulty: "BigInt",
			totalDifficulty: "BigInt",
			extraData: "Bytes",
			// These numbers probably should be BigInts in the future. Though historically, these values never went above Number.MAX_SAFE_INTEGER
			size: "Number",
			gasLimit: "Number",
			gasUsed: "Number",

			timestamp: "Number", // Should I convert this to a date object?
			transactions: "Whatever", // Array of HexStrings
			uncles: "Whatever" // Array of HexStrings
		}
	},
	{
		func: "getLogs",
		method: "eth_getLogs",
		args: ["Object"],
		objectArgs: [
			{
				fromBlock: "Number",
				toBlock: "Number",
				address: "Address",
				topics: "Whatever",
				blockhash: "HexString"
			}
		],
		returns: "Whatever" // This will be processed by the EthereumContractEventEmitter object
	},
	// TODO: Filter functions aren't documented
	{
		func: "newBlockFilter",
		method: "eth_newBlockFilter",
		args: [],
		returns: "Whatever" // A number presented as a hex for polling use later. Though there's no point on converting from hex if it's just going to be used in hex later.
	},
	{
		func: "newPendingTransactionFilter",
		method: "eth_newPendingTransactionFilter",
		args: [],
		returns: "Whatever" // A number presented as a hex for polling use later. Though there's no point on converting from hex if it's just going to be used in hex later.
	},
	{
		func: "newFilter",
		method: "eth_newFilter",
		args: ["Object"],
		objectArgs: [
			{
				fromBlock: "Number",
				toBlock: "Number",
				address: "Address",
				topics: "Whatever",
				blockhash: "HexString"
			}
		],
		returns: "Whatever" // A number presented as a hex for polling use later. Though there's no point on converting from hex if it's just going to be used in hex later.
	},
	{
		func: "uninstallFilter",
		method: "eth_uninstallFilter",
		args: ["HexString"],
		returns: "Whatever" // This actually returns a proper boolean from the endpoint, not bullshit like 0x0 and 0x01
	},
	{
		func: "getFilterChanges",
		method: "eth_getFilterChanges",
		args: ["HexString"],
		returns: "Whatever" // This will be handled by the EthereumContractEventEmitter (Unless it's a newBlockFilter or a newPendingTransactionFilter)
	},
	{
		func: "getFilterLogs",
		method: "eth_getFilterLogs",
		args: ["HexString"],
		returns: "Whatever" // This will be handled by the EthereumContractEventEmitter
	},
	{
		func: "getWork",
		method: "eth_getWork",
		args: [],
		returns: "Object",
		objectReturns: ["Bytes", "Bytes", "Bytes"]
	},
	{
		func: "submitWork",
		method: "eth_submitWork",
		args: ["Bytes", "Bytes", "Bytes"],
		returns: "Boolean"
	},
	{
		func: "submitHashrate",
		method: "eth_submitHashrate",
		args: ["Bytes", "Bytes"],
		returns: "Boolean"
	}
];

for(let i = 0; i < wrapperFuncs.length; i += 1){
	const data = wrapperFuncs[i];
	// Is this gross or ingenious? 🤔
	Web3Connection.prototype[data.func] = function(...args){
		return this._wrapperFunc(data, ...args);
	};
}
delete wrapperFuncs;

module.exports = {Web3Connection};
