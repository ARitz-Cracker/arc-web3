
const {Web3Connection} = require("./lib/web3Connection.js");
const keccak256 = require('js-sha3').keccak256;

let f = (async function(){
	try{
		//let web3 = new Web3Connection("http://192.168.5.5/eth/");
		//let web3 = new Web3Connection("http://192.168.5.5:8545");
		let web3 = new Web3Connection("ws://192.168.5.5:8546");
		console.log("-------clientVersion");
		console.log(await web3.clientVersion());
		let data = Buffer.from("Hello world!");
		
		console.log("-------keccak256");
		console.log((await web3.keccak256(data)).toString("hex"));
		console.log(keccak256(data));
		
		console.log("-------networkID");
		console.log(await web3.networkID());
		
		console.log("-------networkListening");
		console.log(await web3.networkListening());
		
		console.log("-------networkPeerCount");
		console.log(await web3.networkPeerCount());
		
		console.log("-------protocolVersion");
		console.log(await web3.protocolVersion());
		
		console.log("-------isSyncing");
		console.log(await web3.isSyncing());
		
		
		console.log("-------coinbase");
		try{
			console.log(await web3.coinbase());
		}catch(ex){
			console.log(ex.name+": "+ex.message);
		}
		
		
		console.log("-------isMining");
		console.log(await web3.isMining());
		
		console.log("-------hashrate");
		console.log((await web3.hashrate()).toString());
		
		console.log("-------gasPrice");
		console.log((await web3.gasPrice()).toString());
		
		console.log("-------blockNumber");
		console.log((await web3.blockNumber()).toString());
		
		console.log("-------getBalance");
		console.log((await web3.getBalance("0x8c070C3c66F62E34bAe561951450f15f3256f67c")).div(1e18).toString());
		
		console.log("-------getTransactionCount");
		console.log((await web3.getTransactionCount("0x8c070C3c66F62E34bAe561951450f15f3256f67c")).toString());
		
		console.log("-------getBlock");
		console.log(await web3.getBlock());
		/*
		console.log(await connection.doRequest("eth_call",[{
			from:"0x8c070c3c66f62e34bae561951450f15f3256f67c",
			to:"0xc0c001140319c5f114f8467295b1f22f86929ad0",
			gas:"0x73f780",
			gasPrice:"0x3b9aca00",
			value:"0x0",
			data:"0x91c05b0b0000000000000000000000000000000000000000000000000000000000000539"
		},"latest"]));
		*/
		web3.closeConnection();
	}catch(ex){
		console.log(ex.stack);
	}
});
f();