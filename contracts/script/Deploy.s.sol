// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Token} from "../src/Token.sol";

/**
 * @title DeployScript
 * @notice Deployment script for Token contract
 */
contract DeployScript is Script {
    function run() external returns (Token) {
        vm.startBroadcast();

        Token token = new Token();
        
        console.log("Token deployed at:", address(token));
        console.log("Initial totalSupply:", uint256(token.totalSupply()));

        vm.stopBroadcast();
        return token;
    }
}
