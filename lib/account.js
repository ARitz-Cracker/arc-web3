const {Web3Connection} = require("./web3Connection.js");
const {isValidAddress, toChecksumAddress} = require("./ethAddressChecksum.js");
class EthereumAccount{
	constructor(connection,address){
		if (!(connection instanceof Web3Connection)){
			throw new TypeError("Argument #1 must be a Web3Connection");
		}
		if (address instanceof Uint8Array){
			if(address.length != 32){
				throw new TypeError("Private keys must be 32 bytes in length.");
			}
			throw new Error("Creating accounts from private keys isn't supported yet.");
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
	transfer(account,amount){
		throw new Error("Private key for account "+this.address+" is unknown.");
	}
	sendTransaction(tx){
		throw new Error("Private key for account "+this.address+" is unknown.");
	}
	balance(blockNumber){
		return this._connection.getBalance(this.address,blockNumber);
	}
}

module.exports = {
	EthereumAccount:EthereumAccount
}
