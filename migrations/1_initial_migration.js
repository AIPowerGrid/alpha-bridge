const WrappedAIPG = artifacts.require("WrappedAIPG");

module.exports = function (deployer) {
  deployer.deploy(WrappedAIPG);
};
