const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const EC = require("elliptic").ec;

/**core component*/
const { Blockchain, Wmcoin } = require("./core/main");
const Transaction = require("./core/Transaction");
const Block = require("./core/Block");
const { wallet } = require("./core/wallet");

const { getAddress } = require("./utils/getAddress");
const { getPeers } = require("./utils/getPeers");
const { SHA256 } = require("./utils/sha256");

let mining = false;
let miningInterval;
const app = express();
app.use(bodyParser.json());
app.use(cors());
const ec = new EC("secp256k1");

// create a new WebSocket server and attach it to the Express.js server
const PORT = 3001;
const MY_ADDRESS = `${getAddress}:${PORT}`;

let openedPeers = [];
let connectedPeers = [];

//--------------------------------Start server---------------------//

const server = app.listen(PORT, () => {
  console.log(`server listening on port http://localhost:${PORT}`);
});

const ws = new WebSocket.Server({ server });

// Handle WebSocket connections
ws.on("connection", (socket, req) => {
  console.log("A new WebSocket connection was established");

  socket.on("message", (message) => {
    //console.log(`Received message: ${message}`);
    const senderIp = (
      req.headers["x-forwarded-for"] || req.connection.remoteAddress
    ).replace(/^::ffff:/, "");
    console.log(`{Riceive message from ${senderIp} }`);
    const { type, data } = JSON.parse(message);
    console.log(type);
    // Handle incoming messages from the client
    switch (type) {
      case "TYPE_HANDSHAKE":
        const nodes = data;
        nodes.forEach((node) => connect(node));
        break;
      case "NEW_BLOCK":
        // Parse the new block object from the message payload
        const [newBlock, newDiff] = data;
        // Verify that the block is valid

        if (!Block.isValidNewBlock(newBlock, Wmcoin.getLastBlock(), newDiff)) {
          console.log("Received an invalid new block from peer");
          return;
        }
        // Add the new block to your blockchain
        Wmcoin.addBlock(newBlock);
        // Broadcast the new block message to all other peers
        //  broadcast(produceMessage("NEW_BLOCK", newBlock));

        console.log(`Received and added a new block from peer ${senderIp}`);
        break;
      case "CREATE_NEW_TRANSACTION":
        // Handle new transaction message
        const transaction = Wmcoin.addTransaction(data);
        break;
      case "GET_CHAIN":
        // Handle request for blockchain
        const chain = Wmcoin.chain;
        broadcast(produceMessage("REPALCE_TYPE_CHAIN", chain));
        break;
      case "REPALCE_TYPE_CHAIN":
        const newChain = data;
        if (
          Blockchain.isValidChain(newChain) &&
          newChain.length >= Wmcoin.chain.length
        ) {
          Wmcoin.chain = newChain;
          //broadcast("CHAIN", Wmcoin.chain);
        }
        break;
      case "CHAIN":
        const receivedChain = data;
        if (
          Blockchain.isValidChain(receivedChain) &&
          receivedChain.length > Wmcoin.chain.length
        ) {
          console.log(
            "Received blockchain is valid. Replacing current blockchain with received blockchain."
          );
          Wmcoin.chain = newChain;
        }
        break;
      default:
        console.log(`Unknown message type: ${type}`);
    }
  });

  // Handle WebSocket errors
  socket.on("error", (err) => {
    console.error(`WebSocket error: ${err}`);
  });

  // Handle WebSocket disconnects
  socket.on("close", () => {
    console.log("WebSocket connection closed");
  });
});

//-------------------------connectToPeers-----------------------------//

async function connect(address) {
  if (connectedPeers.includes(address) || address === MY_ADDRESS) {
    return; // already connected
  }

  try {
    const socket = new WebSocket(address);

    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve);
      socket.addEventListener("error", reject);
      socket.addEventListener("close", reject);
    });

    // Send handshake message
    const message = produceMessage("TYPE_HANDSHAKE", [
      MY_ADDRESS,
      ...connectedPeers,
    ]);
    socket.send(JSON.stringify(message));

    // Send Request chain
    const requestChain = { type: "GET_CHAIN" };
    socket.send(JSON.stringify(requestChain));
    // Store socket and add to list of connected peers
    const peer = { address, socket };
    openedPeers.push(peer);
    connectedPeers.push(address);
    // Handle socket closing
    socket.addEventListener("close", () => {
      openedPeers.splice(openedPeers.indexOf(peer), 1);
      connectedPeers.splice(connectedPeers.indexOf(address), 1);
    });
  } catch (error) {
    console.error(`Failed to connect to peer at ${address}: ${error}`);
  }
}

//-------------------------Connect Peers------------------------------//
async function startApp() {
  try {
    const PEERS = await getPeers("3001");
    console.log("PEERS:", PEERS);
    await PEERS.forEach((peer) => connect(peer));
    // start the rest of your application here
  } catch (error) {
    console.error("Error:", error);
  }
}
startApp();

// ------------------------Functions Helper---------------------------//
function produceMessage(type, data) {
  return { type, data };
}

function broadcast(message) {
  openedPeers.forEach((node) => {
    node.socket.send(JSON.stringify(message));
  });
}

//--------------------------API endpoint to add a new transaction--------------------//
// Route to send transaction
app.post("/transaction/send", (req, res) => {
  console.log(req.body);
  const { from, to, amount, gas, privateKey } = req.body;
  const keyPair = ec.keyFromPrivate(privateKey);
  if (keyPair.getPublic("hex") === from) {
    const signature = keyPair
      .sign(SHA256(from + to + amount + gas), "base64")
      .toDER("hex");

    const transaction = new Transaction(from, to, amount, gas, signature);
    const status = Wmcoin.addTransaction(transaction);
    if (status) {
      broadcast(produceMessage("CREATE_NEW_TRANSACTION", transaction));
      res.status(202).json({
        _message: "transaction send",
        transaction: transaction,
        status: true,
      });
    } else {
      res.status(400).send("transaction not valid");
    }
  } else {
    res.status(400).send("keys not match ");
  }
});
// Route to get transactions
app.get("/transaction/all", (req, res) => {
  const transactions = Wmcoin.transactions;
  res.status(201).json({ Transactions: transactions });
});
// Route to get blocks
app.get("/blocks", (req, res) => {
  const blocks = Wmcoin.getBlocks();
  res.status(201).json({ Blockchain: blocks });
});
// Route to get latest block
app.get("/lastblock", (req, res) => {
  const blocks = Wmcoin.getLastBlock();
  res.status(201).json({ Blockchain: blocks });
});
// Route to get balance
app.post("/balance", (req, res) => {
  const balance = Wmcoin.getBalance(req.body.address);
  res.status(202).json({ balance: balance });
});
// Route to create account
app.post("/wallet/create", (req, res) => {
  const account = wallet.create(req.body.password);
  res.status(202).json({ wallet: account });
});
// Route to get accounts
app.get("/wallet/accounts", (req, res) => {
  const accounts = wallet.getWallet();
  res.status(202).json({ accounts: accounts });
});

// Route to start mining
app.post("/mine/start", (req, res) => {
  const walletAddress = req.body.walletAddress;
  const privateKey = req.body.privateKey;
  if (startMiningHandler(walletAddress, privateKey)) {
    res.status(202).json({ status: true });
  } else {
    res.status(202).json({ status: false });
  }
});

// Route to stop mining
app.post("/mine/stop", (req, res) => {
  if (stopMiningHandler()) {
    res.status(202).json({ status: false });
  } else {
    res.status(202).json({ message: "" });
  }
});

//------------------------- Handler function for "startMining" event-----------//
const startMiningHandler = (walletAddress, privateKey) => {
  if (!mining) {
    console.log("Mining started");
    mining = true;
    miningInterval = setInterval(async () => {
      // Add your mining logic here
      if (Wmcoin.mineBlock(walletAddress, privateKey)) {
        broadcast(
          produceMessage("NEW_BLOCK", [
            Wmcoin.getLastBlock(),
            Wmcoin.difficulty,
          ])
        );
        console.log("Block mined successfully");
        return true;
      } else {
        return false;
      }
    }, 1000);
  }
};

// ------------------------Handler function for "stopMining" event-------------//
const stopMiningHandler = () => {
  if (mining) {
    console.log("Mining stopped");
    mining = false;
    clearInterval(miningInterval);
    mining = false;
    return true;
  } else {
    console.log("mining aleardy stoped");
    return false;
  }
};

//---------------------uncaughtException---------------------------//
process.on("uncaughtException", (err) => console.log(err));
