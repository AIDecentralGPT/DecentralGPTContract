// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MockedRewardToken is ERC20 {

    constructor() ERC20("MyToken", "MTK")  {
        _mint(msg.sender, 600_000_000_000 * 10 ** decimals());
    }

}
