require('dotenv').config();
const { getRPC, methods } = require("@ravenrebels/ravencoin-rpc");
//methods is a list of all available methods/functions/commands/procedures

const method = methods.listreceivedbyaddress;
const minConfirmations = 1;
const includeEmpty = true;

const params = [minConfirmations, includeEmpty];
const user = process.env.AUSER;
const passwd = process.env.APASS;
const connect = "http://localhost:9788";

const rpc = getRPC(user, passwd, connect);

const promise = rpc(method, params);
promise.catch((e) => {
  console.dir(e);
});

promise.then((response) => {
  const addresses = [];
  response.map(function (obj) {
    addresses.push(obj.address);
  });
  writeToFile(addresses);
  console.log("DONE, check out addresses.json");
});

function writeToFile(list){
    const json = JSON.stringify(list, null, 4);
    require("fs").writeFileSync("./addresses.json", json);

}
