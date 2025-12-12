// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PatriotPledgeNFTV4
 * @notice Dynamic fundraising NFTs with on-chain tip tracking
 * @dev Tips are held on-chain; nonprofit has discretion to release to fundee
 */
contract PatriotPledgeNFTV4 is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    struct Campaign {
        string category;           // "veteran" or "general"
        uint256 goal;              // Fundraising goal in wei/smallest unit
        uint256 grossRaised;       // Total raised before any fees
        uint256 netRaised;         // After card fees deducted
        uint256 payoutEligible;    // Amount eligible for payout to fundee
        uint256 payoutReleased;    // Amount already paid out to fundee
        uint256 nonprofitFeeRate;  // Basis points, e.g. 100 = 1%
        uint256 tipsReceived;      // Total tips received (held by nonprofit)
        uint256 tipsReleasedToFundee; // Tips released to fundee at nonprofit discretion
        address nonprofit;         // Custodial owner (nonprofit wallet)
        address submitter;         // Fundraiser/recipient
        bool closed;               // Campaign closed flag
    }

    mapping(uint256 => Campaign) public campaigns;

    // Events
    event CampaignMinted(
        uint256 indexed tokenId,
        address indexed to,
        string uri,
        string category,
        uint256 goal,
        uint256 feeRate
    );
    
    event ContributionRecorded(
        uint256 indexed tokenId,
        uint256 gross,
        uint256 net,
        uint256 cardFees,
        uint256 nonprofitFee,
        bool isOnchain
    );
    
    event TipRecorded(
        uint256 indexed tokenId,
        uint256 tipAmount,
        bool isOnchain
    );
    
    event TipReleasedToFundee(
        uint256 indexed tokenId,
        address indexed fundee,
        uint256 amount
    );
    
    event PayoutEligibleAdjusted(
        uint256 indexed tokenId,
        uint256 oldEligible,
        uint256 newEligible
    );
    
    event PayoutReleased(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount,
        bool onchain
    );
    
    event CampaignClosed(uint256 indexed tokenId);
    event WithdrawToCentral(address indexed recipient, uint256 amount);
    event CustodialTransfer(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor() ERC721("Patriot Pledge NFT", "PPNFT") Ownable(msg.sender) {}

    // Allow contract to receive native tokens
    receive() external payable {}
    fallback() external payable {}

    /**
     * @notice Mint a new campaign NFT
     * @param to The nonprofit address that will hold the NFT
     * @param uri The metadata URI for the NFT
     * @param category "veteran" or "general"
     * @param goal The fundraising goal
     * @param feeRate Nonprofit fee in basis points (100 = 1%)
     */
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
            tipsReceived: 0,
            tipsReleasedToFundee: 0,
            nonprofit: to,
            submitter: address(0),
            closed: false
        });

        emit CampaignMinted(tokenId, to, uri, category, goal, feeRate);
        return tokenId;
    }

    /**
     * @notice Set the submitter (fundee) address for a campaign
     */
    function setSubmitter(uint256 tokenId, address submitter) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        c.submitter = submitter;
    }

    /**
     * @notice Record a contribution (purchase) to a campaign
     * @param tokenId The campaign token ID
     * @param gross Gross amount before fees
     * @param net Net amount after card fees
     * @param cardFees Card processing fees deducted
     * @param nonprofitFee Fee going to nonprofit
     * @param isOnchain True if this was an on-chain crypto payment
     */
    function recordContribution(
        uint256 tokenId,
        uint256 gross,
        uint256 net,
        uint256 cardFees,
        uint256 nonprofitFee,
        bool isOnchain
    ) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        require(!c.closed, "Campaign closed");

        c.grossRaised += gross;
        c.netRaised += net;

        emit ContributionRecorded(tokenId, gross, net, cardFees, nonprofitFee, isOnchain);
    }

    /**
     * @notice Record a tip to a campaign (held by nonprofit)
     * @param tokenId The campaign token ID
     * @param tipAmount The tip amount
     * @param isOnchain True if this was an on-chain crypto payment
     */
    function recordTip(
        uint256 tokenId,
        uint256 tipAmount,
        bool isOnchain
    ) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        require(!c.closed, "Campaign closed");

        c.tipsReceived += tipAmount;
        // Tips also count toward gross raised for transparency
        c.grossRaised += tipAmount;

        emit TipRecorded(tokenId, tipAmount, isOnchain);
    }

    /**
     * @notice Record contribution AND tip in a single call (gas efficient)
     */
    function recordContributionWithTip(
        uint256 tokenId,
        uint256 gross,
        uint256 net,
        uint256 cardFees,
        uint256 nonprofitFee,
        uint256 tipAmount,
        bool isOnchain
    ) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        require(!c.closed, "Campaign closed");

        c.grossRaised += gross + tipAmount;
        c.netRaised += net;
        c.tipsReceived += tipAmount;

        emit ContributionRecorded(tokenId, gross, net, cardFees, nonprofitFee, isOnchain);
        if (tipAmount > 0) {
            emit TipRecorded(tokenId, tipAmount, isOnchain);
        }
    }

    /**
     * @notice Release tip to fundee (nonprofit discretion)
     * @param tokenId The campaign token ID
     * @param amount Amount of tips to release to fundee
     */
    function releaseTipToFundee(uint256 tokenId, uint256 amount) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        require(c.submitter != address(0), "No submitter set");
        require(amount <= c.tipsReceived - c.tipsReleasedToFundee, "Exceeds available tips");

        c.tipsReleasedToFundee += amount;

        emit TipReleasedToFundee(tokenId, c.submitter, amount);
    }

    /**
     * @notice Adjust payout eligible amount (for benchmark-based releases)
     */
    function adjustPayoutEligible(uint256 tokenId, uint256 newEligible) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        uint256 oldEligible = c.payoutEligible;
        c.payoutEligible = newEligible;

        emit PayoutEligibleAdjusted(tokenId, oldEligible, newEligible);
    }

    /**
     * @notice Release payout to fundee
     * @param tokenId The campaign token ID
     * @param amount Amount to release
     * @param onchain True if sending native tokens, false if off-chain transfer
     */
    function releasePayout(uint256 tokenId, uint256 amount, bool onchain) external onlyOwner {
        Campaign storage c = campaigns[tokenId];
        require(c.submitter != address(0), "No submitter set");
        require(amount <= c.payoutEligible - c.payoutReleased, "Exceeds eligible");

        c.payoutReleased += amount;

        if (onchain && amount > 0) {
            (bool sent, ) = c.submitter.call{value: amount}("");
            require(sent, "Transfer failed");
        }

        emit PayoutReleased(tokenId, c.submitter, amount, onchain);
    }

    /**
     * @notice Close a campaign (no more contributions)
     */
    function closeCampaign(uint256 tokenId) external onlyOwner {
        campaigns[tokenId].closed = true;
        emit CampaignClosed(tokenId);
    }

    /**
     * @notice Contribute native tokens (BDAG) to a campaign - PUBLIC PAYABLE
     * @param tokenId The campaign token ID to contribute to
     * @dev Anyone can call this to contribute. No card fees for crypto.
     */
    function contributeNative(uint256 tokenId) external payable {
        Campaign storage c = campaigns[tokenId];
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!c.closed, "Campaign closed");
        require(msg.value > 0, "No value sent");
        
        // No card fees for crypto, just nonprofit fee
        uint256 gross = msg.value;
        uint256 nonprofitFee = (gross * c.nonprofitFeeRate) / 10000;
        uint256 net = gross - nonprofitFee;
        
        c.grossRaised += gross;
        c.netRaised += net;
        c.payoutEligible += net; // Crypto goes straight to eligible
        
        emit ContributionRecorded(tokenId, gross, net, 0, nonprofitFee, true);
    }

    /**
     * @notice Contribute native tokens with optional tip - PUBLIC PAYABLE
     * @param tokenId The campaign token ID
     * @param tipAmount Amount of msg.value that is a tip (rest is contribution)
     * @dev Tip is tracked separately and held by nonprofit
     */
    function contributeNativeWithTip(uint256 tokenId, uint256 tipAmount) external payable {
        Campaign storage c = campaigns[tokenId];
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!c.closed, "Campaign closed");
        require(msg.value > 0, "No value sent");
        require(msg.value >= tipAmount, "Tip exceeds value");
        
        uint256 contribution = msg.value - tipAmount;
        uint256 nonprofitFee = contribution > 0 ? (contribution * c.nonprofitFeeRate) / 10000 : 0;
        uint256 net = contribution - nonprofitFee;
        
        c.grossRaised += msg.value; // Total includes tip
        c.netRaised += net;
        c.payoutEligible += net;
        c.tipsReceived += tipAmount;
        
        emit ContributionRecorded(tokenId, contribution, net, 0, nonprofitFee, true);
        if (tipAmount > 0) {
            emit TipRecorded(tokenId, tipAmount, true);
        }
    }

    /**
     * @notice Withdraw contract balance to central nonprofit wallet
     */
    function withdrawToCentral(address payable recipient, uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Withdraw failed");

        emit WithdrawToCentral(recipient, amount);
    }

    /**
     * @notice Transfer custodial ownership of a campaign NFT
     */
    function custodialTransfer(uint256 tokenId, address newOwner) external onlyOwner {
        address oldOwner = ownerOf(tokenId);
        _transfer(oldOwner, newOwner, tokenId);
        campaigns[tokenId].nonprofit = newOwner;

        emit CustodialTransfer(tokenId, oldOwner, newOwner);
    }

    // View functions
    function getCampaign(uint256 tokenId) external view returns (Campaign memory) {
        return campaigns[tokenId];
    }

    function getAvailableTips(uint256 tokenId) external view returns (uint256) {
        Campaign storage c = campaigns[tokenId];
        return c.tipsReceived - c.tipsReleasedToFundee;
    }

    function getAvailablePayout(uint256 tokenId) external view returns (uint256) {
        Campaign storage c = campaigns[tokenId];
        return c.payoutEligible - c.payoutReleased;
    }

    function totalCampaigns() external view returns (uint256) {
        return _nextTokenId;
    }

    // Required overrides for multiple inheritance
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
