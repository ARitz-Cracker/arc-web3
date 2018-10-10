// Faster than parsing every single time.
let NumToHex = [];
let hexToNum = {};
let uHexToNum = {};
for (let i=0;i<16;i+=1){
	let h = "0"+i.toString(16);
	NumToHex[i] = h;
	hexToNum[h] = i;
	uHexToNum[h.toUpperCase()] = i;
}
for (let i=16;i<256;i+=1){
	let h = i.toString(16);
	NumToHex[i] = h;
	hexToNum[h] = i;
	uHexToNum[h.toUpperCase()] = i;
}


exports.hexToString = function(hex,appended0x){
	if (hex.length%2 !== 0){
		throw new TypeError("Hex strings must be an even length");
	}
	// Now you see, JavaScript uses UTF-16 because it's stupid, so we gotta shove these UTF-8 characters into something native that can convert it quickly. (because doing it ourselves is a pain... Don't "But you're already iterating through all chars" me.)
	let str = "";
	// of course I'm ignoring the 0x at the beginning
	for (let i=(appended0x===false?0:2);i<hex.length;i+=2){
		str += "%"+hex.substr(i,2);
	}
	
	return decodeURIComponent(str); // FIXME: This throws an URIError when the buffer isn't valid UTF-8.
}

exports.hexToBuffer = function(hex,appended0x){
	if (hex.length%2 !== 0){
		throw new TypeError("Hex strings must be an even length");
	}
	let buff = new Uint8Array((hex.length/2)-1);
	let bi = 0;
	for (let i=(appended0x===false?0:2);i<hex.length;i+=2){
		buff[bi++] = hexToNum[hex.substr(i,2)];
	}
	return buff;
}

exports.bufferToString = function(buff){
	// Now you see, JavaScript uses UTF-16 because it's stupid, so we gotta shove these UTF-8 characters into something native that can convert it quickly. (because doing it ourselves is a pain... Don't "But you're already iterating through all chars" me.)
	let str = "";
	for (let i=0;i<buff.length;i+=1){
		str += "%"+NumToHex[buff[i]];
	}
	return decodeURIComponent(str); // FIXME: This throws an URIError when the buffer isn't valid UTF-8.
}

exports.bufferToHex = function(buff,append0x){
	let str = (append0x === false ? "":"0x");
	for (let i=0;i<buff.length;i+=1){
		str += NumToHex[buff[i]];
	}
	return str;
}

exports.stringToBuffer = function(str){
	// Here I am again relying on a built-in function for UTF-16 <-> UTF-8 conversion.
	let sterilized = encodeURIComponent(str);
	let buff = new Uint8Array(sterilized.length);
	let bi = 0;
	for (let i=0;i<sterilized.length;i+=1){
		let n = sterilized.charCodeAt(i);
		if (n == 37){ // %
			buff[bi++] = uHexToNum[sterilized.substr(i+1,2)];
			i += 2; // Skip over the 2 hex characters.
		}else{
			buff[bi++] = n;
		}
	}
	return buff.slice(0,bi);
}

exports.stringToHex = function(str,append0x){
	// Here I am again relying on a built-in function for UTF-16 <-> UTF-8 conversion.
	let sterilized = encodeURIComponent(str);
	let hex = (append0x === false ? "":"0x");
	for (let i=0;i<sterilized.length;i+=1){
		let n = sterilized.charCodeAt(i);
		if (n == 37){ // %
			hex += sterilized.substr(i+1,2).toLowerCase();
			i += 2; // Skip over the 2 hex characters.
		}else{
			hex += NumToHex[n];
		}
	}
	return hex;
}

exports.newBuffer = function(len){
	return new Uint8Array(len);
}

exports.newBufferUnsafe = function(len){
	return new Uint8Array(len);
}

exports.from = function(stuff){
	return new Uint8Array(stuff);
}

exports.concat = function(buffers,len){
	if (buffers.length == 0){
		return new Uint8Array(0);
	}
	if (len == null){
		len = 0;
		for (let i=0;i<buffers.length;i+=1){
			len += buffers[i].length;
		}
	}
	let result = new Uint8Array(len);
	let currentIndex = 0
	for (let i=0;i<buffers.length;i+=1){
		result.set(buffers[i].length,currentIndex);
		currentIndex += buffers[i].length;
	}
	return result;
}