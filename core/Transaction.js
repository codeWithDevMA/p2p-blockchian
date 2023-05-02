const { SHA256 } = require("../utils/sha256");

class Transaction {
  constructor(from, to, amount, gas = 0, signature = "") {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.gas = gas;
    this.signature = signature;
  }

  sign(keyPair) {
    if (keyPair.getPublic("hex") === this.from) {
      this.signature = keyPair
        .sign(SHA256(this.from + this.to + this.amount + this.gas), "base64")
        .toDER("hex");
    }
  }
  static isValid(tx, chain) {
    const { from, to, amount, signature } = tx;
    if (!from || !to || !amount || !signature) {
      console.log("Invalid transaction: Missing required fields");
      return false;
    }
    if (from === to) {
      console.log("Sender and receiver addresses are the same");
      return false;
    }
    const balance = chain.getBalance(from);
    if (balance < parseInt(amount)) {
      console.log(
        `Invalid transaction: Insufficient balance (${balance}) for sending amount (${amount})`
      );
      return false;
    }
    return true;
  }
}

module.exports = Transaction;
