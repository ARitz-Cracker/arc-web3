const keccak256 = require('js-sha3').keccak256;

class EthereumContractEventEmitter{ // Implements NodeJS's eventEmitter
	constructor(contract,abi){
		this._ABISelectionMapping = {};
		for (let i=0;i<abi.length;i+=1){
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
			
			let eventData = {
				abiSnip:abiSnip,
				topicZero = "0x"+keccak256(funcSelector)
			}
			
			if (this._ABISelectionMapping[abiSnip.name] != null){
				this._ABISelectionMapping[abiSnip.name] = false;
			}
			this._ABISelectionMapping[abiSnip.name] = eventData;
			
			
			
			let topicZero = "0x"+keccak256(funcSelector);
			contract._jsproperties.abiSelectors[i] = funcSelector;
		}
		this.contract = contract;
	}
}

