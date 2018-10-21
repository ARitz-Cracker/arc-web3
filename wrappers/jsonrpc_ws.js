const {Web3ConnectionError, Web3APIError} = require("../lib/errors.js");
let WS;
if (typeof WebSocket == "undefined"){
	try{
		WS = require('ws');
	}catch(ex){
		// "ws" module not installed.
	}
}else{
	WS = WebSocket; // We're (probably) in a web browser.
};
const maxNum = 2147483647;
class WSJSONRPCer {
	constructor(url){
		this._url = url;
		this._promises = [];
		this._id = 0;
		if (typeof WS == "undefined"){
			throw new Error("If you're going to use a web-socket endpoint, the 'ws' npm module must be installed.");
		}
	}
	connectWebsocket(){
		let that = this;
		return new Promise(function(resolve,reject){
			that._ws = new WS(that._url);
			that._ws.onerror = Function.prototype; // Any losses of connections are handled by the close event.
			that._ws.onopen = function(e){
				that._ws.onclose = function(e){
					that._socketClosed(e.code);
				}
				that._ws.onmessage = function(e){
					that._socketMessage(e.data);
				}
				resolve();
			};
			that._ws.onclose = function(e){
				reject(new Web3ConnectionError("Unable to connect",-1,"Websocket connection code: "+e.code));
			}
		});
	}
	_socketClosed(closeCode){
		if (this._reqParams != null){
			this._reqReject(new Web3ConnectionError("Connection lost",-1,"Websocket connection code: "+e.code));
			this._reqParams = null;
		}
	}
	
	_socketMessage(msg){
		let data;
		try{
			data = JSON.parse(msg);
		}catch(ex){
			// EXTREME PANIC! SHUT DOWN EVERYTHING!
			let err = new Web3ConnectionError("The node isn't returning valid JSON",-32700,msg);
			if (this._reqReject != null){
				this._reqReject(err);
			}
			for (let i=0;i<this._promises.length;i+=1){
				this._promises[i].reject(err);
			}
			this._promises = [];
			return;
		}
		if (this._reqParams == null || data.id !== this._reqParams.id){
			console.error("arc-web3: WSJSONRPCer: Unhandled websocket message: ",data);
			return;
		}
		this._reqParams = null;
		if (data.error == null){
			this._reqResolve(data.result);
		}else{
			this._reqReject(new Web3APIError(data.error.message,data.error.code,data.error.data));
		}
	}
	async _actuallyDoRequests(){
		if (this._doingRequests){
			return;
		}
		this._doingRequests = true;
		const that = this;
		while (this._promises.length > 0){
			let params = this._promises.shift();
			let finalResolve = params.resolve;
			let finalReject = params.reject;
			delete params.resolve;
			delete params.reject;
			try{
				if (this._ws == null || this._ws.readyState == 3){
					await this.connectWebsocket();
				}
				
				finalResolve(await new Promise(function(resolve,reject){
					that._reqResolve = resolve;
					that._reqReject = reject;
					that._reqParams = params;
					that._ws.send(JSON.stringify(params));
				}));
			}catch(ex){
				finalReject(ex);
			}
		}
		this._doingRequests = false;
		if (this._promises.length > 0){
			_actuallyDoRequest();
		}
		
	}
	closeConnection(){
		this.closed = true;
		this._ws.close()
	}
	doRequest(method,params){
		if (this.closed){
			return Promise.reject(new Web3ConnectionError("Connection lost",-1,"Websocket connection code: 1000"));
		}
		const that = this;
		return new Promise(function(resolve,reject){
			that._promises.push({
				jsonrpc:"2.0",
				method:method,
				params:params,
				id:that._id,
				resolve:resolve,
				reject:reject
			});
			that._id += 1;
			if (that._id > maxNum){
				that._id = 0;
			}
			that._actuallyDoRequests();
		});
	}
	
}

module.exports = {
	WSJSONRPCer
};
