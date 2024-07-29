// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library MachineRoles {
    struct Role {
        mapping (bytes32 => bool) bearer;
    }

    function add(Role storage role, bytes32 member) internal {
        require(!has(role, member), "MachineRoles: member already has role");
        role.bearer[member] = true;
    }

    function remove(Role storage role,bytes32 member) internal {
        require(has(role, member), "MachineRoles: member does not have role");
        role.bearer[member] = false;
    }

    function has(Role storage role, bytes32  member) internal view returns (bool) {
        return role.bearer[member];
    }
}