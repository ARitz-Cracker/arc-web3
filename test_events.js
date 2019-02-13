
const {Web3Connection} = require(".");
const keccak256 = require('js-sha3').keccak256;

let f = (async function(){
	try{
		//let web3 = new Web3Connection("http://192.168.5.5/eth/");
		let web3 = new Web3Connection("http://192.168.5.5:8545");
		// Listen to every ERC-20 token transfer
		web3.listen(null, ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], null, null, (e)=>{
			console.log(e);
		});
		//web3.closeConnection();
	}catch(ex){
		console.log(ex.stack);
	}
});
f();