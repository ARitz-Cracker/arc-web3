// const {Web3ConnectionError, Web3APIError} = require("../lib/errors.js");
class EthereumProdiderRPCer{
	constructor(ethereumProvider){
		if(typeof ethereumProvider.request !== "function"){
			throw new Error("ethereumProvider has no request method");
		}
		this._ethereumProvider = ethereumProvider;
	}
	doRequest(method, params){
		return this._ethereumProvider.request({method, params});
	}
}
module.exports = {EthereumProdiderRPCer};
