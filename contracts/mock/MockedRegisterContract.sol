
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interface/IPrecompileContract.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract MockedAIProjectRegister is IPrecompileContract {



    function getMachineCalcPoint(string memory machineId) public pure returns (uint256){
        return 1000;
    }
    function machineIsRegistered(string memory machineId,string memory projectName) public pure returns (bool){
        return true;
    }
    function getRentDuration(string memory msgToSign,string memory substrateSig,string memory substratePubKey,uint256 lastClaimAt, uint256 slashAt,string memory machineId) external pure returns (uint256 rentDuration){
        return 1000;
    }

    function addMachineRegisteredProject(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId,string memory projectName) external returns (bool success){
        return true;
    }

    function RemovalMachineRegisteredProject(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId,string memory projectName) external returns (bool success){
        return true;
    }

    function IsRegisteredMachineOwner(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId,string memory projectName) external pure returns (bool){
        return true;
    }
}
