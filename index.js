const {EthereumAccount} = require("./lib/account.js");
const {EthereumContractFunction, EthereumContractMultiFunction, EthereumContract, EthereumContractResult} = require("./lib/smartContract.js");
const {Web3Connection} = require("./lib/web3Connection.js");
const ABIDecode = require("./lib/ABIDecoder.js").decode;
const ABIEncode = require("./lib/ABIEncoder.js").encode;
const {Web3ConnectionError, Web3APIError, EthereumContractRevertError, EthereumABIParseError} = require("./lib/errors.js");
module.exports = {
	ABIEncode,
	ABIDecode,
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