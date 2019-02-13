const {EthereumAccount} = require("./lib/account.js");
const {EthereumContractFunction, EthereumContractMultiFunction, EthereumContract, EthereumContractResult} = require("./lib/smartContract.js");
const {Web3Connection} = require("./lib/web3Connection.js");
const encodeABI = require("./lib/ABIDecoder.js").decode;
const decodeABI = require("./lib/ABIEncoder.js").encode;
const {toChecksumAddress, isValidAddress} = require("./lib/ethAddressChecksum");
const {Web3ConnectionError, Web3APIError, EthereumContractRevertError, EthereumABIParseError} = require("./lib/errors.js");
const BigNumber = require("./lib/bignumber.js");
const util = {
	encodeABI,
	decodeABI,
	toChecksumAddress,
	isValidAddress
};
let initFunctions = [];
module.exports = {
	util,
	BigNumber,
	EthereumAccount,
	Web3ConnectionError,
	Web3APIError,
	EthereumContractRevertError,
	EthereumABIParseError,
	EthereumContractFunction,
	EthereumContractMultiFunction,
	EthereumContract,
	EthereumContractResult,
	Web3Connection
}
let signableAccountsInstalled = false;
try{
	const {EthereumAccountSignable, EthereumAccountKeyring, InitializeEthereumAccountKeyring, bip39, HDKey, rlp} = require("arc-web3-keyring"); 
	module.exports.EthereumAccountSignable = EthereumAccountSignable;
	module.exports.EthereumAccountKeyring = EthereumAccountKeyring;
	module.exports.rlp = rlp;
	module.exports.bip39 = bip39;
	module.exports.HDKey = HDKey;
	initFunctions.push(async () => {
		const bts = require("bitcoin-ts");
		// Oh god look how ugly this is.
		return InitializeEthereumAccountKeyring(bts.instantiateSha256(), bts.instantiateSecp256k1(), require("pbkdf2-wasm").instantiatePbkdf2(bts.instantiateSha512()));
	});
	signableAccountsInstalled = true;
}catch(ex){
	//arc-web3-keyring or its dependenices are not installed.
}

if (!signableAccountsInstalled){
	try{
		const {EthereumAccountSignable, InitializeEthereumAccountSignable, rlp} = require("arc-web3-signable-accounts");
		module.exports.EthereumAccountSignable = EthereumAccountSignable;
		module.exports.rlp = rlp;
		initFunctions.push(async () => {
			return InitializeEthereumAccountSignable(require("bitcoin-ts").instantiateSecp256k1());
		});
	}catch(ex){
		//arc-web3-signable-accounts or its dependenices are not installed.
	}
}
module.exports.InitializeWeb3 = function(){
	await Promise.all(initFunctions.map((v) => {
		return v();
	}));
}