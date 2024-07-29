// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAIProjectRegister {
    function getMachineCalcPoint(string memory machineId) external view returns (uint256 calcPoint);
    function machineIsRegistered(string memory machineId,string memory projectName) external view returns (bool isRegistered);
    function getRentDuration(string memory msgToSign,string memory substrateSig,string memory substratePubKey,uint256 lastClaimAt,uint256 slashClaimAt, string memory machineId) external view returns (uint256 rentDuration);
    function addMachineRegisteredProject(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId,string memory projectName) external returns (bool success);
    function RemovalMachineRegisteredProject(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId,string memory projectName) external returns (bool success);
    function IsRegisteredMachineOwner(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId,string memory projectName) external view returns (bool isOwner);
}