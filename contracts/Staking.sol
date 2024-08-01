// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "./lib/MachineRoles.sol";
import "./lib/Roles.sol";
import "./interface/IPrecompileContract.sol";
import "./rolesManager/ReportRoleManger.sol";
import "./slashMachineReporter/SlashMachineReporter.sol";

contract Staking is Initializable, OwnableUpgradeable,ReporterRoleManager,SlashMachineReporter{
//    using Math for uint256;
    IPrecompileContract public registerContract;
    uint256 public constant secondsPerBlock = 30;
    IERC20 public rewardToken;
    uint256 public rewardAmountPerSecond;
    uint256 public constant baseReserveAmount = 10_000 * 10**18;
    string public constant projectName = "dgc";

    uint256 public totalStakedMachineMultiCalcPoint;
    uint256 public nonlinearCoefficient;

    mapping(address => uint256) public stakeholder2Reserved;
    mapping(string => address) public machineId2Address;

    struct StakeInfo {
        uint256 startAtBlockNumber;
        uint256 lastClaimAtBlockNumber;
        uint256 endAtBlockNumber;
        uint256 calcPoint;
        uint256 reservedAmount;
        uint256 slashAt;
    }

    enum ReportType{
        Timeout,
        Offline
    }

    mapping(string => uint256) public machineId2LeftSlashAmount;
    mapping(address => mapping(string => StakeInfo)) public address2StakeInfos;


    event baseRewardAmountPerSecondChanged(uint256 baseRewardAmountPerSecond);
    event nonlinearCoefficientChanged(uint256 nonlinearCoefficient);


    event staked(address indexed stakeholder, string machineId,uint256 stakeAtBlockNumber);
    event unStaked(address indexed stakeholder, string machineId, uint256 unStakeAtBlockNumber);
    event claimed(address indexed stakeholder, string machineId, uint256 rewardAmount,uint256 slashAmount, uint256 claimAtBlockNumber);
    event claimedAll(address indexed stakeholder, uint256 claimAtBlockNumber);

    function initialize(address _initialOwner, address _rewardToken, uint256 _rewardAmountPerSecond,address _registerContract) public initializer {
        __Ownable_init(_initialOwner);
        rewardToken = IERC20(_rewardToken);
        rewardAmountPerSecond = _rewardAmountPerSecond;
        registerContract = IPrecompileContract(_registerContract);
    }

    function setRegisterContract(address _registerContract) onlyOwner external {
        registerContract = IPrecompileContract(_registerContract);
    }


    function claimLeftRewardTokens() external onlyOwner {
        uint256 balance = rewardToken.balanceOf(address(this));
        rewardToken.transfer(msg.sender, balance);
    }

    function rewardTokenBalance() public onlyOwner view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    function setRewardToken(address token) onlyOwner external  {
        rewardToken = IERC20(token);
    }

    function setBaseRewardAmountPerSecond(
        uint256 _rewardAmountPerSecond
    ) public onlyOwner {
        rewardAmountPerSecond = _rewardAmountPerSecond;
        emit baseRewardAmountPerSecondChanged(_rewardAmountPerSecond);
    }

    function setNonlinearCoefficient(uint256 value) public onlyOwner {
        nonlinearCoefficient = value;
        emit nonlinearCoefficientChanged(value);
    }

    function stake(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId,uint256 amount) external {

        address stakeholder = msg.sender;
        require(stakeholder != address(0), "Invalid stakeholder address");
        require(machineIsRegistered(machineId), "machine not registered");
        require(isRegisteredMachineOwner(msgToSign,substrateSig,substratePubKey,machineId),"registered machine owner check failed");

        StakeInfo storage stakeInfo = address2StakeInfos[stakeholder][machineId];
        if (stakeInfo.slashAt > 0){
            uint256 shouldSlashAmount = machineId2LeftSlashAmount[machineId];
            require(amount >= shouldSlashAmount,"should pay slash amount before stake");
            rewardToken.transferFrom(stakeholder, address(this), shouldSlashAmount);
            amount -= shouldSlashAmount;
            machineId2LeftSlashAmount[machineId] = 0;
        } else {
            require(stakeInfo.startAtBlockNumber == 0, "machine already staked");
            require(stakeInfo.endAtBlockNumber == 0, "machine staked not end");
        }

        stakeholder2Reserved[stakeholder] +=amount;
        if (amount > 0) {
            rewardToken.transferFrom(stakeholder, address(this), amount);
        }

        uint256 calcPoint = getMachineCalcPoint(machineId);
        uint256 currentTime = block.number;
        address2StakeInfos[stakeholder][machineId] = StakeInfo({
            startAtBlockNumber: currentTime,
            lastClaimAtBlockNumber: currentTime,
            endAtBlockNumber: 0,
            calcPoint: calcPoint,
            reservedAmount: amount,
            slashAt: 0
        });

        machineId2Address[machineId] = stakeholder;
        totalStakedMachineMultiCalcPoint+= calcPoint;
        emit staked(stakeholder, machineId, block.number);
    }

    function getMachineCalcPoint(string memory machineId) internal view returns (uint256) {
        return registerContract.getMachineCalcPoint(machineId);
    }

    function machineIsRegistered(string memory machineId) public view returns (bool) {
        return registerContract.machineIsRegistered(machineId,projectName);
    }

    function getRentDuration(string memory msgToSign,string memory substrateSig,string memory substratePubKey,uint256 lastClaimAt,uint256 slashAt, string memory machineId) public view returns (uint256) {
        return registerContract.getRentDuration(msgToSign,substrateSig,substratePubKey,lastClaimAt,slashAt,machineId);
    }

    function isRegisteredMachineOwner(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId) public view returns (bool){
        return registerContract.IsRegisteredMachineOwner(msgToSign,substrateSig,substratePubKey,machineId,projectName);
    }


    function _getTotalRewardAmount(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId, StakeInfo storage stakeInfo) internal view returns (uint256) {
        if (stakeInfo.lastClaimAtBlockNumber == 0){
            return 0;
        }

        uint256 rewardDuration = _getRewardDuration(msgToSign,substrateSig,substratePubKey,stakeInfo.lastClaimAtBlockNumber,stakeInfo.slashAt,machineId);
        uint256 totalBaseReward = rewardAmountPerSecond* rewardDuration;



        uint256 _totalStakedMachineMultiCalcPoint = totalStakedMachineMultiCalcPoint;
        if (stakeInfo.slashAt > 0){
            _totalStakedMachineMultiCalcPoint += stakeInfo.calcPoint;
        }
        uint256 baseRewardAmount = totalBaseReward * stakeInfo.calcPoint / _totalStakedMachineMultiCalcPoint;
        uint256 value = 0;
        if (stakeInfo.reservedAmount > baseReserveAmount) {
            value = stakeInfo.reservedAmount - baseReserveAmount;
        }
        uint256 tmp = 1 + value/baseReserveAmount;
        int128 ln = ABDKMath64x64.fromUInt(tmp);
        uint256 totalRewardAmount = baseRewardAmount* (1+nonlinearCoefficient *ABDKMath64x64.toUInt(ln));

        return totalRewardAmount;
    }

    function getRewardAmountCanClaim(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId) public view returns (uint256) {
        address stakeholder = machineId2Address[machineId];
        StakeInfo storage stakeInfo = address2StakeInfos[stakeholder][machineId];

        uint256 totalRewardAmount = _getTotalRewardAmount(msgToSign,substrateSig,substratePubKey,machineId,stakeInfo);
        uint256 slashAmount = machineId2LeftSlashAmount[machineId];
        if (slashAmount > 0){
            if ( totalRewardAmount >= slashAmount){
                return totalRewardAmount - slashAmount;
            }else{
                return 0;
            }
        }
        return totalRewardAmount;
    }

    function _getRewardDuration(string memory msgToSign,string memory substrateSig,string memory substratePubKey,uint256 lastClaimAt,uint256 slashAt, string memory machineId) internal view returns(uint256) {
        return getRentDuration(msgToSign,substrateSig,substratePubKey, lastClaimAt,slashAt,machineId);
    }

    function getReward(string memory msgToSign, string memory substrateSig,string memory substratePubKey,string memory machineId) external view returns (uint256) {
        address stakeholder = machineId2Address[machineId];
        StakeInfo storage stakeInfo = address2StakeInfos[stakeholder][machineId];
        return _getTotalRewardAmount(msgToSign,substrateSig,substratePubKey,machineId, stakeInfo);
    }

    function claim(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string memory machineId) public canClaim(machineId) {
        address stakeholder = msg.sender;
        StakeInfo storage stakeInfo = address2StakeInfos[stakeholder][machineId];

        uint256 rewardAmount = _getTotalRewardAmount(msgToSign,substrateSig,substratePubKey,machineId,stakeInfo);
        uint256 slashAmount = machineId2LeftSlashAmount[machineId];

        if (slashAmount > 0){
            if (rewardAmount >= slashAmount) {
                rewardAmount = rewardAmount - slashAmount;
                machineId2LeftSlashAmount[machineId] = 0;
            }else {
                rewardAmount = 0;
                uint256 leftSlashAmount = slashAmount-rewardAmount;
                uint256 reservedAmount = stakeholder2Reserved[stakeholder];
                if (reservedAmount >= leftSlashAmount){
                    stakeholder2Reserved[stakeholder] = reservedAmount-leftSlashAmount;
                }else{
                    stakeholder2Reserved[stakeholder] = 0;
                }
            }
        }

        if (rewardAmount > 0){
            rewardToken.transfer(stakeholder, rewardAmount);
        }
        stakeInfo.lastClaimAtBlockNumber = block.number;

        emit claimed(stakeholder, machineId, rewardAmount,slashAmount, block.number);
    }

    modifier canClaim(string memory machineId) {
        address stakeholder = machineId2Address[machineId];
        require(stakeholder != address(0), "Invalid stakeholder address");
        require(
            address2StakeInfos[stakeholder][machineId].startAtBlockNumber > 0,
            "staking not found"
        );

        require(machineId2Address[machineId]!= address(0), "machine not found");
        _;
    }

    function unStakeAndClaim(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string calldata machineId) public {
        address stakeholder = msg.sender;
        require(
            address2StakeInfos[stakeholder][machineId].startAtBlockNumber > 0,
            "staking not found"
        );

        require(machineId2Address[machineId]!= address(0), "machine not found");
        _unStakeAndClaim(msgToSign,substrateSig,substratePubKey,machineId,stakeholder);
    }

    function _unStakeAndClaim(string memory msgToSign,string memory substrateSig,string memory substratePubKey,string calldata machineId,address stakeholder) internal {
        claim(msgToSign,substrateSig,substratePubKey,machineId);
        uint256 reservedAmount = stakeholder2Reserved[stakeholder];
        if (reservedAmount > 0) {
            stakeholder2Reserved[stakeholder] = 0;
            rewardToken.transfer(stakeholder, reservedAmount);
        }

        uint256 currentTime = block.number;
        StakeInfo storage stakeInfo =  address2StakeInfos[stakeholder][machineId];
        stakeInfo .endAtBlockNumber = currentTime;
        machineId2Address[machineId]= address(0);
        totalStakedMachineMultiCalcPoint -= stakeInfo .calcPoint;
        emit unStaked(msg.sender,machineId, currentTime);
    }

    function getStakeHolder(string calldata machineId) external view returns(address)  {
        return machineId2Address[machineId];
    }

    function isStaking(string calldata machineId) public view returns(bool)  {
        address stakeholder = machineId2Address[machineId];
        StakeInfo storage stakeInfo = address2StakeInfos[stakeholder][machineId];
        return stakeholder != address(0) && stakeInfo.startAtBlockNumber > 0 && stakeInfo.endAtBlockNumber == 0 &&stakeInfo.slashAt == 0;
    }

    function reportTimeoutMachine(string calldata machineId)  external {
        slashFaultMachine(machineId,ReportType.Timeout);
    }

    function reportOfflineMachine(string calldata machineId)  external {
        slashFaultMachine(machineId,ReportType.Offline);
    }

    function slashFaultMachine(string calldata machineId,ReportType reportType) public onlyOwnerOrReporterRole {
        address stakeholder = machineId2Address[machineId];
        StakeInfo storage stakeInfo = address2StakeInfos[stakeholder][machineId];
        require(stakeInfo.slashAt == 0, "machine fault already reported");
        uint256 reserved = stakeholder2Reserved[stakeholder];
        if (reserved > 0 && reserved >= baseReserveAmount) {
            uint256 leftAmount = reserved-baseReserveAmount;
            stakeholder2Reserved[stakeholder] = leftAmount;
        }else{
            if (reserved > 0) {
                stakeholder2Reserved[stakeholder] = 0;
            }
            machineId2LeftSlashAmount[machineId] +=baseReserveAmount-reserved;
        }

        stakeInfo.slashAt = block.number;
        totalStakedMachineMultiCalcPoint -=stakeInfo.calcPoint;

        if (reportType == ReportType.Timeout){
            _setTimeoutReportInfo(machineId);
        }else if (reportType == ReportType.Offline){
            _setOfflineReportInfo(machineId);
        }
    }


    modifier onlyOwnerOrReporterRole() {
        require(
            msg.sender == owner() || _isReporterRole(msg.sender) ,
            "Invalid caller"
        );
        _;
    }

    function addReporterRoles(address[] memory targets) public onlyOwner {
        _addReporterRoles(targets);
    }

    function removeReporterRole(address target) external onlyOwner {
        _removeReporterRole(target);
    }
}