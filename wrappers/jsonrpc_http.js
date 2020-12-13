const {Web3ConnectionError, Web3APIError} = require("../lib/errors.js");
const {betterCrossFetch, RESPONSE_TYPES, POST_TYPES} = require("better-cross-fetch");
class HTTPJSONRPCer {
	constructor(url){
		this._url = url;
	}
	async doRequest(method, params){
		const response = (await betterCrossFetch(this._url, {
			postData: {
				jsonrpc: "2.0",
				method,
				params,
				id: 232 // TODO: Actually do something with the ID.
			},
			postDataType: POST_TYPES.JSON,
			responseType: RESPONSE_TYPES.JSON
		})).response;
		if(typeof response !== "object"){
			throw new Web3ConnectionError("The node isn't returning valid JSON", -32700, response);
		}
		if(response.error == null){
			response.result;
		}
		throw new Web3APIError(response.error.message, response.error.code, response.error.data);
	}
}
module.exports = {HTTPJSONRPCer};
