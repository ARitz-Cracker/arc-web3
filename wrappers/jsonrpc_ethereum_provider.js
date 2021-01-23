const {Web3APIError} = require("../lib/errors.js");
class EthereumProdiderRPCer {
	constructor(ethereumProvider){
		if(typeof ethereumProvider.request !== "function"){
			throw new Error("ethereumProvider has no request method");
		}
		this._ethereumProvider = ethereumProvider;
	}
	async doRequest(method, params){
		try{
			// The await is needed for the catch block below to work
			return await this._ethereumProvider.request({method, params});
		}catch(ex){
			if(ex.code === -32603 && typeof ex.data === "object"){
				/* One would think metamask would simply pass along the error instead of making a new, less descriptive
				   one, and hiding the actually useful one within it */
				throw new Web3APIError(ex.data.message, ex.data.code, ex.data.data);
			}else{
				throw new Web3APIError(ex.message, ex.code, ex.data);
			}
		}
	}
}
module.exports = {EthereumProdiderRPCer};
