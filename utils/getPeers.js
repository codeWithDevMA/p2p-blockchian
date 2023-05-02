const WebSocket = require("ws");
const privateIp = require("../utils/getAddress");
console.log(privateIp);

exports.getPeers = (port) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${privateIp}:4000`);

    ws.addEventListener("open", () => {
      console.log("Connected to server");
      ws.send(port);
    });

    ws.addEventListener("message", (event) => {
      console.log("Received data from server:", event.data);
      resolve(JSON.parse(event.data));
    });

    ws.addEventListener("error", (error) => {
      console.error("Error connecting to server:", error);
      reject(error);
    });

    ws.addEventListener("close", () => {
      console.log("Disconnected from server");
    });
  });
};

// const WebSocket = require("ws");
// const ws = new WebSocket("ws://192.168.8.103:3000");
// exports.GetPeers = async() => {
//   let data;
//   ws.addEventListener("open", () => {
//     console.log("Connected to server");
//   });

//   ws.addEventListener("message", (event) => {
//     data = JSON.parse(event.data);
//     console.log("Received data from server:", data);
//   });

//   ws.addEventListener("error", (error) => {
//     console.error("Error connecting to server:", error);
//   });

//   ws.addEventListener("close", () => {
//     console.log("Disconnected from server");
//   });

//   return data;
// };
