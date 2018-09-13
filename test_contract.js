let abiArgTest = [
	{
		"constant": true,
		"inputs": [
			{
				"name": "",
				"type": "uint256"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
				"type": "bytes"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
				"type": "bytes32"
			}
		],
		"name": "onlyPossibleChoice",
		"outputs": [
			{
				"name": "",
				"type": "string"
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
				"type": "uint256[4]"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
				"type": "bytes8"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "uint8"
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
				"type": "uint256[]"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
				"type": "bytes4"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
				"type": "uint8"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
			}
		],
		"payable": false,
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
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
				"type": "string"
			}
		],
		"name": "test",
		"outputs": [
			{
				"name": "",
				"type": "bytes3"
			}
		],
		"payable": false,
		"stateMutability": "pure",
		"type": "function"
	}
]

let abi = [
	{
		"constant": false,
		"inputs": [
			{
				"name": "num",
				"type": "uint256"
			}
		],
		"name": "decreaseFailNumber",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": false,
		"inputs": [
			{
				"name": "num",
				"type": "uint256"
			}
		],
		"name": "increaseFailNumber",
		"outputs": [],
		"payable": false,
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [],
		"name": "failNumber",
		"outputs": [
			{
				"name": "",
				"type": "uint256"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	},
	{
		"constant": true,
		"inputs": [
			{
				"name": "num",
				"type": "uint256"
			}
		],
		"name": "testErrorOnCall",
		"outputs": [
			{
				"name": "",
				"type": "int256"
			}
		],
		"payable": false,
		"stateMutability": "view",
		"type": "function"
	}
]

const BigNumber = require("bignumber.js");

const {Web3Connection} = require("./lib/web3Connection.js");
const {EthereumContract} = require("./lib/smartContract.js");

let web3 = new Web3Connection("https://ropsten.infura.io/slb9oWy5bbre006wdib9");
let f = (async function(){
	try{
		let c = new EthereumContract(web3,null,abiArgTest);
		//console.log(typeof c.test)
		await c.test(Buffer.from("aaaaaaaa"));
		 /*
		let contract = new EthereumContract("0xcc8e849088db55864b9461156bd66be3762633ec",abi,web3);
		await console.log((await contract._wrapperFuncCall(3,[15])).toString());
		//*/
		
	}catch(ex){
		console.log(ex.stack);
	}
});
f();



