const keccak256 = require('js-sha3').keccak256;
const {encodeFunctions} = require("./ABIEncoder.js");
const {decodeFunctions, decodeArguments} = require("./ABIDecoder.js");
//const EventEmitter = require('events'); // Note: the npm "events" module implements this for browsers

class EthereumContractEventEmitter{ // Implements NodeJS's eventEmitter
	constructor(contract,abi){
		this._ABISelectionMapping = {};
		this._callbacks = {};
		this._internalCallbacks = {};
		for (let i = 0; i < abi.length; i += 1){
			let abiSnip = abi[i];
			if (abiSnip.type != "event"){
				continue;
			}
			let funcSelector = abiSnip.name+"("
			for (let ii=0;ii<abiSnip.inputs.length;ii+=1){
				let type = abiSnip.inputs[ii].type;
				funcSelector += type+",";
			}
			if (abiSnip.inputs.length > 0){
				funcSelector = funcSelector.substring(0,funcSelector.length-1);
			}
			funcSelector+=")";
			let inputs = [];
			let indexedInputs = [];
			for (let i = 0; i < abiSnip.inputs.length; i += 1){
				if (abiSnip.inputs[i].indexed){
					indexedInputs.push(abiSnip.inputs[i]);
				}else{
					inputs.push(abiSnip.inputs[i]);
				}
			}
			indexedInputs.unshift(null);
			const topicZero = "0x"+keccak256(funcSelector);
			const eventData = {
				name: abiSnip.name,
				selector: funcSelector,
				inputs,
				indexedInputs,
				topicZero
			}
			
			if (this._ABISelectionMapping[abiSnip.name] === undefined){
				this._ABISelectionMapping[abiSnip.name] = eventData;
			}else{
				this._ABISelectionMapping[abiSnip.name] = false;
			}
			this._ABISelectionMapping[funcSelector] = eventData;
			this._ABISelectionMapping[topicZero] = eventData;
			contract._jsproperties.abiSelectors[i] = funcSelector;
		}
		this.contract = contract;
	}
	_verifyTopicZero(str){
		const eventData = this._ABISelectionMapping[str];
		if (eventData === undefined){
			throw new Error("This EthereumContract doesn't have an event named \""+str+"\"");
		}else if(eventData === false){
			throw new Error("This EthereumContract has multiple events with the same name. You must select the event using its name and argument types.");
		}
		return eventData.topicZero;
	}
	_verifyTopic(value, type){
		if (typeof value === "string" && /^(0x)?[0-9a-f]{64}$/.test(value)){
			return value;
		}
		if (type.indexOf("[") !== -1 || type === "bytes" || type === "string"){
			throw new Error("Search value for "+type+" must be a keccak256 hash");
		}
		const encode = encodeFunctions[type];
		if (encode === undefined){
			throw new Error(type+" cannot be used to listen to events");
		}
		return encode(value);
	}
	_verifyTopics(topics){
		let indexedInputs;
		if (topics[0] != null){
			if (Array.isArray(topics[0])){
				for (let i = 0; i < topics[0].length; i += 1){
					topics[0][i] = this._verifyTopicZero(topics[0][i]);
				}
				indexedInputs = this._ABISelectionMapping[topics[0][0]].indexedInputs;
			}else{
				topics[0] = this._verifyTopicZero(topics[0]);
				indexedInputs = this._ABISelectionMapping[topics[0]].indexedInputs;
			}
		}
		for (let i = 1; i < topics.length; i += 1){
			if (Array.isArray(topics[i])){
				for (let ii = 0; ii < topics[i].length; ii += 1){
					topics[i][ii] = _verifyTopic(topics[i][ii], indexedInputs[i].type);
				}
			}else{
				topics[i] = _verifyTopic(topics[i], indexedInputs[i].type);
			}
		}
		return topics;
	}
	_decodeEventData(e){
		const eventData = this._ABISelectionMapping[e.topics[0]];
		if (eventData === undefined){
			return;
		}
		e.name = eventData.name;
		e.selector = eventData.selector;
		let returnValues = {};
		for (let i = 1; i < eventData.indexedInputs.length; i += 1){
			const type = eventData.indexedInputs[i].type;
			const name = eventData.indexedInputs[i].name;
			if (type.indexOf("[") !== -1 || type === "bytes" || type === "string"){
				returnValues[name] = e.topics[i];
			}else{
				const decode = decodeFunctions[type];
				if (decode !== undefined){
					returnValues[name] = decode(e.topics[i].substring(2), 0);
				}
			}
		}
		let inputTypes = [];
		for (let i = 0; i < eventData.inputs.length; i += 1){
			inputTypes[i] = eventData.inputs[i].type;
		}
		const decodedArgs = decodeArguments(e.data.substring(2), inputTypes);
		for (let i = 0; i < decodedArgs.length; i += 1){
			returnValues[eventData.inputs[i].name] = decodedArgs[i];
		}
		
		e.returnValues = returnValues;
	}
	blockRange(...args){
		const callback = args.pop();
		const toBlock = args.pop();
		const fromBlock = args.pop();
		
		const topics = this._verifyTopics(args);
		const id = JSON.stringify(topics);
		let callbacks = this._callbacks[id];
		if (callbacks === undefined){
			callbacks = [];
			this._callbacks[id] = callbacks;
			this._internalCallbacks[id] = [];
		}
		if(callbacks.indexOf(callback) !== -1){
			return;
		}
		const internalCallback = async (e)=>{
			this._decodeEventData(e);
			await callback(e);
		}
		callbacks.push(callback);
		this._internalCallbacks[id].push(internalCallback);
		this.contract._jsproperties.connection.listen(this.contract.address, topics, fromBlock, toBlock, internalCallback);
	}
	on(...args){
		const callback = args.pop();
		this.blockRange(...args, null, null, callback);
	}
	off(...args){
		const callback = args.pop();
		const topics = this._verifyTopics(args);
		const id = JSON.stringify(topics);
		let callbacks = this._callbacks[id];
		if (callbacks === undefined){
			return;
		}
		let i = callbacks.indexOf(callback);
		if (i >= 0){
			callbacks.splice(i, 1);
			this.contract._jsproperties.connection.unlisten(
				this.contract.address,
				topics,
				this._internalCallbacks[id].splice(i, 1)[0]
			);
		}
	}
}
EthereumContractEventEmitter.prototype.addListener = EthereumContractEventEmitter.prototype.on;
EthereumContractEventEmitter.prototype.removeListener = EthereumContractEventEmitter.prototype.off;
module.exports = {EthereumContractEventEmitter};

