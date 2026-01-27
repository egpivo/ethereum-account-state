// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Token} from "../src/Token.sol";

/**
 * @title DeploySepolia
 * @notice Deployment script for Token contract on Sepolia testnet
 */
contract DeploySepolia is Script {
    function run() external returns (Token) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        Token token = new Token();
        
        console.log("Token deployed at:", address(token));
        console.log("Initial totalSupply:", uint256(token.totalSupply()));
        console.log("Deployer address:", vm.addr(deployerPrivateKey));

        vm.stopBroadcast();
        return token;
    }
}
