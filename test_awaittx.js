
const {Web3Connection, EthereumAccountSignable, InitializeWeb3, EthereumContract, BigNumber} = require(".");

let f = (async function(){
	const web3 = new Web3Connection("https://ropsten.infura.io/v3/201c3665c93d45168410e53a6db0b8e9");
	try{
		await InitializeWeb3();
		const account = new EthereumAccountSignable(web3, Buffer.alloc(32, 0xbb));
		console.log(account.address);
		console.log((await account.balance()).div(1e18).toString());
		const contract = new EthereumContract(web3, "0x6685e92Ce8A16F10b03561dEa8940fb2FA3b768e", [
			{
				"constant": false,
				"inputs": [
					{
						"name": "c",
						"type": "uint256"
					}
				],
				"name": "decreaseBy",
				"outputs": [],
				"payable": false,
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"constant": false,
				"inputs": [
					{
						"name": "c",
						"type": "uint256"
					}
				],
				"name": "increaseBy",
				"outputs": [],
				"payable": false,
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"constant": false,
				"inputs": [],
				"name": "sudoku",
				"outputs": [],
				"payable": false,
				"stateMutability": "nonpayable",
				"type": "function"
			},
			{
				"inputs": [],
				"payable": false,
				"stateMutability": "nonpayable",
				"type": "constructor"
			},
			{
				"constant": true,
				"inputs": [],
				"name": "counter",
				"outputs": [
					{
						"name": "",
						"type": "uint256"
					}
				],
				"payable": false,
				"stateMutability": "view",
				"type": "function"
			}
		]);
		account.setSignerFor(contract);
		console.log((await contract.counter()).toString());
		let tx = await contract.increaseBy({gasLimit: 42181, forceSend: true}, new BigNumber(10));
		console.log(tx);
		let p = web3.transactionConfirmed(tx);
		console.log(p);
		console.log(await p);
	}catch(ex){
		console.log(ex.stack);
	}
	await web3.closeConnection();
});
f();