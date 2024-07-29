compile:
	npx hardhat compile

deploy:
	npx hardhat run scripts/deploy.ts --network dbcTestnet

upgrade:
	npx hardhat run scripts/upgrade.ts --network dbcTestnet

verify:
    npx hardhat  verify  --network dbcTestnet 0x20e85a85972a35651470476e26E951B746001974


