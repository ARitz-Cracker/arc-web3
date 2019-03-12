const {isValidAddress, toChecksumAddress} = require("./ethAddressChecksum.js");
const {keccak256} = require("keccak-wasm");
let secp256k1 = null;
class EthereumAccount{
	constructor(connection,address){
		/*
		if (!(connection instanceof Web3Connection)){
			throw new TypeError("Argument #1 must be a Web3Connection");
		}
		*/
		if (address instanceof Uint8Array){
			if(address.length != 32){
				throw new TypeError("Private keys must be 32 bytes in length.");
			}
			throw new Error("EthereumAccountSignable is what you want");
		}
		if (!isValidAddress(address, true)){
			throw new TypeError("Argument #2 isn't an Ethereum address.");
		}
		this._connection = connection;
		this.address = toChecksumAddress(address); 
	}
	sign(data){
		throw new Error("Private key for account "+this.address+" is unknown.");
	}
	signData(data){
		return Promise.reject(new Error("Private key for account "+this.address+" is unknown."));
	}
	async verifySignature(data, sig){
		if (secp256k1 == null){
			throw new Error("arc-web3-signable-accounts isn't installed or is not initialized");
		}
		let fullSig
		let recoveryId;
		const hash = keccak256(data, false);
		if (typeof sig === "string"){
			fullSig = BufferLib.hexToBuffer(sig.substring(2, 130), false);
			recoveryId = Number.parseInt(sig.substring(130), 16) - 27;
		}else{
			fullSig = BufferLib.concat([sig.r, sig.s], 64);
			recoveryId = sig.v - 27;
		}
		const recoveredPubKey = secp256k1.recoverPublicKeyUncompressed(fullSig, recoveryId, hash);
		return keccak256(recoveredPubKey).substring(0,40) === this.address.substring(2).toLowerCase();
	}
	transfer(account,amount){
		return Promise.reject(new Error("Private key for account "+this.address+" is unknown."));
	}
	sendTransaction(tx){
		return Promise.reject(new Error("Private key for account "+this.address+" is unknown."));
	}
	balance(blockNumber){
		return this._connection.getBalance(this.address,blockNumber);
	}
	toString(){
		return this.address;
	}
	setSenderFor(contract){
		contract._jsproperties.signer = this;
	}
}
EthereumAccount.prototype.setSignerFor = EthereumAccount.prototype.setSenderFor;

module.exports = {
	InitializeEthereumAccountVerifiable: async (s) => {
		secp256k1 = await s;
	},
	EthereumAccount:EthereumAccount
}
