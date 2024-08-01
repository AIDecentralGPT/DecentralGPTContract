compile:
	npx hardhat compile

deploy:
	npx hardhat run scripts/deploy.ts --network dbcTestnet

upgrade:
	npx hardhat run scripts/upgrade.ts --network dbcTestnet

verify:
    npx hardhat  verify  --network dbcTestnet 0xCd5B7a2FFf4798262Dfa0e1bE6747f7EfDCb852C



