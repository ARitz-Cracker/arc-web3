/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable require-await */
const {spawn} = require("child_process");
const readline = require("readline");

const chai = require("chai");
chai.use(require("chai-as-promised"));
const expect = chai.expect;
describe("Web3Connection", function(){
	/**@type {import("child_process").ChildProcessWithoutNullStreams} */
	let childProcess;
	before(async function(){
		await new Promise((resolve, reject) => {
			childProcess = spawn("geth", [
				"--ipcdisable", // I should support this, probably using JSONStream or something
				"--http",
				"--http.addr", "127.101.116.104",
				"--http.port", "8545",
				"--http.api", "web3,eth,debug,personal,net",
				"--http.corsdomain=\"*\""
			]);
			childProcess.once("error", (err) => {
				reject(err);
				childProcess = null;
			});
			const rl = readline.createInterface(process.stdout);
			rl.on("line", (data) => {
				if(data.indexOf("HTTP server started") !== -1){
					resolve();
				}
			});
		});
	});
	it("")
	after(function(){
		if(childProcess != null){
			return new Promise(resolve => {
				childProcess.once("close");
			});
		}
	});
});