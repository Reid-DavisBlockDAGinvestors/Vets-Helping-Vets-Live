// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PatriotPledgeNFTV5
 * @notice Edition-based fundraiser NFTs with living metadata updates
 * 
 * Flow:
 * 1. Admin creates a Campaign (no NFT minted yet)
 * 2. Donors purchase editions → NFT minted to donor's wallet
 * 3. Nonprofit can update campaign metadata (living NFT)
 * 4. All edition holders see updates via their NFT
 */
contract PatriotPledgeNFTV5 is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    uint256 private _nextCampaignId;

    struct Campaign {
        string category;
        string baseURI;           // Base metadata URI (can be updated for living NFT)
        uint256 goal;             // Fundraising goal in smallest unit
        uint256 grossRaised;      // Total raised including tips
        uint256 netRaised;        // Net after fees
        uint256 tipsReceived;     // Tips collected
        uint256 editionsMinted;   // Number of editions minted
        uint256 maxEditions;      // Max editions (0 = unlimited)
        uint256 pricePerEdition;  // Price per edition in smallest unit
        uint256 nonprofitFeeRate; // Basis points (100 = 1%)
        address nonprofit;        // Nonprofit custodian
        address submitter;        // Original fundraiser/recipient
        bool active;              // Can still accept donations
        bool closed;              // Fully closed, no more activity
    }

    // Campaign ID => Campaign data
    mapping(uint256 => Campaign) public campaigns;
    
    // Token ID => Campaign ID (which campaign this edition belongs to)
    mapping(uint256 => uint256) public tokenToCampaign;
    
    // Token ID => Edition number within campaign
    mapping(uint256 => uint256) public tokenEditionNumber;
    
    // Campaign ID => list of token IDs (all editions)
    mapping(uint256 => uint256[]) public campaignEditions;

    // Events
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed nonprofit,
        string category,
        uint256 goal,
        uint256 maxEditions,
        uint256 pricePerEdition
    );
    
    event EditionMinted(
        uint256 indexed campaignId,
        uint256 indexed tokenId,
        address indexed donor,
        uint256 editionNumber,
        uint256 amountPaid
    );
    
    event CampaignMetadataUpdated(
        uint256 indexed campaignId,
        string newBaseURI
    );
    
    event ContributionRecorded(
        uint256 indexed campaignId,
        uint256 gross,
        uint256 net,
        uint256 tip,
        bool isOnchain
    );
    
    event CampaignClosed(uint256 indexed campaignId);

    constructor() ERC721("PatriotPledge Edition", "PPE") Ownable(msg.sender) {}

    // ============ Campaign Management ============

    /**
     * @notice Create a new fundraiser campaign (no NFT minted yet)
     * @param category Campaign category
     * @param baseURI Initial metadata URI
     * @param goal Fundraising goal
     * @param maxEditions Maximum editions (0 = unlimited)
     * @param pricePerEdition Price per edition
     * @param feeRate Nonprofit fee rate in basis points
     * @param submitter Address of the fundraiser/recipient
     */
    function createCampaign(
        string calldata category,
        string calldata baseURI,
        uint256 goal,
        uint256 maxEditions,
        uint256 pricePerEdition,
        uint256 feeRate,
        address submitter
    ) external onlyOwner returns (uint256) {
        uint256 campaignId = _nextCampaignId++;
        
        campaigns[campaignId] = Campaign({
            category: category,
            baseURI: baseURI,
            goal: goal,
            grossRaised: 0,
            netRaised: 0,
            tipsReceived: 0,
            editionsMinted: 0,
            maxEditions: maxEditions,
            pricePerEdition: pricePerEdition,
            nonprofitFeeRate: feeRate,
            nonprofit: msg.sender,
            submitter: submitter,
            active: true,
            closed: false
        });

        emit CampaignCreated(campaignId, msg.sender, category, goal, maxEditions, pricePerEdition);
        return campaignId;
    }

    /**
     * @notice Mint an edition NFT to a donor (called by backend after payment)
     * @param campaignId The campaign to mint from
     * @param donor Address to receive the NFT
     * @param amountPaid Amount the donor paid (for records)
     */
    function mintEditionToDonor(
        uint256 campaignId,
        address donor,
        uint256 amountPaid
    ) external onlyOwner returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        _safeMint(donor, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[tokenId] = editionNumber;
        campaignEditions[campaignId].push(tokenId);

        emit EditionMinted(campaignId, tokenId, donor, editionNumber, amountPaid);
        return tokenId;
    }

    /**
     * @notice Allow donors to mint directly with native BDAG
     * @param campaignId The campaign to contribute to
     */
    function mintWithBDAG(uint256 campaignId) external payable returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        require(msg.value >= c.pricePerEdition, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        // Update campaign financials
        c.grossRaised += msg.value;
        c.netRaised += msg.value; // Full amount for on-chain (no card fees)
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[tokenId] = editionNumber;
        campaignEditions[campaignId].push(tokenId);

        emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, msg.value);
        emit ContributionRecorded(campaignId, msg.value, msg.value, 0, true);
        
        return tokenId;
    }

    /**
     * @notice Mint with BDAG including a tip
     * @param campaignId The campaign to contribute to
     * @param tipAmount Amount of the payment that is a tip
     */
    function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        require(msg.value >= c.pricePerEdition + tipAmount, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        uint256 contribution = msg.value - tipAmount;
        
        // Update campaign financials
        c.grossRaised += msg.value;
        c.netRaised += contribution;
        c.tipsReceived += tipAmount;
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[tokenId] = editionNumber;
        campaignEditions[campaignId].push(tokenId);

        emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, msg.value);
        emit ContributionRecorded(campaignId, msg.value, contribution, tipAmount, true);
        
        return tokenId;
    }

    // ============ Living NFT - Metadata Updates ============

    /**
     * @notice Update campaign metadata (living NFT feature)
     * @dev Updates baseURI and refreshes all edition token URIs
     * @param campaignId Campaign to update
     * @param newBaseURI New metadata URI with progress updates
     */
    function updateCampaignMetadata(
        uint256 campaignId,
        string calldata newBaseURI
    ) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        
        c.baseURI = newBaseURI;
        
        // Update all edition token URIs
        uint256[] storage editions = campaignEditions[campaignId];
        for (uint256 i = 0; i < editions.length; i++) {
            _setTokenURI(editions[i], newBaseURI);
        }
        
        emit CampaignMetadataUpdated(campaignId, newBaseURI);
    }

    // ============ Financial Recording (for off-chain payments) ============

    /**
     * @notice Record a contribution made off-chain (card, PayPal, etc.)
     * @dev Called by backend after successful payment
     */
    function recordContribution(
        uint256 campaignId,
        uint256 gross,
        uint256 net,
        uint256 tip,
        bool isOnchain
    ) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");

        c.grossRaised += gross + tip;
        c.netRaised += net;
        c.tipsReceived += tip;

        emit ContributionRecorded(campaignId, gross, net, tip, isOnchain);
    }

    // ============ Campaign Lifecycle ============

    /**
     * @notice Deactivate campaign (no new editions, but not fully closed)
     */
    function deactivateCampaign(uint256 campaignId) external onlyOwner {
        campaigns[campaignId].active = false;
    }

    /**
     * @notice Reactivate a deactivated campaign
     */
    function reactivateCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign permanently closed");
        c.active = true;
    }

    /**
     * @notice Permanently close a campaign
     */
    function closeCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        c.active = false;
        c.closed = true;
        emit CampaignClosed(campaignId);
    }

    // ============ View Functions ============

    /**
     * @notice Get campaign details
     */
    function getCampaign(uint256 campaignId) external view returns (
        string memory category,
        string memory baseURI,
        uint256 goal,
        uint256 grossRaised,
        uint256 netRaised,
        uint256 editionsMinted,
        uint256 maxEditions,
        uint256 pricePerEdition,
        bool active,
        bool closed
    ) {
        Campaign storage c = campaigns[campaignId];
        return (
            c.category,
            c.baseURI,
            c.goal,
            c.grossRaised,
            c.netRaised,
            c.editionsMinted,
            c.maxEditions,
            c.pricePerEdition,
            c.active,
            c.closed
        );
    }

    /**
     * @notice Get edition info for a token
     */
    function getEditionInfo(uint256 tokenId) external view returns (
        uint256 campaignId,
        uint256 editionNumber,
        uint256 totalEditions
    ) {
        campaignId = tokenToCampaign[tokenId];
        editionNumber = tokenEditionNumber[tokenId];
        totalEditions = campaigns[campaignId].editionsMinted;
    }

    /**
     * @notice Get all edition token IDs for a campaign
     */
    function getCampaignEditions(uint256 campaignId) external view returns (uint256[] memory) {
        return campaignEditions[campaignId];
    }

    /**
     * @notice Get total number of campaigns
     */
    function totalCampaigns() external view returns (uint256) {
        return _nextCampaignId;
    }

    // ============ Withdraw ============

    /**
     * @notice Withdraw collected BDAG to nonprofit
     */
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        to.transfer(amount);
    }

    // Accept native tokens
    receive() external payable {}
    fallback() external payable {}

    // ============ Required Overrides ============

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
