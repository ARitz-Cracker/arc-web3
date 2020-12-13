const {isValidAddress, toChecksumAddress} = require("./ethAddressChecksum.js");
const {keccak256} = require("keccak-wasm");
const {EthereumContract} = require("./smartContract");
let secp256k1 = null;
const GAS_LIMIT = 12500000;
class EthereumAccount {
	constructor(connection, address){
		/*
		if (!(connection instanceof Web3Connection)){
			throw new TypeError("Argument #1 must be a Web3Connection");
		}
		*/
		if(address instanceof Uint8Array){
			if(address.length != 32){
				throw new TypeError("Private keys must be 32 bytes in length.");
			}
			throw new Error("EthereumAccountSignable is what you want");
		}
		if(!isValidAddress(address, true)){
			throw new TypeError("Argument #2 isn't an Ethereum address.");
		}
		this._connection = connection;
		this.address = toChecksumAddress(address);
		this.nonce = 0;
	}
	async updateNonce(){
		const nonce = await this._connection.getTransactionCount(this.address);
		if(nonce > this.nonce){
			this.nonce = nonce;
		}
		return this.nonce;
	}
	sign(){
		throw new Error("Private key for account " + this.address + " is unknown.");
	}
	// Data is buffer or string
	async signData(data){
		const fullSig = await this._connection.sign(this.address, Buffer.from(data));
		const hash = keccak256(Buffer.concat([
			Buffer.from("\x19Ethereum Signed Message:\n" + Buffer.byteLength(data).toString(), "ascii"),
			Buffer.from(data)
		]), false);
		return {
			messageHash: hash,
			v: fullSig.readUIntBE(64, fullSig.length - 64),
			r: fullSig.slice(0, 32),
			s: fullSig.slice(32, 64),
			signature: "0x" + fullSig.toString("hex")
		};
	}
	verifySignature(data, sig){
		try{
			if(secp256k1 == null){
				throw new Error("arc-web3-signable-accounts isn't installed or is not initialized");
			}
			let fullSig;
			let recoveryId;
			const hash = keccak256(data, false);
			if(typeof sig === "string"){
				fullSig = Buffer.from(sig.substring(2, 130), "hex");
				recoveryId = Number.parseInt(sig.substring(130), 16) - 27;
			}else{
				fullSig = Buffer.concat([sig.r, sig.s], 64);
				recoveryId = sig.v - 27;
			}
			const recoveredPubKey = secp256k1.recoverPublicKeyUncompressed(fullSig, recoveryId, hash);
			return Promise.resolve(
				keccak256(recoveredPubKey).substring(0, 40) === this.address.substring(2).toLowerCase()
			);
		}catch(ex){
			return Promise.reject(ex);
		}
	}
	transfer(account, amount, gasPrice, gasLimit, nonce){
		if(account instanceof EthereumAccount){
			account = account.address;
		}else if(account instanceof EthereumContract){
			account = account._jsproperties.account.address;
		}
		return this.sendTransaction({
			to: account,
			gasPrice,
			gasLimit,
			value: amount,
			nonce
		});
	}
	async sendTransaction(txData){
		if(txData.nonce == null){
			await this.updateNonce();
			txData.nonce = this.nonce;
		}
		if(txData.gasPrice == null){
			txData.gasPrice = await this._connection.gasPrice();
		}
		if(txData.to instanceof EthereumAccount || txData.to instanceof EthereumContract){
			txData.to = txData.to.address;
		}
		if(txData.gasLimit == null){
			txData.gasLimit = await this._connection.estimateGas({
				from: this.address,
				to: txData.to,
				data: txData.data,
				gasPrice: txData.gasPrice,
				value: txData.value || 0n
			});
			if(txData.gasLimit > 21000){
				txData.gasLimit *= 1.25;
				txData.gasLimit |= 0;
				if(txData.gasLimit > GAS_LIMIT){
					txData.gasLimit = GAS_LIMIT;
				}
			}
		}
		txData.from = this.address;
		const txHash = await this._connection.sendTransaction(txData);
		this.nonce += 1;
		return txHash;
	}
	balance(blockNumber){
		return this._connection.getBalance(this.address, blockNumber);
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
	InitializeEthereumAccountVerifiable: async s => {
		secp256k1 = await s;
	},
	EthereumAccount
};
