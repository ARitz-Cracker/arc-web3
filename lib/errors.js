
class Web3ConnectionError extends Error {
	constructor(msg, code, data){
		super(msg + " (" + code + ")");
		this.code = code;
		this.data = data;
	}
}
Web3ConnectionError.prototype.name = "Web3ConnectionError";

class Web3APIError extends Error {
	constructor(msg, code, data){
		super(msg + " (" + code + ")");
		this.code = code;
		this.data = data;
	}
}
Web3APIError.prototype.name = "Web3APIError";

class EthereumContractRevertError extends Error {

}
EthereumContractRevertError.prototype.name = "EthereumContractRevertError";

class EthereumABIParseError extends Error {

}
EthereumABIParseError.prototype.name = "EthereumABIParseError";

module.exports = {
	Web3ConnectionError,
	Web3APIError,
	EthereumContractRevertError,
	EthereumABIParseError
};
