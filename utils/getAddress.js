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

module.exports = privateIp;
