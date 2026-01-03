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
 * @title PatriotPledgeNFTV8
 * @author PatriotPledge Team
 * @notice Multi-chain production NFT with improved ABI clarity and chain-agnostic naming
 * @dev Complete NFT management system designed for Ethereum Mainnet and multi-chain deployment
 * 
 * V8 IMPROVEMENTS (from V7 audit):
 * - Struct-based getCampaign() to prevent ABI field mismatches
 * - Chain-agnostic function names (no more "BDAG" references)
 * - USD price storage alongside native price for accurate reporting
 * - Per-campaign pause functionality
 * - Simplified immediate payout (single flag per campaign)
 * - All mint functions have onlyThisChain modifier
 * - Enhanced events for better frontend tracking
 * 
 * INHERITED FROM V7:
 * - Immediate fund distribution on mint
 * - Configurable fee splitting
 * - Chain-aware deployment with replay protection
 * - Bug bounty pool
 * - EIP-2981 Royalties
 * - Pausable, Token freezing, Blacklisting
 * - Soulbound tokens, ERC-4906 metadata refresh
 */
contract PatriotPledgeNFTV8 is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    ERC721Royalty,
    Ownable, 
    Pausable,
    ReentrancyGuard 
{
    // ============ Constants ============
    
    uint256 public constant VERSION = 8;
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
    
    // Platform fee in basis points (e.g., 100 = 1%)
    uint16 public platformFeeBps;
    
    // Token freezing (prevents transfers)
    mapping(uint256 => bool) public frozenTokens;
    
    // Address blacklist (prevents minting/transfers)
    mapping(address => bool) public blacklisted;
    
    // Soulbound tokens (non-transferable)
    mapping(uint256 => bool) public soulbound;

    // ============ Campaign Structure (V8 Enhanced) ============
    
    struct Campaign {
        string category;
        string baseURI;
        uint256 goalNative;      // Goal in native currency (wei)
        uint256 goalUsd;         // Goal in USD cents (for reporting)
        uint256 grossRaised;
        uint256 netRaised;
        uint256 tipsReceived;
        uint256 editionsMinted;
        uint256 maxEditions;
        uint256 priceNative;     // Price in native currency (wei)
        uint256 priceUsd;        // Price in USD cents (for reporting)
        address nonprofit;
        address submitter;
        bool active;
        bool paused;             // V8 NEW: Per-campaign pause
        bool closed;
        bool refunded;
        bool immediatePayoutEnabled;
    }

    // V8: Struct for view function (prevents ABI mismatch)
    struct CampaignView {
        uint256 id;
        string category;
        string baseURI;
        uint256 goalNative;
        uint256 goalUsd;
        uint256 grossRaised;
        uint256 netRaised;
        uint256 tipsReceived;
        uint256 editionsMinted;
        uint256 maxEditions;
        uint256 priceNative;
        uint256 priceUsd;
        address nonprofit;
        address submitter;
        bool active;
        bool paused;
        bool closed;
        bool refunded;
        bool immediatePayoutEnabled;
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
        uint256 goalNative,
        uint256 goalUsd,
        uint256 maxEditions, 
        uint256 priceNative,
        uint256 priceUsd,
        bool immediatePayoutEnabled
    );
    event CampaignUpdated(uint256 indexed campaignId, string field);
    event CampaignMetadataUpdated(uint256 indexed campaignId, string newBaseURI);
    event CampaignClosed(uint256 indexed campaignId);
    event CampaignReopened(uint256 indexed campaignId);
    event CampaignPaused(uint256 indexed campaignId);
    event CampaignUnpaused(uint256 indexed campaignId);
    event CampaignRefunded(uint256 indexed campaignId);
    event ContributionRecorded(uint256 indexed campaignId, uint256 gross, uint256 net, uint256 tip, bool isOnchain);
    event PriceUpdated(uint256 indexed campaignId, uint256 oldPriceNative, uint256 newPriceNative, uint256 newPriceUsd);
    
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
    
    // Fund distribution events
    event FundsDistributed(
        uint256 indexed campaignId,
        address indexed submitter,
        uint256 submitterAmount,
        uint256 platformFee,
        uint256 tipAmount
    );
    event ImmediatePayoutSent(
        uint256 indexed campaignId,
        address indexed recipient,
        uint256 amount,
        string recipientType
    );
    
    // Bug bounty events
    event BugBountyFunded(address indexed funder, uint256 amount);
    event BugBountyPaid(address indexed recipient, uint256 amount, string reportId);
    
    // Admin events
    event AddressBlacklisted(address indexed addr, bool blacklisted);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DefaultRoyaltyUpdated(uint96 newRoyaltyBps);
    event PlatformFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
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
    
    modifier campaignMintable(uint256 campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.paused, "Campaign is paused");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
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
        platformFeeBps = _platformFeeBps;
        deploymentChainId = block.chainid;
        
        _setDefaultRoyalty(_platformTreasury, defaultRoyaltyBps);
    }

    // ============ Pausable Functions ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Platform Configuration ============
    
    function setPlatformFee(uint16 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= MAX_FEE_BPS, "Fee too high");
        uint16 oldFee = platformFeeBps;
        platformFeeBps = _newFeeBps;
        emit PlatformFeeUpdated(oldFee, _newFeeBps);
    }
    
    function setPlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    // ============ Bug Bounty Pool ============
    
    function fundBugBounty() external payable {
        require(msg.value > 0, "Must send funds");
        bugBountyPool += msg.value;
        emit BugBountyFunded(msg.sender, msg.value);
    }

    function payBugBounty(address payable recipient, uint256 amount, string calldata reportId) external onlyOwner nonReentrant {
        require(amount <= bugBountyPool, "Insufficient bounty pool");
        require(recipient != address(0), "Invalid recipient");
        
        bugBountyPool -= amount;
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
        emit BugBountyPaid(recipient, amount, reportId);
    }

    // ============ Blacklist Management ============
    
    function setBlacklisted(address addr, bool status) external onlyOwner {
        blacklisted[addr] = status;
        emit AddressBlacklisted(addr, status);
    }

    // ============ Token Freezing ============
    
    function setTokenFrozen(uint256 tokenId, bool frozen) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        frozenTokens[tokenId] = frozen;
        emit TokenFrozen(tokenId, frozen);
    }

    // ============ Soulbound Tokens ============
    
    function setTokenSoulbound(uint256 tokenId, bool _soulbound) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        soulbound[tokenId] = _soulbound;
        emit TokenSoulbound(tokenId, _soulbound);
    }

    // ============ Campaign Creation (V8 Enhanced) ============
    
    /**
     * @notice Create a new campaign with both native and USD pricing
     * @param category Campaign category
     * @param baseURI IPFS metadata URI
     * @param goalNative Goal in native currency (wei)
     * @param goalUsd Goal in USD cents (e.g., 100000 = $1000.00)
     * @param maxEditions Maximum editions (0 = unlimited)
     * @param priceNative Price per edition in native currency (wei)
     * @param priceUsd Price per edition in USD cents (e.g., 1000 = $10.00)
     * @param nonprofit Nonprofit address
     * @param submitter Submitter address for fund distribution
     * @param immediatePayoutEnabled Whether to enable immediate payout
     */
    function createCampaign(
        string calldata category,
        string calldata baseURI,
        uint256 goalNative,
        uint256 goalUsd,
        uint256 maxEditions,
        uint256 priceNative,
        uint256 priceUsd,
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
            goalNative: goalNative,
            goalUsd: goalUsd,
            grossRaised: 0,
            netRaised: 0,
            tipsReceived: 0,
            editionsMinted: 0,
            maxEditions: maxEditions,
            priceNative: priceNative,
            priceUsd: priceUsd,
            nonprofit: nonprofit,
            submitter: submitter,
            active: true,
            paused: false,
            closed: false,
            refunded: false,
            immediatePayoutEnabled: immediatePayoutEnabled
        });

        emit CampaignCreated(
            campaignId, 
            nonprofit, 
            submitter,
            category, 
            goalNative,
            goalUsd,
            maxEditions, 
            priceNative,
            priceUsd,
            immediatePayoutEnabled
        );
        return campaignId;
    }

    // ============ Per-Campaign Pause (V8 NEW) ============

    function pauseCampaign(uint256 campaignId) external onlyOwner {
        campaigns[campaignId].paused = true;
        emit CampaignPaused(campaignId);
    }

    function unpauseCampaign(uint256 campaignId) external onlyOwner {
        campaigns[campaignId].paused = false;
        emit CampaignUnpaused(campaignId);
    }

    // ============ Minting Functions (V8 Chain-Agnostic Names) ============

    /**
     * @notice Mint a single NFT (chain-agnostic name)
     */
    function mint(uint256 campaignId) 
        external payable 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        nonReentrant 
        onlyThisChain 
        campaignMintable(campaignId)
        returns (uint256) 
    {
        return _mintInternal(campaignId, 0);
    }

    /**
     * @notice Mint a single NFT with tip
     */
    function mintWithTip(uint256 campaignId, uint256 tipAmount) 
        external payable 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        nonReentrant 
        onlyThisChain 
        campaignMintable(campaignId)
        returns (uint256) 
    {
        return _mintInternal(campaignId, tipAmount);
    }

    /**
     * @notice Batch mint multiple NFTs
     */
    function batchMint(uint256 campaignId, uint256 quantity) 
        external payable 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        nonReentrant 
        onlyThisChain 
        returns (uint256[] memory) 
    {
        return _batchMintInternal(campaignId, quantity, 0);
    }

    /**
     * @notice Batch mint multiple NFTs with tip
     */
    function batchMintWithTip(uint256 campaignId, uint256 quantity, uint256 tipAmount) 
        external payable 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        nonReentrant 
        onlyThisChain 
        returns (uint256[] memory) 
    {
        return _batchMintInternal(campaignId, quantity, tipAmount);
    }

    // ============ Legacy Function Aliases (for V7 compatibility) ============

    function mintWithBDAG(uint256 campaignId) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant onlyThisChain returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active && !c.paused && !c.closed && !c.refunded, "Campaign not mintable");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        return _mintInternal(campaignId, 0);
    }

    function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant onlyThisChain returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active && !c.paused && !c.closed && !c.refunded, "Campaign not mintable");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        return _mintInternal(campaignId, tipAmount);
    }

    // ============ Internal Minting ============

    function _mintInternal(uint256 campaignId, uint256 tipAmount) internal returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(msg.value >= c.priceNative + tipAmount, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        uint256 contribution = msg.value - tipAmount;
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[tokenId] = editionNumber;
        campaignEditions[campaignId].push(tokenId);
        
        c.grossRaised += msg.value;
        c.tipsReceived += tipAmount;
        
        // V8: Simplified - only check per-campaign flag
        if (c.immediatePayoutEnabled) {
            _distributeFunds(campaignId, contribution, tipAmount);
        } else {
            c.netRaised += contribution;
        }

        emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, msg.value);
        emit ContributionRecorded(campaignId, msg.value, contribution, tipAmount, true);
        
        return tokenId;
    }

    function _batchMintInternal(uint256 campaignId, uint256 quantity, uint256 tipAmount) internal returns (uint256[] memory tokenIds) {
        Campaign storage c = campaigns[campaignId];
        require(c.active && !c.paused && !c.closed && !c.refunded, "Campaign not mintable");
        require(quantity > 0 && quantity <= MAX_BATCH_SIZE, "Invalid quantity");
        require(c.maxEditions == 0 || c.editionsMinted + quantity <= c.maxEditions, "Exceeds max editions");
        require(msg.value >= (c.priceNative * quantity) + tipAmount, "Insufficient payment");

        tokenIds = new uint256[](quantity);
        uint256 totalPaid = msg.value;
        uint256 contribution = totalPaid - tipAmount;
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
        c.tipsReceived += tipAmount;
        
        if (c.immediatePayoutEnabled) {
            _distributeFunds(campaignId, contribution, tipAmount);
        } else {
            c.netRaised += contribution;
        }
        
        emit ContributionRecorded(campaignId, totalPaid, contribution, tipAmount, true);
        
        return tokenIds;
    }

    // ============ Fund Distribution ============

    function _distributeFunds(uint256 campaignId, uint256 contribution, uint256 tipAmount) internal {
        Campaign storage c = campaigns[campaignId];
        
        uint256 platformFee = (contribution * platformFeeBps) / BPS_DENOMINATOR;
        uint256 submitterAmount = contribution - platformFee + tipAmount;
        
        campaignDistributed[campaignId] += contribution + tipAmount;
        c.netRaised += (contribution - platformFee);
        
        if (platformFee > 0) {
            (bool success1, ) = platformTreasury.call{value: platformFee}("");
            require(success1, "Platform fee transfer failed");
            emit ImmediatePayoutSent(campaignId, platformTreasury, platformFee, "platform");
        }
        
        if (submitterAmount > 0) {
            (bool success2, ) = c.submitter.call{value: submitterAmount}("");
            require(success2, "Submitter transfer failed");
            emit ImmediatePayoutSent(campaignId, c.submitter, submitterAmount, "submitter");
        }
        
        emit FundsDistributed(campaignId, c.submitter, submitterAmount, platformFee, tipAmount);
    }

    function distributePendingFunds(uint256 campaignId) external onlyOwner nonReentrant {
        Campaign storage c = campaigns[campaignId];
        uint256 pendingAmount = c.netRaised;
        require(pendingAmount > 0, "No pending funds");
        require(address(this).balance >= pendingAmount, "Insufficient contract balance");
        
        c.netRaised = 0;
        _distributeFunds(campaignId, pendingAmount, 0);
    }

    // ============ Admin Minting ============

    function mintEditionToDonor(uint256 campaignId, address donor, uint256 amountPaid) external onlyOwner returns (uint256) {
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

    // ============ Campaign Updates ============

    function updateCampaignMetadata(uint256 campaignId, string calldata newBaseURI) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        
        c.baseURI = newBaseURI;
        
        uint256[] storage editions = campaignEditions[campaignId];
        for (uint256 i = 0; i < editions.length; i++) {
            _setTokenURI(editions[i], newBaseURI);
        }
        
        emit CampaignMetadataUpdated(campaignId, newBaseURI);
    }

    function recordContribution(uint256 campaignId, uint256 gross, uint256 net, uint256 tip, bool isOnchain) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");

        c.grossRaised += gross + tip;
        c.netRaised += net;
        c.tipsReceived += tip;

        emit ContributionRecorded(campaignId, gross, net, tip, isOnchain);
    }

    function updateCampaignGoal(uint256 campaignId, uint256 newGoalNative, uint256 newGoalUsd) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        c.goalNative = newGoalNative;
        c.goalUsd = newGoalUsd;
        emit CampaignUpdated(campaignId, "goal");
    }

    function updateCampaignPrice(uint256 campaignId, uint256 newPriceNative, uint256 newPriceUsd) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        uint256 oldPrice = c.priceNative;
        c.priceNative = newPriceNative;
        c.priceUsd = newPriceUsd;
        emit PriceUpdated(campaignId, oldPrice, newPriceNative, newPriceUsd);
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

    function setCampaignImmediatePayout(uint256 campaignId, bool enabled) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        c.immediatePayoutEnabled = enabled;
        emit CampaignUpdated(campaignId, "immediatePayoutEnabled");
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

    function reopenCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(c.closed, "Campaign not closed");
        require(!c.refunded, "Campaign was refunded");
        c.closed = false;
        c.active = true;
        emit CampaignReopened(campaignId);
    }

    function markCampaignRefunded(uint256 campaignId) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        c.refunded = true;
        c.active = false;
        emit CampaignRefunded(campaignId);
    }

    // ============ URI Management ============

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

    // ============ View Functions (V8 Struct-Based) ============

    /**
     * @notice Get campaign data as a struct (prevents ABI mismatch issues)
     */
    function getCampaign(uint256 campaignId) external view returns (CampaignView memory) {
        Campaign storage c = campaigns[campaignId];
        return CampaignView({
            id: campaignId,
            category: c.category,
            baseURI: c.baseURI,
            goalNative: c.goalNative,
            goalUsd: c.goalUsd,
            grossRaised: c.grossRaised,
            netRaised: c.netRaised,
            tipsReceived: c.tipsReceived,
            editionsMinted: c.editionsMinted,
            maxEditions: c.maxEditions,
            priceNative: c.priceNative,
            priceUsd: c.priceUsd,
            nonprofit: c.nonprofit,
            submitter: c.submitter,
            active: c.active,
            paused: c.paused,
            closed: c.closed,
            refunded: c.refunded,
            immediatePayoutEnabled: c.immediatePayoutEnabled
        });
    }

    function getEditionInfo(uint256 tokenId) external view returns (uint256 campaignId, uint256 editionNumber, uint256 totalEditions) {
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

    // ============ Withdraw ============

    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = platformTreasury.call{value: balance}("");
        require(success, "Transfer failed");
        emit EmergencyWithdraw(platformTreasury, balance);
    }

    receive() external payable {}
    fallback() external payable {}

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

    // ============ Metadata Refresh (ERC-4906) ============

    function emitMetadataUpdate(uint256 tokenId) external onlyOwner {
        emit MetadataUpdate(tokenId);
    }

    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) external onlyOwner {
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    // ============ Required Overrides ============

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);
        
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
