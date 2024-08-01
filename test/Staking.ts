import {
    time,
    loadFixture,
    mine,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import {bigint} from "hardhat/internal/core/params/argumentTypes";

const { waffle } = require("hardhat");



describe("Staking", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployContracts() {

        // const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
        // const ONE_GWEI = 1_000_000_000;
        //
        // const lockedAmount = ONE_GWEI;
        // const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

        // Contracts are deployed using the first signer/account by default
        const [stakingOwner, otherAccount] = await hre.ethers.getSigners();


        const mockedRewardToken = await hre.ethers.getContractFactory("MockedRewardToken");
        const rewardToken = await mockedRewardToken.deploy();

        const mockedAIProjectRegister = await hre.ethers.getContractFactory("MockedAIProjectRegister");
        const aiProjectRegister = await mockedAIProjectRegister.deploy();


        const Staking = await hre.ethers.getContractFactory("Staking");
        const staking = await Staking.deploy();
        await staking.initialize(stakingOwner.address, rewardToken.getAddress(),BigInt(10*10**18),aiProjectRegister.getAddress());

        await rewardToken.transfer(staking.getAddress(), BigInt(10000000 * 10**18), { from: stakingOwner.address })

        return { staking, rewardToken, stakingOwner, otherAccount };
    }

    describe("Deployment", function () {
        it("Deployment should succeed", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);
            expect(await rewardToken.balanceOf(staking.getAddress())).to.equal(BigInt(10000000 * 10**18));
            expect(await staking.owner()).to.equal(stakingOwner.address);
        });
    });

    describe("Stake should work", function () {
        it("Stake should work correctly", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);
            // stake with reserved amount should be approved first
            await expect(staking.stake("msg","sign","pubKey","machineId",1)).to.be.reverted;
            expect(await staking.stake("msg","sign","pubKey","machineId",0)).to.be.ok;
            await expect(staking.stake("msg","sign","pubKey","machineId",0)).to.be.revertedWith("machine already staked");

            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey","machineId1",reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(await stakingOwner.getAddress())).to.be.equal(reserveAmount);
            expect(await staking.isStaking("machineId1")).to.be.equal(true);
            expect(await staking.getStakeHolder("machineId1")).to.be.equal(await stakingOwner.getAddress());

            // reserved amount should be reduced after slash
            expect(await staking.machineId2LeftSlashAmount("machineId1")).to.be.equal(0);
            expect(await staking.reportTimeoutMachine("machineId1")).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(0);
            expect(await staking.machineId2LeftSlashAmount("machineId1")).to.be.equal(BigInt(9000*10**18));

            // stake with less than slashed amount should be rejected
            await expect(staking.stake("msg","sign","pubKey","machineId1",0)).to.be.reverted;
            await expect(staking.stake("msg","sign","pubKey","machineId1",BigInt(8999*10**18))).to.be.reverted;

            const reserveAmountMoreThanSlash = BigInt(10000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmountMoreThanSlash, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey","machineId1",reserveAmountMoreThanSlash)).to.be.ok;
            expect(await staking.machineId2LeftSlashAmount("machineId1")).to.be.equal(0);
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(BigInt(1000*10**18));
        });
    });

    describe("Claim should work", function () {
        it("Claim without slash should work correctly", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);

            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey","machineId1",reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);

            // stake duration mocked 1000s, so the reward amount should be 1000*10 *10**18
            const amount = BigInt(1000*10 *10**18);
            expect(await staking.getRewardAmountCanClaim("msg","sign","pubKey","machineId1")).to.be.equal(amount);
            expect(await staking.getReward("msg","sign","pubKey","machineId1")).to.be.equal(amount);

            const tokenAmountBeforeClaim = await rewardToken.balanceOf(stakingOwner.address);
            expect(await staking.claim("msg","sign","pubKey","machineId1")).to.be.ok;
            expect(await rewardToken.balanceOf(stakingOwner.address)).to.be.equal(tokenAmountBeforeClaim+amount);
        });

        it("Claim with slash should work correctly", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);

            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey","machineId1",reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);

            // stake duration mocked 1000s, so the reward amount should be 1000*10 *10**18
            const amount = BigInt(1000*10 *10**18);
            expect(await staking.getRewardAmountCanClaim("msg","sign","pubKey","machineId1")).to.be.equal(amount);
            expect(await staking.getReward("msg","sign","pubKey","machineId1")).to.be.equal(amount);

            expect(await staking.reportTimeoutMachine("machineId1")).to.be.ok;
            const leftSlashAmount = await staking.baseReserveAmount()-reserveAmount;
            expect(await staking.machineId2LeftSlashAmount("machineId1")).to.be.equal(leftSlashAmount);
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(0);

            expect(await staking.getReward("msg","sign","pubKey","machineId1")).to.be.equal(amount);
            expect(await staking.getRewardAmountCanClaim("msg","sign","pubKey","machineId1")).to.be.equal(amount-leftSlashAmount);

            const tokenAmountBeforeClaim = await rewardToken.balanceOf(stakingOwner.address);
            expect(await staking.claim("msg","sign","pubKey","machineId1")).to.be.ok;
            expect(await rewardToken.balanceOf(stakingOwner.address)).to.be.equal(tokenAmountBeforeClaim+amount-leftSlashAmount);
        });

        it("Claim with setting setNonlinearCoefficient should work correctly", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);

            expect(await staking.setNonlinearCoefficient(10)).to.be.ok;
            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey","machineId1",reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);

            // stake duration mocked 1000s, so the reward amount should be 1000*10 *10**18
            const amount = BigInt(1000*10 *10**18);
            expect(await staking.getRewardAmountCanClaim("msg","sign","pubKey","machineId1")).to.be.gt(amount);
            expect(await staking.getReward("msg","sign","pubKey","machineId1")).to.be.gt(amount);
        });
    });

    describe("reportTimeoutMachine should work", function () {
        it("reportTimeoutMachine should work", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);

            const machineId = "machineId1";
            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey",machineId,reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);
            expect(await staking.isStaking(machineId)).to.be.equal(true);

            await expect(staking.connect(otherAccount).reportTimeoutMachine(machineId)).to.be.reverted;
            expect(await staking.addReporterRoles([otherAccount.getAddress()])).to.be.ok;
            expect(await staking.connect(otherAccount).reportTimeoutMachine(machineId)).to.be.ok;
            expect(await staking.isStaking(machineId)).to.be.equal(false);
            await expect(staking.connect(otherAccount).reportTimeoutMachine(machineId)).to.be.revertedWith("machine fault already reported");
            const leftSlashAmount = await staking.baseReserveAmount()-reserveAmount;
            expect(await staking.machineId2LeftSlashAmount(machineId)).to.be.equal(leftSlashAmount);
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(0);
        });

        it("can not reportTimeoutMachine after removed role", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);

            const machineId = "machineId1";
            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey",machineId,reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);

            await expect(staking.connect(otherAccount).reportTimeoutMachine(machineId)).to.be.reverted;
            expect(await staking.addReporterRoles([otherAccount.getAddress()])).to.be.ok;
            expect(await staking.removeReporterRole(otherAccount.getAddress())).to.be.ok;
            await expect(staking.connect(otherAccount).reportTimeoutMachine(machineId)).to.be.reverted;
        });
    });

    describe("unstake should work", function () {
        it("unstake should work", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);

            const machineId = "machineId1";
            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey",machineId,reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);
            expect(await staking.isStaking(machineId)).to.be.equal(true);
            const amountAfterStake = await rewardToken.balanceOf(stakingOwner.getAddress());
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);
            expect(await staking.unStakeAndClaim("msg","sign","pubKey",machineId)).to.be.ok;
            expect(await rewardToken.balanceOf(stakingOwner.getAddress())).to.be.equal(amountAfterStake+reserveAmount+BigInt(10000*10**18));
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(0);
            const stakeInfo = await staking.address2StakeInfos(await stakingOwner.getAddress(),machineId);
            expect(stakeInfo.endAtBlockNumber).to.be.not.equal(0);
        });
    });



    // describe("Withdrawals", function () {
    //     describe("Validations", function () {
    //         it("Should revert with the right error if called too soon", async function () {
    //             const { lock } = await loadFixture(deployOneYearLockFixture);
    //
    //             await expect(lock.withdraw()).to.be.revertedWith(
    //                 "You can't withdraw yet"
    //             );
    //         });
    //
    //         it("Should revert with the right error if called from another account", async function () {
    //             const { lock, unlockTime, otherAccount } = await loadFixture(
    //                 deployOneYearLockFixture
    //             );
    //
    //             // We can increase the time in Hardhat Network
    //             await time.increaseTo(unlockTime);
    //
    //             // We use lock.connect() to send a transaction from another account
    //             await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
    //                 "You aren't the owner"
    //             );
    //         });
    //
    //         it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
    //             const { lock, unlockTime } = await loadFixture(
    //                 deployOneYearLockFixture
    //             );
    //
    //             // Transactions are sent using the first signer by default
    //             await time.increaseTo(unlockTime);
    //
    //             await expect(lock.withdraw()).not.to.be.reverted;
    //         });
    //     });
    //
    //     describe("Events", function () {
    //         it("Should emit an event on withdrawals", async function () {
    //             const { lock, unlockTime, lockedAmount } = await loadFixture(
    //                 deployOneYearLockFixture
    //             );
    //
    //             await time.increaseTo(unlockTime);
    //
    //             await expect(lock.withdraw())
    //                 .to.emit(lock, "Withdrawal")
    //                 .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
    //         });
    //     });
    //
    //     describe("Transfers", function () {
    //         it("Should transfer the funds to the owner", async function () {
    //             const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
    //                 deployOneYearLockFixture
    //             );
    //
    //             await time.increaseTo(unlockTime);
    //
    //             await expect(lock.withdraw()).to.changeEtherBalances(
    //                 [owner, lock],
    //                 [lockedAmount, -lockedAmount]
    //             );
    //         });
    //     });
    // });
});
