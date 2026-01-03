// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PatriotPledgeNFTV9
 * @author PatriotPledge Team
 * @notice Multi-chain production NFT with improved gift handling and manual distribution
 * @dev Complete NFT management system designed for Ethereum Mainnet and multi-chain deployment
 * 
 * V9 IMPROVEMENTS (from V8):
 * - Gifts (formerly "tips") are held on contract for manual admin distribution
 * - 1% platform fee on gifts (immediate to treasury)
 * - 1% nonprofit fee on gifts (immediate to nonprofit)
 * - 98% net gift held for admin-controlled distribution
 * - giveGift() function for gift-only donations (no NFT required)
 * - distributeGifts() function for manual admin distribution
 * - Configurable submitter/platform split on gift distribution
 * - Anonymous giving support with optional display name
 * 
 * INHERITED FROM V8:
 * - Struct-based getCampaign() to prevent ABI field mismatches
 * - Chain-agnostic function names
 * - USD price storage alongside native price
 * - Per-campaign pause functionality
 * - Immediate payout for NFT purchases (configurable)
 * - EIP-2981 Royalties
 * - Pausable, Token freezing, Blacklisting
 */
contract PatriotPledgeNFTV9 is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    ERC721Royalty,
    Ownable, 
    Pausable,
    ReentrancyGuard 
{
    // ============ Constants ============
    
    uint256 public constant VERSION = 9;
    uint256 public constant MAX_FEE_BPS = 3000; // Maximum 30% total fees
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_BATCH_SIZE = 50;
    
    // Gift fee constants (1% each = 100 bps)
    uint256 public constant GIFT_PLATFORM_FEE_BPS = 100; // 1%
    uint256 public constant GIFT_NONPROFIT_FEE_BPS = 100; // 1%
    
    // ============ State Variables ============
    
    address public platformTreasury;
    uint16 public platformFeeBps; // Platform fee on NFT purchases (not gifts)
    uint256 public deploymentChainId;
    
    uint256 private _nextTokenId;
    uint256 private _nextCampaignId;
    
    // Gift tracking per campaign
    mapping(uint256 => uint256) public campaignGiftBalance;      // Held gifts awaiting distribution
    mapping(uint256 => uint256) public campaignGiftsDistributed; // Total gifts distributed
    mapping(uint256 => uint256) public campaignGiftCount;        // Number of gifts received
    
    // ============ Structs ============
    
    struct Campaign {
        uint256 id;
        string category;
        string baseURI;
        uint256 goalNative;
        uint256 goalUsd;
        uint256 grossRaised;
        uint256 netRaised;
        uint256 giftsReceived;      // Total gift amount received
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
    
    struct CampaignView {
        uint256 id;
        string category;
        string baseURI;
        uint256 goalNative;
        uint256 goalUsd;
        uint256 grossRaised;
        uint256 netRaised;
        uint256 giftsReceived;
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
    
    struct Gift {
        address donor;
        uint256 amount;
        uint256 platformFee;
        uint256 nonprofitFee;
        uint256 netAmount;
        uint256 timestamp;
        string displayName;  // Optional anonymous display name
        string message;      // Optional gift message
    }
    
    // ============ Mappings ============
    
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => uint256) public campaignDistributed;
    mapping(uint256 => mapping(uint256 => uint256)) public tokenEditionNumber;
    mapping(uint256 => uint256) public tokenToCampaign;
    mapping(address => bool) public blacklisted;
    mapping(uint256 => bool) public frozenTokens;
    mapping(uint256 => bool) public soulbound;
    
    // Gift history per campaign
    mapping(uint256 => Gift[]) public campaignGifts;
    
    // ============ Events ============
    
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
    
    event EditionMinted(
        uint256 indexed campaignId,
        uint256 indexed tokenId,
        address indexed donor,
        uint256 editionNumber,
        uint256 amountPaid
    );
    
    event FundsDistributed(
        uint256 indexed campaignId,
        address indexed recipient,
        uint256 amount,
        uint256 platformFee
    );
    
    event GiftReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 totalAmount,
        uint256 platformFee,
        uint256 nonprofitFee,
        uint256 netAmount,
        string displayName
    );
    
    event GiftsDistributed(
        uint256 indexed campaignId,
        uint256 toSubmitter,
        uint256 toPlatform,
        uint256 submitterPercent
    );
    
    event CampaignPaused(uint256 indexed campaignId, bool paused);
    event CampaignClosed(uint256 indexed campaignId);
    event PlatformTreasuryUpdated(address oldTreasury, address newTreasury);
    event PlatformFeeUpdated(uint16 oldFee, uint16 newFee);
    
    // ============ Modifiers ============
    
    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "Account is blacklisted");
        _;
    }
    
    modifier campaignExists(uint256 campaignId) {
        require(campaignId < _nextCampaignId, "Campaign does not exist");
        _;
    }
    
    modifier campaignActive(uint256 campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign is not active");
        require(!c.paused, "Campaign is paused");
        require(!c.closed, "Campaign is closed");
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
        
        _nextTokenId = 1;
        _nextCampaignId = 0;
    }
    
    // ============ Campaign Management ============
    
    function createCampaign(
        string memory category,
        string memory uri,
        uint256 goalNative,
        uint256 goalUsd,
        uint256 maxEditions,
        uint256 priceNative,
        uint256 priceUsd,
        address nonprofit,
        address submitter,
        bool immediatePayoutEnabled
    ) external onlyOwner returns (uint256) {
        require(nonprofit != address(0), "Invalid nonprofit");
        require(submitter != address(0), "Invalid submitter");
        require(maxEditions > 0, "Max editions must be > 0");
        
        uint256 campaignId = _nextCampaignId++;
        
        campaigns[campaignId] = Campaign({
            id: campaignId,
            category: category,
            baseURI: uri,
            goalNative: goalNative,
            goalUsd: goalUsd,
            grossRaised: 0,
            netRaised: 0,
            giftsReceived: 0,
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
    
    // ============ Minting Functions ============
    
    function mint(uint256 campaignId) external payable 
        nonReentrant 
        whenNotPaused 
        notBlacklisted(msg.sender)
        campaignExists(campaignId)
        campaignActive(campaignId)
        returns (uint256) 
    {
        return _mintInternal(campaignId, msg.value, 0);
    }
    
    function mintWithGift(uint256 campaignId, uint256 giftAmount) external payable 
        nonReentrant 
        whenNotPaused 
        notBlacklisted(msg.sender)
        campaignExists(campaignId)
        campaignActive(campaignId)
        returns (uint256) 
    {
        require(msg.value >= giftAmount, "Insufficient gift amount");
        return _mintInternal(campaignId, msg.value - giftAmount, giftAmount);
    }
    
    function _mintInternal(
        uint256 campaignId, 
        uint256 purchaseAmount, 
        uint256 giftAmount
    ) internal returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        
        require(c.editionsMinted < c.maxEditions, "Sold out");
        require(purchaseAmount >= c.priceNative, "Insufficient payment");
        
        // Mint NFT
        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[campaignId][tokenId] = editionNumber;
        
        // Track funds
        c.grossRaised += purchaseAmount;
        
        // Distribute NFT purchase funds
        if (c.immediatePayoutEnabled) {
            _distributeFunds(campaignId, purchaseAmount);
        } else {
            c.netRaised += purchaseAmount;
        }
        
        // Process gift if included
        if (giftAmount > 0) {
            _processGift(campaignId, giftAmount, "", "");
        }
        
        emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, purchaseAmount);
        
        return tokenId;
    }
    
    // ============ Gift Functions (V9 NEW) ============
    
    /**
     * @notice Give a gift to a campaign without purchasing an NFT
     * @param campaignId The campaign to gift to
     */
    function giveGift(uint256 campaignId) external payable 
        nonReentrant 
        whenNotPaused 
        notBlacklisted(msg.sender)
        campaignExists(campaignId)
        campaignActive(campaignId)
    {
        require(msg.value > 0, "Gift must be > 0");
        _processGift(campaignId, msg.value, "", "");
    }
    
    /**
     * @notice Give a gift with optional display name and message
     * @param campaignId The campaign to gift to
     * @param displayName Optional display name for anonymous giving
     * @param message Optional message to include with gift
     */
    function giveGiftWithMessage(
        uint256 campaignId, 
        string memory displayName,
        string memory message
    ) external payable 
        nonReentrant 
        whenNotPaused 
        notBlacklisted(msg.sender)
        campaignExists(campaignId)
        campaignActive(campaignId)
    {
        require(msg.value > 0, "Gift must be > 0");
        _processGift(campaignId, msg.value, displayName, message);
    }
    
    /**
     * @dev Internal gift processing with fee deductions
     * - 1% to platform treasury (immediate)
     * - 1% to nonprofit (immediate)
     * - 98% held on contract for manual distribution
     */
    function _processGift(
        uint256 campaignId, 
        uint256 giftAmount,
        string memory displayName,
        string memory message
    ) internal {
        Campaign storage c = campaigns[campaignId];
        
        // Calculate fees
        uint256 platformFee = (giftAmount * GIFT_PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 nonprofitFee = (giftAmount * GIFT_NONPROFIT_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netGift = giftAmount - platformFee - nonprofitFee;
        
        // Transfer fees immediately
        (bool s1,) = platformTreasury.call{value: platformFee}("");
        require(s1, "Platform fee transfer failed");
        
        (bool s2,) = c.nonprofit.call{value: nonprofitFee}("");
        require(s2, "Nonprofit fee transfer failed");
        
        // Hold net gift on contract for manual distribution
        campaignGiftBalance[campaignId] += netGift;
        campaignGiftCount[campaignId]++;
        c.giftsReceived += giftAmount;
        c.grossRaised += giftAmount;
        
        // Store gift details
        campaignGifts[campaignId].push(Gift({
            donor: msg.sender,
            amount: giftAmount,
            platformFee: platformFee,
            nonprofitFee: nonprofitFee,
            netAmount: netGift,
            timestamp: block.timestamp,
            displayName: displayName,
            message: message
        }));
        
        emit GiftReceived(
            campaignId, 
            msg.sender, 
            giftAmount, 
            platformFee, 
            nonprofitFee, 
            netGift,
            displayName
        );
    }
    
    /**
     * @notice Admin function to distribute held gifts
     * @param campaignId The campaign to distribute gifts for
     * @param submitterPercent Percentage to submitter (e.g., 8000 = 80%)
     */
    function distributeGifts(
        uint256 campaignId,
        uint256 submitterPercent
    ) external onlyOwner campaignExists(campaignId) {
        require(submitterPercent <= BPS_DENOMINATOR, "Invalid percent");
        
        uint256 balance = campaignGiftBalance[campaignId];
        require(balance > 0, "No gifts to distribute");
        
        Campaign storage c = campaigns[campaignId];
        
        uint256 toSubmitter = (balance * submitterPercent) / BPS_DENOMINATOR;
        uint256 toPlatform = balance - toSubmitter;
        
        // Clear balance before transfers
        campaignGiftBalance[campaignId] = 0;
        campaignGiftsDistributed[campaignId] += balance;
        
        // Transfer to submitter
        if (toSubmitter > 0) {
            (bool s1,) = c.submitter.call{value: toSubmitter}("");
            require(s1, "Submitter transfer failed");
        }
        
        // Transfer to platform
        if (toPlatform > 0) {
            (bool s2,) = platformTreasury.call{value: toPlatform}("");
            require(s2, "Platform transfer failed");
        }
        
        emit GiftsDistributed(campaignId, toSubmitter, toPlatform, submitterPercent);
    }
    
    // ============ NFT Fund Distribution ============
    
    function _distributeFunds(uint256 campaignId, uint256 amount) internal {
        Campaign storage c = campaigns[campaignId];
        
        uint256 platformFee = (amount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 submitterAmount = amount - platformFee;
        
        // Transfer to platform treasury
        (bool s1,) = platformTreasury.call{value: platformFee}("");
        require(s1, "Platform fee failed");
        
        // Transfer to submitter
        (bool s2,) = c.submitter.call{value: submitterAmount}("");
        require(s2, "Submitter payment failed");
        
        campaignDistributed[campaignId] += amount;
        
        emit FundsDistributed(campaignId, c.submitter, submitterAmount, platformFee);
    }
    
    function distributePendingFunds(uint256 campaignId) external onlyOwner campaignExists(campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(c.netRaised > 0, "No pending funds");
        
        uint256 amount = c.netRaised;
        c.netRaised = 0;
        
        _distributeFunds(campaignId, amount);
    }
    
    // ============ View Functions ============
    
    function getCampaign(uint256 campaignId) external view 
        campaignExists(campaignId) 
        returns (CampaignView memory) 
    {
        Campaign storage c = campaigns[campaignId];
        return CampaignView({
            id: c.id,
            category: c.category,
            baseURI: c.baseURI,
            goalNative: c.goalNative,
            goalUsd: c.goalUsd,
            grossRaised: c.grossRaised,
            netRaised: c.netRaised,
            giftsReceived: c.giftsReceived,
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
    
    function totalCampaigns() external view returns (uint256) {
        return _nextCampaignId;
    }
    
    function getGiftBalance(uint256 campaignId) external view returns (uint256) {
        return campaignGiftBalance[campaignId];
    }
    
    function getGiftHistory(uint256 campaignId) external view returns (Gift[] memory) {
        return campaignGifts[campaignId];
    }
    
    function getGiftCount(uint256 campaignId) external view returns (uint256) {
        return campaignGiftCount[campaignId];
    }
    
    // ============ Admin Functions ============
    
    function pauseCampaign(uint256 campaignId, bool paused) external onlyOwner campaignExists(campaignId) {
        campaigns[campaignId].paused = paused;
        emit CampaignPaused(campaignId, paused);
    }
    
    function closeCampaign(uint256 campaignId) external onlyOwner campaignExists(campaignId) {
        campaigns[campaignId].closed = true;
        emit CampaignClosed(campaignId);
    }
    
    function setImmediatePayoutEnabled(uint256 campaignId, bool enabled) external onlyOwner campaignExists(campaignId) {
        campaigns[campaignId].immediatePayoutEnabled = enabled;
    }
    
    function setPlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        emit PlatformTreasuryUpdated(platformTreasury, newTreasury);
        platformTreasury = newTreasury;
    }
    
    function setPlatformFeeBps(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "Fee too high");
        emit PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }
    
    function blacklistAddress(address account, bool status) external onlyOwner {
        blacklisted[account] = status;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Emergency Functions ============
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success,) = platformTreasury.call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    // ============ ERC721 Overrides ============
    
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        require(!frozenTokens[tokenId], "Token is frozen");
        
        address from = _ownerOf(tokenId);
        if (from != address(0) && soulbound[tokenId]) {
            require(to == address(0), "Soulbound token cannot be transferred");
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
    
    receive() external payable {}
}
