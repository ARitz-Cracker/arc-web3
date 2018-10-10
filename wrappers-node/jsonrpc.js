// This thing is a kind of wrapper which will should be replaceable with a web browser implementation.
const {URL} = require('url');
const {Web3ConnectionError, Web3APIError} = require("../lib/errors.js");

const handlers = {
	"http:":require("http"),
	"https:":require("https")
}


class HTTPJSONRPCer {
	constructor(url){
		let parsedData = new URL(url);
		this.h = handlers[parsedData.protocol];
		if (this.h == null){
			throw new SyntaxError("Protocol is invalid: "+parsedData.protocol);
		}
		this.httpOptions = {
			agent: 	this.h.Agent({ keepAlive: true }),
			hostname: parsedData.hostname,
			port: (parsedData.port|0) || (parsedData.protocol == "http:" ? 80 : 443),
			path: parsedData.pathname,
			method: "POST",
			headers: {
				'User-Agent' : "NodeJS/"+process.version.substr(1)+" (arc-web3.js/0.7.0d)"
			}
		};
		if (parsedData.username){
			if (parsedData.password){
				this.httpOptions.auth = parsedData.username+":"+parsedData.password;
			}else{
				this.httpOptions.auth = parsedData.username;
			}
		}
	}
	doRequest(method,params){
		let that = this;
		return new Promise( function(resolve, reject) {
			let req = that.h.request(that.httpOptions, function (res) {
			switch(res.statusCode) {
				case 200:
					let i = 0;
					let unknownLength = res.headers["content-length"] == null;
					let buff = (unknownLength ? [] : Buffer.allocUnsafe(res.headers["content-length"]|0));
					res.on("data",function(c){
						if (unknownLength){
							buff.push(c);
						}else{
							c.copy(buff, i);
						}
						i += c.length;
					});
					res.on("end",function(){
						try{
							if (unknownLength){
								buff = Buffer.concat(buff, i);
							}else{
								if (i != buff.length){
									throw new Web3ConnectionError("Server lied about it's response length. ("+i+" != "+buff.length+")",-32700);
								}
							}

							let data = JSON.parse(buff.toString());
							if (data.error == null){
								resolve(data.result);
							}else{
								reject(new Web3APIError(data.error.message,data.error.code,data.error.data));
							}
						}catch(ex){
							if (ex instanceof SyntaxError){
								reject(new Web3ConnectionError("The node isn't returning valid JSON",-32700,buff.toString()))
							}else{
								reject(ex);
							}
						}
					});
				break;
				case 301:
				case 302:
				case 303:
				case 304:
				case 305:
				case 306:
				case 307:
				case 308:
					reject(new Web3ConnectionError("URL "+url+" wants to re-direct to "+res.headers.location+" you should probably use that URL instead.",res.statusCode,res.headers.location))
				break;
				default:
					reject(new Web3ConnectionError("HTTP status code: "+res.statusCode+" "+res.statusMessage,res.statusCode,url));
			}
			});
			req.on("error",function(ex){
				reject(new Web3ConnectionError("Unable to connect",-1,ex.name+": "+ex.message));
			});
			let body = Buffer.from(JSON.stringify({
				jsonrpc:"2.0",
				method:method,
				params:params,
				id:232 // TODO: Actually do something with the ID.
			}));
			req.setHeader('Content-Type', 'application/json');
			req.setHeader('Content-Length', body.length );
			req.write(body)
			req.end()
		});
	}
}

module.exports = {
	HTTPJSONRPCer
};

