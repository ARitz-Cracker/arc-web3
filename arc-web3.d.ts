import {BigNumber} from "bignumber.js"; 

/** 
 * An Ethereum address, 42 chars long. Starting with "0x" followed by 40 hex values.
 * Values a to f may be uppercase to serve as a checksum feature.
*/
type AddressString = string;

/** 
 * 66 chars long. Starting with "0x" followed by 64 hex values. All lowercase.
*/
type TransactionHash = string;

/** Ethereum call data. A hex-string of variable length with a "0x" prefix */
type CallData = string;

/**
 * Ethereum network ID
 * 
 * Common values include:
 * * `1` Ethereum Mainnet
 * * `2` Morden Testnet (deprecated)
 * * `3` Ropsten Testnet
 * * `4` Rinkeby Testnet
 * * `42` Kovan Testnet
 */
type ChainID = number;

/**
 * Returned by Web3Connection.prototype.isSyncing
 * 
 * The `highestBlock` isn't necessarily the latest block in existence. Blocks may still be generated while the syncing
 * is in progress. If that happens, `highestBlock` won't update until the previous sync is complete, and the
 * `startingBlock` will be changed.
 */
export interface SyncStatus{
	/** The block the sync started from. */
	static startingBlock: number;

	/** The latest block downloaded. */
	static currentBlock: number;

	/** The latest block known. */
	static highestBlock: number;
}

/**
 * See object properties for further explanation
*/
export interface TransactionData{
	/** Automatically determined in most cases. Can be `undefined`. */
	chainID?: ChainID;

	/** 
	 * Transactions in ethereum are performed serially. This tranasction will not be processed until one with a lower
	 * nonce has been confirmed. Automatically determined in most cases. Can be `undefined`.
	 * */
	static nonce?: number;

	/** Only used when performing a read-only call on EthereumContracts. If left `undefined`, the EthereumContracts's signer account will be used. */
	static from?: AddressString;

	/** Ignored when used on an EthereumContract */
	static to?: AddressString | EthereumContract | EthereumAccount;

	/** Ignored when used on an EthereumContract. May be `undefined` if only transfering ETH */
	static data?: CallData;

	/** Gas price in wei. Will be automatically estimated if unspecified. Estimation will depend on endpoint configuration. */
	static gasPrice?: BigNumber;

	/** The maximum amount of gas to allocate to this transaction. Will be automatically estimated if unspecified. */
	static gasLimit?: number;

	/** Amount of ETH to transfer in wei. Defaults to 0 if unspecified. */
	static value?: BigNumber
}

type EthereumMessageSignatureRecoveryID = 27 | 28 | 29 | 30;

/**
 * You probably just want the `signature` property
 */
interface EthereumMessageSignature{
	/** 
	 * 132 chars long. Starting with "0x" followed by 130 hex values. All lowercase.
	 * Basically just `r` `s` and `v` concatenated in that order in hex.
	 * */
	static signature: string;

	/** The hash used with the signature */
	static messageHash: Uint8Array;

	/** First half of the 64-bit signature */
	static r: Uint8Array;

	/** Second half of the 64-bit signature */
	static s: Uint8Array;

	/** The ECDSA recovery ID with 27 added to it */
	static v: EthereumMessageSignatureRecoveryID
}
export class EthereumABIParseError{
	static name: string;
	static message: string;
	static stack: string;
}

/**
 * A read-only Ethereum account. This cannot submit transactions to the network.
 */
export class EthereumAccount {
	constructor(web3: Web3Connection, address: AddressString);

	/** The Ethereum address for this account */
	address: AddressString;
	
	/**
	 * Returns this account's Ether balance in wei.
	 * 
	 * @param blockNumber check historical balance. Defaults to current balance
	*/
	balance(blockNumber?: number): Promise<BigNumber>;

	/** You probably want an `EthereumAccountSignable` instead */
	sendTransaction(tx: TransactionData): Promise<TransactionHash>;

	/** You probably want an `EthereumAccountSignable` instead */
	signMessage(message: string): EthereumMessageSignature

	/** You probably want an `EthereumAccountSignable` instead */
	signData(message: string): EthereumMessageSignature

	/** All function calls to the specified contract will use this account as the sender by default. */
	setSenderFor(contract: EthereumContract): void;

	/** All function calls to the specified contract will use this account as the sender by default. */
	setSignerFor(contract: EthereumContract): void;

	/** You probably want an `EthereumAccountSignable` instead */
	transfer(recipient: AddressString | EthereumAccount | EthereumContract, amount: BigNumber, gasPrice?: BigNumber, gasLimit?: number, nonce?: number): Promise<TransactionHash>;

	/**
	 * This function can only be used if `arc-web3-signable-accounts` is installed.
	 * 
	 * Returns true if the specified signature was created by this account. Otherwise, false.
	 * 
	 * @param message the message which the signature signed
	 * @param signature a hex string representing the signature or the signature object
	*/
	verifySignature(message: string, signature: EthereumMessageSignature | string): boolean;
}

/**
 * An object used to create multiple Ethereum accounts from a single seed.
 * 
 * This object is only available if `arc-web3-keyring` is installed.
 */
export class EthereumAccountKeyring {
	/**
	 * @param entropyOrSeed If `string`, this represents a mnemonic seed.
	 * If `Uint8Array`, this represents the entropy used to generate the seed.
	 * If `null` or `undefined`, a random seed will be generated.
	 * @param wordList List of words to use, array length must be 2047. Defaults to the standard english set.
	 * @param cache Whether or not to cache the accounts created. Defaults to `false`.
	 * @param forceSeed If the mnemonic seed is invalid, and this is true, an error will be thrown upon construction.
	 * Defaults to `false`.
	 */
	constructor(entropyOrSeed: Uint8Array | string, wordList?: Array<string>, cache?: boolean, forceSeed?: boolean);

	/** Entropy that can be used to re-create the mnemonic seed. */
	entropy: Uint8Array;

	/**
	 * @param web3 the connection to pass to the account
	 * @param index which account to generate
	 */
	createAccount(web3: Web3Connection, index: number): EthereumAccountSignable;

	/**
	 * Destroys the private keys used to generate the accounts
	 */
	destroy(): void;

	/**
	 * Generates the mnemonic seed using this object's entropy property.
	 * Key-word is "generate" since the mnemonic seed string isn't stored.
	 * */
	seedWords(): string;
}

/**
 * An EthereumAccount which can sign transactions
 * 
 * This object is only available if `arc-web3-signable-accounts` is installed.
 */
export class EthereumAccountSignable extends EthereumAccount {

	/**
	 * @param web3 the connection this account will use for its functions
	 * @param privateKey A Buffer 32 bytes long. Hopefully cryptographically secure enough to be used to sign
	 * transactions. If you're not using a cryptographically secure algorithm to generate these, or if you don't
	 * know what that means, then you probably shouldn't be creating your own private keys.
	 */
	constructor(web3: Web3Connection, privateKey: Uint8Array | Buffer);

	/**
	 * Submits a transaction to the Ethereum network
	*/
	sendTransaction(tx: TransactionData): Promise<TransactionHash>;

	/** 
	 * Signs the specified message with this accounts private keys
	*/
	signMessage(message: string): EthereumMessageSignature

	/**
	 * Alias of `signMessage`
	*/
	signData(message: string): EthereumMessageSignature

	/** 
	 * Transfers ether
	 * @param recipient The account to send the Ether to
	 * @param amount The amount of Ether to send in wei
	 * @param gasPrice  Gas price in wei. Will be automatically estimated if unspecified. Estimation will depend on
	 * endpoint configuration.
	 * @param gasLimit The maximum amount of gas to allocate to this transaction. Will be automatically estimated if unspecified.
	 * @param nonce Transactions in ethereum are performed serially. This tranasction will not be processed until one with a lower nonce has been confirmed. Will be automatically estimated if unspecified.
	 */
	transfer(recipient: AddressString | EthereumAccount | EthereumContract, amount: BigNumber, gasPrice?: BigNumber, gasLimit?: number, nonce?: number): Promise<TransactionHash>;
}

/** An event which occured on the Ethereum network */
export interface EthereumEvent {
	/** when the log was removed, due to a chain reorganization. `false` if it's a valid log. */
	static removed: boolean;

	/** The log index position in the block. */
	static logIndex: number;

	/** The transaction's block index from where this log was created from. */
	static transactionIndex: number;

	/** Hash of the transaction this log was created from. */
	static transactionHash: TransactionHash;

	/** Hash of the block where this log was in. */
	static blockHash: string;

	/** The block number where this log was in. */
	static blockNumber: number;

	/** Address from which this log originated. */
	static address: AddressString;

	/**  Raw non-indexed data passed to the event. */
	static data: string;

	/** Raw indexed data passed to the event. */
	static topics: Array<string>;

	/**
	 * Only available if used with an `EthereumContract`
	 * 
	 * The name of the event. e.g. "Transfer"
	 */
	static name?: string;

	/**
	 * Only available if used with an `EthereumContract`
	 * 
	 * The name of the event. e.g. "Transfer(address,address,uint256)"
	 */
	static selector?: string;

	/**
	 * Only available if used with an `EthereumContract`
	 * 
	 * Contains the values decoded from `data` and `topics`. The properties will be the name of the arguments specified by the ABI. 
	 * 
	 * If an event argument is a string, array, or bytes, and it's marked as `indexed`, then a hash of that data will be returned.
	 */
	static returnValues?: {
		[key: string]: any
	}
}

export type EthereumEventListener = (eventData: EthereumEvent) => Promise<void> | void;

export class EthereumContractEventEmitter {
	/** The contract that this object is bound to. */
	contract: EthereumContract;

	/**
	 * Listens to events emitted by the contract.
	 * 
	 * @param eventName name of the event to listen to. If `null`, all events will be listened to.
	 * @param topic (varargs) only listen to events if they are emitted with the specified argument. can be `null` to
	 * ignore that particular argument, or omitted completely.
	 * @param callback If this is asynchronous, then it won't be called again until it resolves. Events will be placed
	 * on a queue. Mind you that if your callback never resolves, then you'll lock up the library. Also, make sure
	 * your callback doesn't throw! Handle your Errors!
	 */
	on(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	on(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	

	/**
	 * Removes the callback from listening to the specified event.
	 * 
	 * @param eventName name of the event to listen to. If `null`, all events will be listened to.
	 * @param topic (varargs) must exactly match the arguments given to `on`
	 * @param callback the callback to remove
	 */
	off(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;;
	off(eventName: string | null, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, topic?: any, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	off(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;

	/**
	 * Alias of {@link EthereumContractEventEmitter#on}
	 */
	addListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	addListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	

	/**
	 * Alias of {@link EthereumContractEventEmitter#off}
	 */
	removeListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;
	removeListener(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, callback: EthereumEventListener): void;

	/**
	 * Similar to `on`, except it allows you to specify a range of blocks.
	 * 
	 * @param eventName name of the event to listen to. If `null`, all events will be listened to.
	 * @param topic (varargs) only listen to events if they are emitted with the specified argument. can be `null` to
	 * ignore that particular argument, or omitted completely.
	 * @param fromBlock All events since this block will be fetched and passed to the callback.
	 * @param toBlock if `null`, then the event will be listened to until `off` is called. If not `null`, then the `callback` will stop being called after this block was reached.
	 * @param callback If this is asynchronous, then it won't be called again until it resolves. Events will be placed
	 * on a queue. Mind you that if your callback never resolves, then you'll lock up the library. Also, make sure
	 * your callback doesn't throw! Handle your Errors!
	 */
	blockRange(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
	blockRange(eventName: string | null, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, topic?: any, fromBlock: number, toBlock: number | null, callback: EthereumEventListener): void;
}
export class EthereumContract {
	constructor(...args: any[]);
	
	static event: EthereumContractEventEmitter;
}

export class EthereumContractFunction {
	constructor(...args: any[]);

	call(...args: any[]): void;

	toString(): string;

}

export class EthereumContractMultiFunction {
	constructor(...args: any[]);

	toString(...args: any[]): void;

}

export class EthereumContractRevertError {
	constructor(...args: any[]);

	static captureStackTrace(p0: any, p1: any): any;

	static stackTraceLimit: number;

}

export class HDKey {
	constructor(versions: any);

	derive(path: any): any;

	deriveChild(index: any): any;

	recover(hash: any, sig: any, recovery: any): any;

	sign(hash: any): any;

	signRecoverable(hash: any): any;

	verify(hash: any, signature: any): any;

	wipePrivateData(): any;

	static HARDENED_OFFSET: number;

	static fromMasterSeed(seedBuffer: any, versions: any): any;

}

export class Web3APIError {
	constructor(...args: any[]);

	static captureStackTrace(p0: any, p1: any): any;

	static stackTraceLimit: number;

}

export class Web3Connection {
	constructor(...args: any[]);

	blockNumber(args: any): any;

	call(args: any): any;

	clientVersion(args: any): any;

	closeConnection(...args: any[]): void;

	coinbase(args: any): any;

	estimateGas(args: any): any;

	gasPrice(args: any): any;

	getBalance(args: any): any;

	getBlock(...args: any[]): void;

	getBlockByHash(args: any): any;

	getBlockByNumber(args: any): any;

	getBlockTransactionCount(...args: any[]): void;

	getBlockTransactionCountByHash(args: any): any;

	getBlockTransactionCountByNumber(args: any): any;

	getCode(args: any): any;

	getFilterChanges(args: any): any;

	getFilterLogs(args: any): any;

	getLogs(args: any): any;

	getStorageAt(args: any): any;

	getTransaction(...args: any[]): void;

	getTransactionByBlockHashAndIndex(args: any): any;

	getTransactionByBlockNumberAndIndex(args: any): any;

	getTransactionByHash(args: any): any;

	getTransactionCount(args: any): any;

	getTransactionReceipt(args: any): any;

	getUncle(...args: any[]): void;

	getUncleByBlockHashAndIndex(args: any): any;

	getUncleByBlockNumberAndIndex(args: any): any;

	getUncleCount(...args: any[]): void;

	getUncleCountByBlockHash(args: any): any;

	getUncleCountByBlockNumber(args: any): any;

	getWork(args: any): any;

	hashrate(args: any): any;

	ignoreTransactionConfirmed(...args: any[]): void;

	isMining(args: any): any;

	isSyncing(args: any): any;

	keccak256(args: any): any;

	listen(...args: any[]): void;

	networkID(args: any): any;

	networkListening(args: any): any;

	networkPeerCount(args: any): any;

	newBlockFilter(args: any): any;

	newFilter(args: any): any;

	newPendingTransactionFilter(args: any): any;

	protocolVersion(args: any): any;

	sendRawTransaction(args: any): any;

	submitHashrate(args: any): any;

	submitWork(args: any): any;

	switchTransactionConfirmed(...args: any[]): void;

	transactionConfirmed(...args: any[]): void;

	uninstallFilter(args: any): any;

	unlisten(...args: any[]): void;

}

export class Web3ConnectionError {
	constructor(...args: any[]);

	static captureStackTrace(p0: any, p1: any): any;

	static stackTraceLimit: number;

}

export function EthereumContractResult(...args: any[]): void;

export function InitializeWeb3(): any;

export namespace bip39 {
	const wordlists: {
		EN: string[];
		JA: string[];
		chinese_simplified: string[];
		chinese_traditional: string[];
		english: string[];
		french: string[];
		italian: string[];
		japanese: string[];
		korean: string[];
		spanish: string[];
	};
	function entropyToMnemonic(entropy: any, wordlist: any): any;

	function generateMnemonic(strength: any, rng: any, wordlist: any): any;

	function initializeBip39(s: any, p: any): void;

	function mnemonicToEntropy(mnemonic: any, wordlist: any): any;

	function mnemonicToSeed(mnemonic: any, password: any): any;

	function mnemonicToSeedHex(mnemonic: any, password: any): any;

	function validateMnemonic(mnemonic: any, wordlist: any): any;
}

export namespace rlp {
	function decode(input: any, stream: any): any;

	function encode(input: any): any;

	function getLength(input: any): any;
}

export namespace util {
	function decodeABI(args: any, abiSnippet: any, selectorHash: any): any;
	
	function encodeABI(hexStr: any, abiSnippet: any): any;

	function isValidAddress(address: any, lenient: any): any;

	function toChecksumAddress(address: any, internal: any): any;
}

