// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PatriotPledgeNFTV3 is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    struct Campaign {
        string category;
        uint256 goal;
        uint256 grossRaised;
        uint256 netRaised;
        uint256 payoutEligible;
        uint256 payoutReleased;
        uint256 nonprofitFeeRate; // basis points, e.g. 100 = 1%
        address nonprofit; // custodial owner
        address submitter; // fundraiser/recipient
        bool closed;
    }

    mapping(uint256 => Campaign) public campaigns;

    event CampaignMinted(uint256 indexed tokenId, address indexed to, string uri, string category, uint256 goal, uint256 feeRate);
    event ContributionRecorded(uint256 indexed tokenId, uint256 gross, uint256 net, uint256 cardFees, uint256 nonprofitFee, bool isOnchain);
    event PayoutEligibleAdjusted(uint256 indexed tokenId, uint256 oldEligible, uint256 newEligible);
    event PayoutReleased(uint256 indexed tokenId, address indexed recipient, uint256 amount, bool onchain);
    event CampaignClosed(uint256 indexed tokenId);
    event WithdrawToCentral(address indexed recipient, uint256 amount);
    event CustodialTransfer(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor() ERC721("Patriot Pledge NFT", "PPNFT") Ownable(msg.sender) {}

    receive() external payable {}

    fallback() external payable {}

    function mint(
        address to,
        string calldata uri,
        string calldata category,
        uint256 goal,
        uint256 feeRate
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        campaigns[tokenId] = Campaign({
            category: category,
            goal: goal,
            grossRaised: 0,
            netRaised: 0,
            payoutEligible: 0,
            payoutReleased: 0,
            nonprofitFeeRate: feeRate,
            nonprofit: to,
            submitter: address(0),
            closed: false
        });

        emit CampaignMinted(tokenId, to, uri, category, goal, feeRate);
        return tokenId;
    }

    function setSubmitter(uint256 tokenId, address submitter) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        c.submitter = submitter;
    }

    function recordContribution(
        uint256 tokenId,
        uint256 gross,
        uint256 net,
        uint256 cardFees,
        uint256 nonprofitFee,
        bool isOnchain
    ) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        require(!c.closed, "campaign closed");

        c.grossRaised += gross;
        c.netRaised += net;
        c.payoutEligible += (net - nonprofitFee);

        emit ContributionRecorded(tokenId, gross, net, cardFees, nonprofitFee, isOnchain);
    }

    function adjustPayoutEligible(uint256 tokenId, uint256 newEligible) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        uint256 old = c.payoutEligible;
        c.payoutEligible = newEligible;
        emit PayoutEligibleAdjusted(tokenId, old, newEligible);
    }

    function markPayoutReleased(
        uint256 tokenId,
        uint256 amount,
        address payable recipient,
        bool onchain
    ) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        require(amount <= c.payoutEligible - c.payoutReleased, "amount exceeds eligible");

        c.payoutReleased += amount;

        if (onchain) {
            require(address(this).balance >= amount, "insufficient contract balance");
            (bool ok, ) = recipient.call{value: amount}("");
            require(ok, "transfer failed");
        }

        emit PayoutReleased(tokenId, recipient, amount, onchain);
    }

    function closeCampaign(uint256 tokenId) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        c.closed = true;
        emit CampaignClosed(tokenId);
    }

    function withdrawToCentral(uint256 amount, address payable recipient) external onlyOwner {
        require(address(this).balance >= amount, "insufficient contract balance");
        (bool ok, ) = recipient.call{value: amount}("");
        require(ok, "withdraw failed");
        emit WithdrawToCentral(recipient, amount);
    }

    function transferNFT(uint256 tokenId, address newOwner) external onlyOwner {
        address from = ownerOf(tokenId);
        _update(newOwner, tokenId, from);
        emit CustodialTransfer(tokenId, from, newOwner);
    }

    function addRaised(uint256 tokenId, uint256 amount) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        c.grossRaised += amount;
        c.netRaised += amount;
        c.payoutEligible += amount;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
