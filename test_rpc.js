
const JSONRPCer = require("./wrappers-node/jsonrpc.js");
const keccak256 = require('js-sha3').keccak256;

let f = (async function(){
	try{
		let connection = new JSONRPCer("http://192.168.5.5/eth/");
		console.log(await connection.doRequest("eth_call",[{
			from:"0x8c070c3c66f62e34bae561951450f15f3256f67c",
			to:"0xc0c001140319c5f114f8467295b1f22f86929ad0",
			gas:"0x73f780",
			gasPrice:"0x3b9aca00",
			value:"0x0",
			data:"0x91c05b0b0000000000000000000000000000000000000000000000000000000000000539"
		},"latest"]));
		/*
		let data = Buffer.from("Hello world!");
		console.log(keccak256(data));
		console.log(await connection.doRequest("web3_sha3",["0x"+data.toString("hex")]));
		*/
		
		let txData = await connection.doRequest("eth_getTransactionByHashs",["0x62ec664057fe15405de42d1711e270b8b90ea2b6f32ae4ab7b8d417eb348ac5b"]);
		console.log(txData);
		//console.log(Buffer.from(txData.s.substring(2),"hex").toString());
		
	}catch(ex){
		console.log(ex.stack);
	}
});
f();