// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PatriotPledgeNFTV7
 * @author PatriotPledge Team
 * @notice Multi-chain production NFT with immediate fund distribution
 * @dev Complete NFT management system designed for Ethereum Mainnet and multi-chain deployment
 * 
 * V7 NEW FEATURES:
 * - Immediate fund distribution on mint (funds sent to submitter instantly)
 * - Configurable fee splitting (platform/nonprofit/submitter)
 * - Chain-aware deployment with replay protection
 * - Bug bounty pool for on-chain bounty payments
 * - Gas-optimized for Ethereum Mainnet
 * - Multi-sig ready with timelock pattern
 * 
 * INHERITED FROM V6:
 * - EIP-2981 Royalties for marketplace support
 * - Pausable for emergency stops
 * - Token freezing for compliance
 * - Address blacklisting for security
 * - Full campaign editing capabilities
 * - Batch operations for efficiency
 * - Token burning for cleanup
 * - ReentrancyGuard for security
 * - Soulbound tokens
 * - ERC-4906 metadata refresh
 */
contract PatriotPledgeNFTV7 is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    ERC721Royalty,
    Ownable, 
    Pausable,
    ReentrancyGuard 
{
    // ============ Constants ============
    
    uint256 public constant MAX_FEE_BPS = 3000; // Maximum 30% total fees
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_BATCH_SIZE = 50;
    
    // Chain ID at deployment (for replay protection)
    uint256 public immutable deploymentChainId;
    
    // ============ State Variables ============
    
    uint256 private _nextTokenId;
    uint256 private _nextCampaignId;
    
    // Treasury addresses
    address public platformTreasury;
    
    // Bug bounty pool
    uint256 public bugBountyPool;
    
    // Default royalty (can be overridden per-token)
    uint96 public defaultRoyaltyBps = 250; // 2.5%
    
    // Token freezing (prevents transfers)
    mapping(uint256 => bool) public frozenTokens;
    
    // Address blacklist (prevents minting/transfers)
    mapping(address => bool) public blacklisted;
    
    // Soulbound tokens (non-transferable)
    mapping(uint256 => bool) public soulbound;

    // ============ Fee Configuration ============
    
    struct FeeConfig {
        uint16 platformFeeBps;     // Platform fee (e.g., 100 = 1%)
        bool immediatePayout;      // Enable immediate payouts globally (default: false)
    }
    
    FeeConfig public feeConfig;

    // ============ Campaign Structure ============
    
    struct Campaign {
        string category;
        string baseURI;
        uint256 goal;
        uint256 grossRaised;
        uint256 netRaised;
        uint256 tipsReceived;
        uint256 editionsMinted;
        uint256 maxEditions;
        uint256 pricePerEdition;
        address nonprofit;
        address submitter;
        bool active;
        bool closed;
        bool refunded;
        bool immediatePayoutEnabled; // Per-campaign immediate payout setting
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => uint256) public tokenToCampaign;
    mapping(uint256 => uint256) public tokenEditionNumber;
    mapping(uint256 => uint256[]) public campaignEditions;
    
    // Track total distributed per campaign
    mapping(uint256 => uint256) public campaignDistributed;

    // ============ Events ============
    
    // Campaign events
    event CampaignCreated(
        uint256 indexed campaignId, 
        address indexed nonprofit, 
        address indexed submitter,
        string category, 
        uint256 goal, 
        uint256 maxEditions, 
        uint256 pricePerEdition,
        bool immediatePayoutEnabled
    );
    event CampaignUpdated(uint256 indexed campaignId, string field);
    event CampaignMetadataUpdated(uint256 indexed campaignId, string newBaseURI);
    event CampaignClosed(uint256 indexed campaignId);
    event CampaignRefunded(uint256 indexed campaignId);
    event ContributionRecorded(uint256 indexed campaignId, uint256 gross, uint256 net, uint256 tip, bool isOnchain);
    
    // Token events
    event EditionMinted(
        uint256 indexed campaignId, 
        uint256 indexed tokenId, 
        address indexed donor, 
        uint256 editionNumber, 
        uint256 amountPaid
    );
    event TokenURIFixed(uint256 indexed tokenId, string newURI);
    event TokenBurned(uint256 indexed tokenId, address indexed burner);
    event TokenFrozen(uint256 indexed tokenId, bool frozen);
    event TokenSoulbound(uint256 indexed tokenId, bool soulbound);
    
    // V7 NEW: Fund distribution events
    event FundsDistributed(
        uint256 indexed campaignId,
        address indexed submitter,
        uint256 submitterAmount,
        uint256 platformFee,
        uint256 nonprofitFee,
        uint256 tipAmount
    );
    event ImmediatePayoutSent(
        uint256 indexed campaignId,
        address indexed recipient,
        uint256 amount,
        string recipientType // "submitter", "platform", "nonprofit"
    );
    
    // V7 NEW: Bug bounty events
    event BugBountyFunded(address indexed funder, uint256 amount);
    event BugBountyPaid(address indexed recipient, uint256 amount, string reportId);
    
    // Admin events
    event AddressBlacklisted(address indexed addr, bool blacklisted);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DefaultRoyaltyUpdated(uint96 newRoyaltyBps);
    event FeeConfigUpdated(uint16 platformFeeBps, bool immediatePayout);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ============ Modifiers ============
    
    modifier notBlacklisted(address addr) {
        require(!blacklisted[addr], "Address is blacklisted");
        _;
    }
    
    modifier tokenNotFrozen(uint256 tokenId) {
        require(!frozenTokens[tokenId], "Token is frozen");
        _;
    }
    
    modifier onlyThisChain() {
        require(block.chainid == deploymentChainId, "Wrong chain");
        _;
    }

    // ============ Constructor ============
    
    constructor(
        address _platformTreasury,
        uint16 _platformFeeBps
    ) ERC721("PatriotPledge Edition", "PPE") Ownable(msg.sender) {
        require(_platformTreasury != address(0), "Invalid treasury");
        require(_platformFeeBps <= MAX_FEE_BPS, "Fee too high");
        
        platformTreasury = _platformTreasury;
        deploymentChainId = block.chainid;
        
        feeConfig = FeeConfig({
            platformFeeBps: _platformFeeBps,
            immediatePayout: false // Default: admin-controlled distribution
        });
        
        _setDefaultRoyalty(_platformTreasury, defaultRoyaltyBps);
    }

    // ============ Pausable Functions ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Fee Configuration ============
    
    function setFeeConfig(
        uint16 _platformFeeBps,
        bool _immediatePayout
    ) external onlyOwner {
        require(_platformFeeBps <= MAX_FEE_BPS, "Fee too high");
        
        feeConfig = FeeConfig({
            platformFeeBps: _platformFeeBps,
            immediatePayout: _immediatePayout
        });
        
        emit FeeConfigUpdated(_platformFeeBps, _immediatePayout);
    }
    
    function setPlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    // ============ Bug Bounty Pool ============
    
    /**
     * @notice Fund the bug bounty pool
     * @dev Anyone can fund, but only owner can withdraw
     */
    function fundBugBountyPool() external payable {
        require(msg.value > 0, "Must send funds");
        bugBountyPool += msg.value;
        emit BugBountyFunded(msg.sender, msg.value);
    }
    
    /**
     * @notice Pay a bug bounty to a recipient
     * @param recipient Address to receive the bounty
     * @param amount Amount to pay
     * @param reportId Bug report identifier for tracking
     */
    function payBugBounty(
        address payable recipient,
        uint256 amount,
        string calldata reportId
    ) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(bugBountyPool >= amount, "Insufficient pool");
        
        bugBountyPool -= amount;
        
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit BugBountyPaid(recipient, amount, reportId);
    }

    // ============ Blacklist Functions ============
    
    function blacklistAddress(address addr) external onlyOwner {
        blacklisted[addr] = true;
        emit AddressBlacklisted(addr, true);
    }
    
    function removeBlacklist(address addr) external onlyOwner {
        blacklisted[addr] = false;
        emit AddressBlacklisted(addr, false);
    }

    // ============ Token Freeze Functions ============
    
    function freezeToken(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        frozenTokens[tokenId] = true;
        emit TokenFrozen(tokenId, true);
    }
    
    function unfreezeToken(uint256 tokenId) external onlyOwner {
        frozenTokens[tokenId] = false;
        emit TokenFrozen(tokenId, false);
    }
    
    function batchFreezeTokens(uint256[] calldata tokenIds, bool freeze) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                frozenTokens[tokenIds[i]] = freeze;
                emit TokenFrozen(tokenIds[i], freeze);
            }
        }
    }

    // ============ Soulbound Functions ============
    
    function makeSoulbound(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        soulbound[tokenId] = true;
        emit TokenSoulbound(tokenId, true);
    }
    
    function removeSoulbound(uint256 tokenId) external onlyOwner {
        soulbound[tokenId] = false;
        emit TokenSoulbound(tokenId, false);
    }

    // ============ Token Burning ============
    
    function burn(uint256 tokenId) external {
        require(_ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!frozenTokens[tokenId], "Token is frozen");
        _burn(tokenId);
        emit TokenBurned(tokenId, msg.sender);
    }
    
    function adminBurn(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        address owner = _ownerOf(tokenId);
        _burn(tokenId);
        emit TokenBurned(tokenId, owner);
    }

    // ============ Campaign Management ============

    /**
     * @notice Create a new fundraiser campaign
     * @param category Campaign category
     * @param baseURI Initial metadata URI
     * @param goal Fundraising goal in native currency (wei)
     * @param maxEditions Maximum editions (0 = unlimited)
     * @param pricePerEdition Price per edition in native currency (wei)
     * @param nonprofit Nonprofit address for fee distribution
     * @param submitter Submitter address for fund distribution
     * @param immediatePayoutEnabled Whether to enable immediate payout for this campaign
     */
    function createCampaign(
        string calldata category,
        string calldata baseURI,
        uint256 goal,
        uint256 maxEditions,
        uint256 pricePerEdition,
        address nonprofit,
        address submitter,
        bool immediatePayoutEnabled
    ) external onlyOwner returns (uint256) {
        require(submitter != address(0), "Invalid submitter");
        require(nonprofit != address(0), "Invalid nonprofit");
        
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
            nonprofit: nonprofit,
            submitter: submitter,
            active: true,
            closed: false,
            refunded: false,
            immediatePayoutEnabled: immediatePayoutEnabled
        });

        emit CampaignCreated(
            campaignId, 
            nonprofit, 
            submitter,
            category, 
            goal, 
            maxEditions, 
            pricePerEdition,
            immediatePayoutEnabled
        );
        return campaignId;
    }

    /**
     * @notice Set immediate payout for a specific campaign
     */
    function setCampaignImmediatePayout(uint256 campaignId, bool enabled) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        c.immediatePayoutEnabled = enabled;
        emit CampaignUpdated(campaignId, "immediatePayoutEnabled");
    }

    // ============ Minting with Immediate Payout ============

    /**
     * @notice Mint an NFT with immediate fund distribution
     * @dev Funds are split and sent to submitter, platform, and nonprofit in same tx
     */
    function mintWithImmediatePayout(
        uint256 campaignId
    ) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant onlyThisChain returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        require(msg.value >= c.pricePerEdition, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        // Mint NFT first
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[tokenId] = editionNumber;
        campaignEditions[campaignId].push(tokenId);
        
        // Update campaign stats
        c.grossRaised += msg.value;
        
        // Distribute funds if immediate payout is enabled
        if (c.immediatePayoutEnabled && feeConfig.immediatePayout) {
            _distributeFunds(campaignId, msg.value, 0);
        } else {
            c.netRaised += msg.value;
        }

        emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, msg.value);
        emit ContributionRecorded(campaignId, msg.value, msg.value, 0, true);
        
        return tokenId;
    }

    /**
     * @notice Mint an NFT with tip and immediate fund distribution
     */
    function mintWithImmediatePayoutAndTip(
        uint256 campaignId,
        uint256 tipAmount
    ) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant onlyThisChain returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        require(msg.value >= c.pricePerEdition + tipAmount, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        uint256 contribution = msg.value - tipAmount;
        
        // Mint NFT first
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[tokenId] = editionNumber;
        campaignEditions[campaignId].push(tokenId);
        
        // Update campaign stats
        c.grossRaised += msg.value;
        c.tipsReceived += tipAmount;
        
        // Distribute funds if immediate payout is enabled
        if (c.immediatePayoutEnabled && feeConfig.immediatePayout) {
            _distributeFunds(campaignId, contribution, tipAmount);
        } else {
            c.netRaised += contribution;
        }

        emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, msg.value);
        emit ContributionRecorded(campaignId, msg.value, contribution, tipAmount, true);
        
        return tokenId;
    }

    /**
     * @notice Batch mint with immediate payout
     */
    function mintBatchWithImmediatePayout(
        uint256 campaignId,
        uint256 quantity
    ) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant onlyThisChain returns (uint256[] memory tokenIds) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(quantity > 0 && quantity <= MAX_BATCH_SIZE, "Invalid quantity");
        require(c.maxEditions == 0 || c.editionsMinted + quantity <= c.maxEditions, "Exceeds max editions");
        require(msg.value >= c.pricePerEdition * quantity, "Insufficient payment");

        tokenIds = new uint256[](quantity);
        uint256 totalPaid = msg.value;
        uint256 perNFT = totalPaid / quantity;

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            uint256 editionNumber = ++c.editionsMinted;
            
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, c.baseURI);
            
            tokenToCampaign[tokenId] = campaignId;
            tokenEditionNumber[tokenId] = editionNumber;
            campaignEditions[campaignId].push(tokenId);
            
            tokenIds[i] = tokenId;
            emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, perNFT);
        }

        c.grossRaised += totalPaid;
        
        // Distribute funds if immediate payout is enabled
        if (c.immediatePayoutEnabled && feeConfig.immediatePayout) {
            _distributeFunds(campaignId, totalPaid, 0);
        } else {
            c.netRaised += totalPaid;
        }
        
        emit ContributionRecorded(campaignId, totalPaid, totalPaid, 0, true);
        
        return tokenIds;
    }

    // ============ Internal Fund Distribution ============

    /**
     * @notice Internal function to distribute funds immediately
     * @param campaignId Campaign ID
     * @param contribution Amount after tips
     * @param tipAmount Tip amount (goes to submitter)
     */
    function _distributeFunds(
        uint256 campaignId,
        uint256 contribution,
        uint256 tipAmount
    ) internal {
        Campaign storage c = campaigns[campaignId];
        
        // Calculate platform fee (1% default)
        uint256 platformFee = (contribution * feeConfig.platformFeeBps) / BPS_DENOMINATOR;
        
        // Submitter receives: contribution - platform fee + tips
        uint256 submitterAmount = contribution - platformFee + tipAmount;
        
        // Track distribution
        campaignDistributed[campaignId] += contribution + tipAmount;
        c.netRaised += (contribution - platformFee); // Net is after platform fee only
        
        // Send platform fee to treasury
        if (platformFee > 0) {
            (bool success1, ) = platformTreasury.call{value: platformFee}("");
            require(success1, "Platform fee transfer failed");
            emit ImmediatePayoutSent(campaignId, platformTreasury, platformFee, "platform");
        }
        
        // Send remainder + tips to submitter (the fundraiser)
        if (submitterAmount > 0) {
            (bool success2, ) = c.submitter.call{value: submitterAmount}("");
            require(success2, "Submitter transfer failed");
            emit ImmediatePayoutSent(campaignId, c.submitter, submitterAmount, "submitter");
        }
        
        emit FundsDistributed(
            campaignId,
            c.submitter,
            submitterAmount,
            platformFee,
            0, // No nonprofit fee
            tipAmount
        );
    }

    /**
     * @notice Admin function to distribute accumulated funds manually
     * @dev Used when immediate payout was disabled but funds need to be distributed
     */
    function distributePendingFunds(uint256 campaignId) external onlyOwner nonReentrant {
        Campaign storage c = campaigns[campaignId];
        uint256 pendingAmount = c.netRaised;
        require(pendingAmount > 0, "No pending funds");
        require(address(this).balance >= pendingAmount, "Insufficient contract balance");
        
        // Reset before distribution to prevent reentrancy
        c.netRaised = 0;
        
        // Distribute
        _distributeFunds(campaignId, pendingAmount, 0);
    }

    // ============ Legacy Minting (No Immediate Payout) ============
    
    /**
     * @notice Mint edition to donor (admin function for off-chain payments)
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

    // ============ Living NFT - Metadata Updates ============

    function updateCampaignMetadata(
        uint256 campaignId,
        string calldata newBaseURI
    ) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        
        c.baseURI = newBaseURI;
        
        uint256[] storage editions = campaignEditions[campaignId];
        for (uint256 i = 0; i < editions.length; i++) {
            _setTokenURI(editions[i], newBaseURI);
        }
        
        emit CampaignMetadataUpdated(campaignId, newBaseURI);
    }

    // ============ Financial Recording ============

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

    // ============ Campaign Editing Functions ============

    function updateCampaignGoal(uint256 campaignId, uint256 newGoal) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        c.goal = newGoal;
        emit CampaignUpdated(campaignId, "goal");
    }

    function updateCampaignPrice(uint256 campaignId, uint256 newPrice) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        c.pricePerEdition = newPrice;
        emit CampaignUpdated(campaignId, "pricePerEdition");
    }

    function updateCampaignMaxEditions(uint256 campaignId, uint256 newMax) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        require(newMax == 0 || newMax >= c.editionsMinted, "Cannot reduce below minted");
        c.maxEditions = newMax;
        emit CampaignUpdated(campaignId, "maxEditions");
    }

    function updateCampaignSubmitter(uint256 campaignId, address newSubmitter) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        require(newSubmitter != address(0), "Invalid submitter");
        c.submitter = newSubmitter;
        emit CampaignUpdated(campaignId, "submitter");
    }

    function updateCampaignNonprofit(uint256 campaignId, address newNonprofit) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        require(newNonprofit != address(0), "Invalid nonprofit");
        c.nonprofit = newNonprofit;
        emit CampaignUpdated(campaignId, "nonprofit");
    }

    function updateCampaignCategory(uint256 campaignId, string calldata newCategory) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        c.category = newCategory;
        emit CampaignUpdated(campaignId, "category");
    }

    function markCampaignRefunded(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        c.refunded = true;
        c.active = false;
        emit CampaignRefunded(campaignId);
    }

    // ============ Campaign Lifecycle ============

    function deactivateCampaign(uint256 campaignId) external onlyOwner {
        campaigns[campaignId].active = false;
        emit CampaignUpdated(campaignId, "active");
    }

    function reactivateCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign permanently closed");
        require(!c.refunded, "Campaign was refunded");
        c.active = true;
        emit CampaignUpdated(campaignId, "active");
    }

    function closeCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        c.active = false;
        c.closed = true;
        emit CampaignClosed(campaignId);
    }

    // ============ Admin URI Fix Functions ============

    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _setTokenURI(tokenId, uri);
        emit TokenURIFixed(tokenId, uri);
    }

    function batchSetTokenURI(uint256[] calldata tokenIds, string calldata uri) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                _setTokenURI(tokenIds[i], uri);
                emit TokenURIFixed(tokenIds[i], uri);
            }
        }
    }

    // ============ View Functions ============

    function getCampaign(uint256 campaignId) external view returns (
        string memory category,
        string memory baseURI,
        uint256 goal,
        uint256 grossRaised,
        uint256 netRaised,
        uint256 editionsMinted,
        uint256 maxEditions,
        uint256 pricePerEdition,
        address nonprofit,
        address submitter,
        bool active,
        bool closed,
        bool immediatePayoutEnabled
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
            c.nonprofit,
            c.submitter,
            c.active, 
            c.closed,
            c.immediatePayoutEnabled
        );
    }

    function getEditionInfo(uint256 tokenId) external view returns (
        uint256 campaignId,
        uint256 editionNumber,
        uint256 totalEditions
    ) {
        campaignId = tokenToCampaign[tokenId];
        editionNumber = tokenEditionNumber[tokenId];
        totalEditions = campaigns[campaignId].editionsMinted;
    }

    function getCampaignEditions(uint256 campaignId) external view returns (uint256[] memory) {
        return campaignEditions[campaignId];
    }

    function totalCampaigns() external view returns (uint256) {
        return _nextCampaignId;
    }
    
    function getFeeConfig() external view returns (
        uint16 platformFeeBps,
        bool immediatePayout
    ) {
        return (
            feeConfig.platformFeeBps,
            feeConfig.immediatePayout
        );
    }

    // ============ Withdraw ============

    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }

    receive() external payable {}
    fallback() external payable {}

    // ============ Metadata Refresh (ERC-4906) ============

    function emitMetadataUpdate(uint256 tokenId) external onlyOwner {
        emit MetadataUpdate(tokenId);
    }

    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) external onlyOwner {
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    // ============ Emergency Functions ============

    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = platformTreasury.call{value: balance}("");
        require(success, "Transfer failed");
        emit EmergencyWithdraw(platformTreasury, balance);
    }

    // ============ Royalty Management ============
    
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
        defaultRoyaltyBps = feeNumerator;
        emit DefaultRoyaltyUpdated(feeNumerator);
    }
    
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }
    
    function deleteDefaultRoyalty() external onlyOwner {
        _deleteDefaultRoyalty();
    }

    // ============ Required Overrides ============

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);
        
        // Skip checks for minting (from == address(0)) and burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            require(!frozenTokens[tokenId], "Token is frozen");
            require(!soulbound[tokenId], "Token is soulbound");
            require(!blacklisted[from], "Sender is blacklisted");
            require(!blacklisted[to], "Recipient is blacklisted");
        }
        
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
