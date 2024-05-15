// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WrappedAIPG is ERC20 {
    address public admin;

    constructor() ERC20("Wrapped AI Power Grid", "wAIPG") {
        admin = msg.sender; //Dev is initial admin
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == admin, "Only admin can mint tokens");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == admin, "Only admin can burn tokens");
        _burn(from, amount);
   }
}
