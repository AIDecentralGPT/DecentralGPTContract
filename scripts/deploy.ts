
import dotenv from 'dotenv';
import {bigint} from "hardhat/internal/core/params/argumentTypes";
const { ethers} = require("hardhat");
dotenv.config();

async function main() {
    const contractFactory = await ethers.getContractFactory("Staking");
    const upgrade = await upgrades.deployProxy(contractFactory , [process.env.OWNER,process.env.TOKEN,BigInt(1000*10**18),process.env.REGISTER_CONTRACT], { initializer: 'initialize' });
    console.log("deployed to:", upgrade.target);
}

main();