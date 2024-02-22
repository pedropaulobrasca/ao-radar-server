var Cap = require("cap").Cap;
var decoders = require("cap").decoders;
const WebSocket = require("ws");
const ip = require("ip");
const fs = require("fs");

const PhotonParser = require("./scripts/classes/PhotonPacketParser");

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const getActiveIP = () => {
  const interfaces = ip.address();
  return interfaces;
};

var c = new Cap();
var device = Cap.findDevice(getActiveIP());
const filter = "udp and (dst port 5056 or src port 5056)";
var bufSize = 4096;
var buffer = Buffer.alloc(4096);
const manager = new PhotonParser();
var linkType = c.open(device, filter, bufSize, buffer);

c.setMinBytes && c.setMinBytes(0);

const server = new WebSocket.Server({ port: 5002, host: "localhost" });

if (device === null) {
  console.log("No active network interface found.");
  process.exit(0);
}

console.log("🔥 Listening on " + device);

server.on("connection", (socket, request) => {
  console.log("🟢 Connection established.");
  console.log("🟢 Total connections: " + server.clients.size);

  c.on("packet", function (nbytes, trunc) {
    let ret = decoders.Ethernet(buffer);
    ret = decoders.IPV4(buffer, ret.offset);
    ret = decoders.UDP(buffer, ret.offset);

    let payload = buffer.slice(ret.offset, nbytes);

    // Parse the UDP payload
    try {
      manager.handle(payload);
    } catch {}
  });

  manager.on("event", (dictonary) => {
    const dictionaryDataJSON = JSON.stringify(dictonary);
    server.clients.forEach(function (client) {
      client.send(
        JSON.stringify({ code: "event", dictionary: dictionaryDataJSON })
      );
    });
  });

  manager.on("request", (dictonary) => {
    const dictionaryDataJSON = JSON.stringify(dictonary);
    server.clients.forEach(function (client) {
      client.send(
        JSON.stringify({ code: "request", dictionary: dictionaryDataJSON })
      );
    });
  });

  manager.on("response", (dictonary) => {
    const dictionaryDataJSON = JSON.stringify(dictonary);
    server.clients.forEach(function (client) {
      client.send(
        JSON.stringify({ code: "response", dictionary: dictionaryDataJSON })
      );
    });
  });
});
