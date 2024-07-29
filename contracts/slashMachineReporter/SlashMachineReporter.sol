// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;


contract SlashMachineReporter {
    struct reportInfo{
        address reporter;
        string machineId;
        uint256 reportAt;
    }

    uint256 public reporterShouldReservedAmount;
    mapping(string => reportInfo) public timeoutMachine2ReportInfo;
    mapping(string => reportInfo) public offlineMachine2ReportInfo;
    mapping(address => uint256) public reporter2Reserved;


    event reportedTimeoutNode(address indexed reporter, string nodeId);
    event reportedOfflineNode(address indexed reporter, string nodeId);

    event reservedReporterAmount(address reporter,uint256 amount);
    event unreservedReporterAmount(address reporter,uint256 amount);

    function _setReporterShouldReservedAmount(uint256 _amount) internal  {
         reporterShouldReservedAmount = _amount;
    }

    function _shouldReservedAmount() internal view returns(bool) {
        return reporterShouldReservedAmount >0;
    }

    function _setTimeoutReportInfo(string calldata machineId) internal {
        if (_shouldReservedAmount()){
            require(msg.value > reporterShouldReservedAmount, "Invalid report amount");
            reporter2Reserved[msg.sender] = msg.value;
            emit reservedReporterAmount(msg.sender,msg.value);
        }

        timeoutMachine2ReportInfo[machineId] = reportInfo({
            reporter: msg.sender,
            machineId: machineId,
            reportAt: block.timestamp
        });

        emit reportedTimeoutNode(msg.sender, machineId);
    }

    function _setOfflineReportInfo(string calldata machineId) internal {
        if (_shouldReservedAmount()){
            require(msg.value > reporterShouldReservedAmount, "Invalid report amount");
            reporter2Reserved[msg.sender] = msg.value;
            emit reservedReporterAmount(msg.sender,msg.value);
        }

        offlineMachine2ReportInfo[machineId] = reportInfo({
            reporter: msg.sender,
            machineId: machineId,
            reportAt: block.timestamp
        });
        emit reportedTimeoutNode(msg.sender, machineId);
    }
}