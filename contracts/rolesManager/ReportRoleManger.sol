// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../lib/Roles.sol";


contract ReporterRoleManager {
    using Roles for Roles.Role;
    Roles.Role private reporterRole;

    event addedReporterRoles(address[] indexed);
    event removedReporterRole(address indexed);

    function _isReporterRole(address target) public view returns(bool) {
        return reporterRole.has(target);
    }


    function _addReporterRoles(address[] memory targets) internal {
        for (uint256 i = 0; i < targets.length; i++) {
            reporterRole.add(targets[i]);
        }
        emit addedReporterRoles(targets);
    }

    function _removeReporterRole(address target) internal {
        reporterRole.remove(target);
        emit removedReporterRole(target);
    }
}