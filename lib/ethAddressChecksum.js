const {keccak256} = require("keccak-wasm");
const toChecksumAddress = function(address, internal){
	if(address === undefined)return "";

	if(!internal){
		if(!/^(0x)?[0-9a-f]{40}$/i.test(address)){
			throw new Error("Invalid Ethereum address");
		}
		address = address.toLowerCase().substring(2);
	}
	const addressHash = keccak256(address);
	let checksumAddress = "0x";

	for(let i = 0; i < address.length; i += 1){
		// If character > "7" then print in upper case
		if(addressHash.charCodeAt(i) > 55){
			checksumAddress += address[i].toUpperCase();
		}else{
			checksumAddress += address[i];
		}
	}
	return checksumAddress;
};

const checkChecksumAddress = function(address){
	if(address.length !== 42 || address.substring(0, 2).toLowerCase() !== "0x"){
		return false;
	}

	address = address.substring(2);
	const addressHash = keccak256(address.toLowerCase());
	for(let i = 0; i < 40; i += 1){
		if(addressHash.charCodeAt(i) > 55){
			if(address.charCodeAt(i) > 96){ // Is lower case
				return false;
			}
		}else if(address.charCodeAt(i) > 64 && address.charCodeAt(i) < 91){ // Is upper case
			return false;
		}
	}
	return true;
};

const isValidAddress = function(address, lenient){
	if(typeof address !== "string"){
		return false;
	}
	if(lenient){
		return (
			/^(0x|0X)?[0-9a-f]{40}$/.test(address) ||
			/^(0x|0X)?[0-9A-F]{40}$/.test(address) ||
			checkChecksumAddress(address)
		);
	}
	return checkChecksumAddress(address);
};

module.exports = {toChecksumAddress, isValidAddress};
