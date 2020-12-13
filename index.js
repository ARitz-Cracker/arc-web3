if(typeof Buffer === "undefined"){
	require("buffer-lite");
}
const {EthereumAccount, InitializeEthereumAccountVerifiable} = require("./lib/account.js");
const {EthereumContractFunction, EthereumContractMultiFunction, EthereumContract, EthereumContractResult} = require("./lib/smartContract.js");
const {Web3Connection} = require("./lib/web3Connection.js");
const encodeABI = require("./lib/ABIDecoder.js").decode;
const decodeABI = require("./lib/ABIEncoder.js").encode;
const {toChecksumAddress, isValidAddress} = require("./lib/ethAddressChecksum");
const {Web3ConnectionError, Web3APIError, EthereumContractRevertError, EthereumABIParseError} = require("./lib/errors.js");
const {InitializeKeccak, Keccak, keccak224, keccak256, keccak384, keccak512} = require("keccak-wasm");
const util = {
	encodeABI,
	decodeABI,
	toChecksumAddress,
	isValidAddress,
	keccak224,
	keccak256,
	keccak384,
	keccak512
};
const initFunctions = [() => InitializeKeccak()];
module.exports = {
	util,
	EthereumAccount,
	Web3ConnectionError,
	Web3APIError,
	EthereumContractRevertError,
	EthereumABIParseError,
	EthereumContractFunction,
	EthereumContractMultiFunction,
	EthereumContract,
	EthereumContractResult,
	Web3Connection,
	Keccak
};
let signableAccountsInstalled = false;
try{
	const {EthereumAccountSignable, EthereumAccountKeyring, InitializeEthereumAccountKeyring, bip39, HDKey, rlp} = require("arc-web3-keyring");
	module.exports.EthereumAccountSignable = EthereumAccountSignable;
	module.exports.EthereumAccountKeyring = EthereumAccountKeyring;
	module.exports.rlp = rlp;
	module.exports.bip39 = bip39;
	module.exports.HDKey = HDKey;
	const bts = require("@aritz-cracker/cryptowasm");
	const secp256k1 = bts.instantiateSecp256k1();
	initFunctions.push(
		// Oh god look how ugly this is.
		InitializeEthereumAccountKeyring(
			bts.instantiateSha256(),
			secp256k1,
			require("pbkdf2-wasm").instantiatePbkdf2(bts.instantiateSha512())
		)
	);
	initFunctions.push(() => InitializeEthereumAccountVerifiable(secp256k1));
	signableAccountsInstalled = true;
}catch(ex){
	const keyRingError = {
		get(){
			throw new Error("arc-web3-keyring isn't installed");
		}
	};
	Object.defineProperty(module.exports, "EthereumAccountKeyring", keyRingError);
	Object.defineProperties(module.exports.util, {
		bip39: keyRingError,
		HDKey: keyRingError
	});
}

if(!signableAccountsInstalled){
	try{
		const {EthereumAccountSignable, InitializeEthereumAccountSignable, rlp} = require("arc-web3-signable-accounts");
		module.exports.EthereumAccountSignable = EthereumAccountSignable;
		module.exports.util.rlp = rlp;
		const secp256k1 = require("@aritz-cracker/cryptowasm").instantiateSecp256k1();
		initFunctions.push(InitializeEthereumAccountSignable(secp256k1));
		initFunctions.push(InitializeEthereumAccountVerifiable(secp256k1));
	}catch(ex){
		const accountsError = {
			get(){
				throw new Error("arc-web3-signable-accounts isn't installed");
			}
		};
		Object.defineProperty(module.exports, "EthereumAccountSignable", accountsError);
		Object.defineProperty(module.exports.util, "rlp", accountsError);
	}
}
let promise;
module.exports.InitializeWeb3 = function(){
	if(promise === undefined){
		promise = Promise.all(initFunctions.map(v => v()));
	}
	return promise;
};
