/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable require-await */
const {spawn} = require("child_process");
const readline = require("readline");

const fs = require("fs");
const {tmpdir} = require("os");
const {sep} = require("path");
const dataDir = tmpdir() + sep + "geth_test_" + Date.now().toString(36);

const chai = require("chai");
chai.use(require("chai-as-promised"));
const expect = chai.expect;
const {Web3Connection, InitializeWeb3, EthereumAccount} = require("../index");
describe("Web3Connection", function(){
	/**@type {import("child_process").ChildProcessWithoutNullStreams} */
	let childProcess;
	before(async function(){
		this.timeout(30000);
		await new Promise((resolve, reject) => {
			childProcess = spawn("geth", [
				"--ipcdisable", // I should support this, probably using JSONStream or something
				"--dev",
				"--http",
				"--http.addr", "127.101.116.104",
				"--http.port", "8545",
				"--http.api", "web3,eth,debug,personal,net",
				"--http.corsdomain=\"*\"",
				"--networkid", "3825193",
				"--datadir", dataDir
			], {stdio: "pipe"});
			childProcess.once("error", (err) => {
				console.log(err);
				reject(err);
				childProcess = null;
			});
			const rle = readline.createInterface(childProcess.stderr);
			rle.on("line", (data) => {
				// console.log("GETH ERR: ", data);
				if(data.indexOf("HTTP server started") !== -1){
					resolve();
				}
			});
			const rlo = readline.createInterface(childProcess.stdout);
			rlo.on("line", (data) => {
				// console.log("GETH OUT: ", data);
				if(data.indexOf("HTTP server started") !== -1){
					resolve();
				}
			});
		});
		await InitializeWeb3();
	});
	it("outputs the correct network ID", async function(){
		const web3 = new Web3Connection("http://127.101.116.104:8545");
		await expect(web3.networkID()).to.eventually.equal(3825193);
		web3.closeConnection();
	});
	it("is able to send transactions (endpoing signing)", async function(){
		const web3 = new Web3Connection("http://127.101.116.104:8545");
		const devAccount = new EthereumAccount(web3, (await web3.getAccounts())[0]);
		await web3.transactionConfirmed(
			await devAccount.transfer("0x536f6d652072616e646f6d206163636f756e7400", 1337n)
		);
		await expect(web3.getBalance("0x536f6d652072616e646f6d206163636f756e7400")).to.eventually.equal(1337n);
		web3.closeConnection();
	});
	after(async function(){
		this.timeout(30000);
		if(childProcess != null){
			childProcess.kill();
			await new Promise(resolve => {
				childProcess.once("close", resolve);
			});
		}
		await fs.promises.rm(dataDir, {recursive: true, force: true})
	});
});