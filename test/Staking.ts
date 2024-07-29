import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

const { waffle } = require("hardhat");


describe("Lock", function () {
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

    describe("Staking should work", function () {
        it("Staking should work correctly", async function () {
            const { staking,rewardToken,stakingOwner,otherAccount } = await loadFixture(deployContracts);
            // stake with reserved amount should be approved first
            await expect(staking.stake("msg","sign","pubKey","machineId",1)).to.be.reverted;
            expect(await staking.stake("msg","sign","pubKey","machineId",0)).to.be.ok;
            await expect(staking.stake("msg","sign","pubKey","machineId",0)).to.be.revertedWith("machine already staked");

            const reserveAmount = BigInt(1000*10**18);
            await rewardToken.approve(staking.getAddress(), reserveAmount, { from: stakingOwner.address });
            expect(await staking.stake("msg","sign","pubKey","machineId1",reserveAmount)).to.be.ok;
            expect(await staking.stakeholder2Reserved(stakingOwner.getAddress())).to.be.equal(reserveAmount);

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
