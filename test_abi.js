
const {encodeArguments,encode} = require("./lib/ABIEncoder.js");
const {decodeArguments,decode} = require("./lib/ABIDecoder.js");

let testABI = [
	{
		"constant": true,
		"inputs": [],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "int256"
			},
			{
				"name": "",
				"type": "int128"
			},
			{
				"name": "",
				"type": "int16"
			},
			{
				"name": "",
				"type": "int8"
			}
		],
		"payable": false,
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [
			{
				"name": "",
				"type": "uint256[2]"
			},
			{
				"name": "",
				"type": "string"
			}
		],
		"name": "abitest",
		"outputs": [
			{
				"name": "",
				"type": "bytes1"
			}
		],
		"payable": false,
		"stateMutability": "pure",
		"type": "function"
	}
];

let f = (async function(){
	try{
		let args = [
			[[1,2],[3,4],[5,6]],
			[[1,2],[3,4],[5,6]],
			["hello","hello","hello"],
			Buffer.from("badb01","hex")
		];
		let types = [
			"uint8[2][]",
			"uint16[][]",
			"string[]",
			"bytes3"
		];
		
		
		console.log(args);
		let hexStr = encodeArguments(args,types);
		console.log(hexStr);
		console.log(decodeArguments(hexStr,types));
		
		console.log(encode([[1,2],"fucc"],testABI[1]));
	}catch(ex){
		console.log(ex.stack);
	}
});
f();



