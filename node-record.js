const WebSocket = require("ws");
const os = require("os");

// Find the private IP address of this machine
let privateIp;

const interfaces = os.networkInterfaces();

Object.keys(interfaces).forEach((name) => {
  interfaces[name].forEach((info) => {
    if (!info.internal && info.family === "IPv4") {
      privateIp = info.address;
    }
  });
});
console.log(privateIp);

const senders = [`ws://${privateIp}:3002`];
const wss = new WebSocket.Server({ port: 4000 });
let portsender;
wss.on("connection", (ws, req) => {
  const senderIp = (
    req.headers["x-forwarded-for"] || req.connection.remoteAddress
  ).replace(/^::ffff:/, "");
  console.log(`Connected to node: ${senderIp}`);

  ws.on("message", async (message) => {
    console.log(`Received data from node ${senderIp}: ${message}`);
    portsender = message;
    if (senders.length === 0) {
      console.log("There is  no peer available for now");
    } else {
      ws.send(JSON.stringify(senders));
    }
    const address = `ws://${senderIp}:${message}`;
    const ipExists = senders.some((sender) => sender === address);
    if (!ipExists) {
      senders.push(address);
    }

    let filteredAddresses = senders.filter(
      (addressIp) => addressIp !== address
    );

    ws.send(JSON.stringify(filteredAddresses));
    console.log(senders);
    filteredAddresses = [];
  });

  ws.on("error", (err) => {
    console.error(`Error connecting to node: ${senderIp}: ${err}`);
  });

  // Handle disconnects
  ws.on("close", () => {
    console.log(`Disconnected from node : ${senderIp}:${portsender}`);
    portsender = "";
  });
});

wss.on("listening", () => {
  const address = wss.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});
