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
 * @title PatriotPledgeNFTV6
 * @author PatriotPledge Team
 * @notice Edition-based fundraiser NFTs with full admin control and modern standards
 * @dev Complete NFT management system with:
 *      - EIP-2981 Royalties for marketplace support
 *      - Pausable for emergency stops
 *      - Token freezing for compliance
 *      - Address blacklisting for security
 *      - Full campaign editing capabilities
 *      - Batch operations for efficiency
 *      - Token burning for cleanup
 *      - ReentrancyGuard for security
 * 
 * V6 Changes from V5:
 * - Added EIP-2981 royalties
 * - Added Pausable (emergency stop)
 * - Added ReentrancyGuard (security)
 * - Added token burning (burn/adminBurn)
 * - Added token freezing (freeze transfers)
 * - Added address blacklisting
 * - Added campaign editing functions
 * - Added treasury management
 * - Added metadata refresh events (ERC-4906)
 * - Added setTokenURI for URI fixes
 * - Added batch operations
 */
contract PatriotPledgeNFTV6 is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    ERC721Royalty,
    Ownable, 
    Pausable,
    ReentrancyGuard 
{
    // ============ State Variables ============
    
    uint256 private _nextTokenId;
    uint256 private _nextCampaignId;
    
    // Treasury for fund management
    address public treasury;
    
    // Default royalty (can be overridden per-token)
    uint96 public defaultRoyaltyBps = 250; // 2.5%
    
    // Token freezing (prevents transfers)
    mapping(uint256 => bool) public frozenTokens;
    
    // Address blacklist (prevents minting/transfers)
    mapping(address => bool) public blacklisted;
    
    // Soulbound tokens (non-transferable)
    mapping(uint256 => bool) public soulbound;

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
        uint256 nonprofitFeeRate;
        address nonprofit;
        address submitter;
        bool active;
        bool closed;
        bool refunded;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => uint256) public tokenToCampaign;
    mapping(uint256 => uint256) public tokenEditionNumber;
    mapping(uint256 => uint256[]) public campaignEditions;

    // ============ Events ============
    
    // Campaign events
    event CampaignCreated(uint256 indexed campaignId, address indexed nonprofit, string category, uint256 goal, uint256 maxEditions, uint256 pricePerEdition);
    event CampaignUpdated(uint256 indexed campaignId, string field);
    event CampaignMetadataUpdated(uint256 indexed campaignId, string newBaseURI);
    event CampaignClosed(uint256 indexed campaignId);
    event CampaignRefunded(uint256 indexed campaignId);
    event ContributionRecorded(uint256 indexed campaignId, uint256 gross, uint256 net, uint256 tip, bool isOnchain);
    
    // Token events
    event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed donor, uint256 editionNumber, uint256 amountPaid);
    event TokenURIFixed(uint256 indexed tokenId, string newURI);
    event TokenBurned(uint256 indexed tokenId, address indexed burner);
    event TokenFrozen(uint256 indexed tokenId, bool frozen);
    event TokenSoulbound(uint256 indexed tokenId, bool soulbound);
    
    // Note: MetadataUpdate and BatchMetadataUpdate events are inherited from IERC4906 via ERC721URIStorage
    
    // Admin events
    event AddressBlacklisted(address indexed addr, bool blacklisted);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DefaultRoyaltyUpdated(uint96 newRoyaltyBps);
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
    
    modifier tokenNotSoulbound(uint256 tokenId) {
        require(!soulbound[tokenId], "Token is soulbound");
        _;
    }

    // ============ Constructor ============
    
    constructor() ERC721("PatriotPledge Edition", "PPE") Ownable(msg.sender) {
        treasury = msg.sender;
        _setDefaultRoyalty(msg.sender, defaultRoyaltyBps);
    }

    // ============ Pausable Functions ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
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
    
    /**
     * @notice Token owner can burn their own token
     */
    function burn(uint256 tokenId) external {
        require(_ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!frozenTokens[tokenId], "Token is frozen");
        _burn(tokenId);
        emit TokenBurned(tokenId, msg.sender);
    }
    
    /**
     * @notice Admin can force burn any token
     */
    function adminBurn(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        address owner = _ownerOf(tokenId);
        _burn(tokenId);
        emit TokenBurned(tokenId, owner);
    }

    // ============ Treasury & Royalty Management ============
    
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
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

    // ============ Admin Fix Functions ============

    /**
     * @notice Admin function to set tokenURI for a specific token
     * @dev Used to fix tokens that were minted without proper URI
     * @param tokenId The token to fix
     * @param uri The IPFS URI to set
     */
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _setTokenURI(tokenId, uri);
        emit TokenURIFixed(tokenId, uri);
    }

    /**
     * @notice Batch set tokenURI for multiple tokens
     * @param tokenIds Array of token IDs to fix
     * @param uri The IPFS URI to set for all tokens
     */
    function batchSetTokenURI(uint256[] calldata tokenIds, string calldata uri) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                _setTokenURI(tokenIds[i], uri);
                emit TokenURIFixed(tokenIds[i], uri);
            }
        }
    }

    /**
     * @notice Fix token-campaign link by adding token to campaignEditions array
     * @dev Used to repair tokens that weren't properly added to the array
     * @param tokenId The token to link
     * @param campaignId The campaign it belongs to
     */
    function fixTokenCampaignLink(uint256 tokenId, uint256 campaignId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        // Update mapping
        tokenToCampaign[tokenId] = campaignId;
        
        // Check if already in array
        uint256[] storage editions = campaignEditions[campaignId];
        for (uint256 i = 0; i < editions.length; i++) {
            if (editions[i] == tokenId) return; // Already linked
        }
        
        // Add to array
        editions.push(tokenId);
    }

    /**
     * @notice Batch fix token-campaign links
     * @param tokenIds Array of token IDs
     * @param campaignId The campaign they belong to
     */
    function batchFixTokenCampaignLink(uint256[] calldata tokenIds, uint256 campaignId) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                tokenToCampaign[tokenIds[i]] = campaignId;
                
                // Check if already in array
                uint256[] storage editions = campaignEditions[campaignId];
                bool found = false;
                for (uint256 j = 0; j < editions.length; j++) {
                    if (editions[j] == tokenIds[i]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    editions.push(tokenIds[i]);
                }
            }
        }
    }

    // ============ Campaign Management ============

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
            closed: false,
            refunded: false
        });

        emit CampaignCreated(campaignId, msg.sender, category, goal, maxEditions, pricePerEdition);
        return campaignId;
    }

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

    function mintWithBDAG(uint256 campaignId) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        require(msg.value >= c.pricePerEdition, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        c.grossRaised += msg.value;
        c.netRaised += msg.value;
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, c.baseURI);
        
        tokenToCampaign[tokenId] = campaignId;
        tokenEditionNumber[tokenId] = editionNumber;
        campaignEditions[campaignId].push(tokenId);

        emit EditionMinted(campaignId, tokenId, msg.sender, editionNumber, msg.value);
        emit ContributionRecorded(campaignId, msg.value, msg.value, 0, true);
        
        return tokenId;
    }

    function mintWithBDAGAndTip(uint256 campaignId, uint256 tipAmount) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(c.maxEditions == 0 || c.editionsMinted < c.maxEditions, "Max editions reached");
        require(msg.value >= c.pricePerEdition + tipAmount, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        uint256 editionNumber = ++c.editionsMinted;
        
        uint256 contribution = msg.value - tipAmount;
        
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

    // ============ Batch Minting (V6 Addition) ============

    /**
     * @notice Mint multiple NFTs in a single transaction
     * @param campaignId The campaign to mint from
     * @param quantity Number of NFTs to mint
     * @return tokenIds Array of minted token IDs
     */
    function mintBatchWithBDAG(uint256 campaignId, uint256 quantity) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant returns (uint256[] memory tokenIds) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(quantity > 0 && quantity <= 50, "Invalid quantity (1-50)");
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
        c.netRaised += totalPaid;
        emit ContributionRecorded(campaignId, totalPaid, totalPaid, 0, true);
        
        return tokenIds;
    }

    /**
     * @notice Mint multiple NFTs with tip in a single transaction
     * @param campaignId The campaign to mint from
     * @param quantity Number of NFTs to mint
     * @param tipAmount Total tip amount (not per NFT)
     * @return tokenIds Array of minted token IDs
     */
    function mintBatchWithBDAGAndTip(uint256 campaignId, uint256 quantity, uint256 tipAmount) external payable whenNotPaused notBlacklisted(msg.sender) nonReentrant returns (uint256[] memory tokenIds) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "Campaign not active");
        require(!c.closed, "Campaign closed");
        require(!c.refunded, "Campaign refunded");
        require(quantity > 0 && quantity <= 50, "Invalid quantity (1-50)");
        require(c.maxEditions == 0 || c.editionsMinted + quantity <= c.maxEditions, "Exceeds max editions");
        require(msg.value >= (c.pricePerEdition * quantity) + tipAmount, "Insufficient payment");

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
        c.netRaised += contribution;
        c.tipsReceived += tipAmount;
        emit ContributionRecorded(campaignId, totalPaid, contribution, tipAmount, true);
        
        return tokenIds;
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
        c.submitter = newSubmitter;
        emit CampaignUpdated(campaignId, "submitter");
    }

    function updateCampaignCategory(uint256 campaignId, string calldata newCategory) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        c.category = newCategory;
        emit CampaignUpdated(campaignId, "category");
    }

    function updateCampaignFeeRate(uint256 campaignId, uint256 newFeeRate) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(!c.closed, "Campaign closed");
        require(newFeeRate <= 10000, "Fee rate cannot exceed 100%");
        c.nonprofitFeeRate = newFeeRate;
        emit CampaignUpdated(campaignId, "nonprofitFeeRate");
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
        bool active,
        bool closed
    ) {
        Campaign storage c = campaigns[campaignId];
        return (c.category, c.baseURI, c.goal, c.grossRaised, c.netRaised, c.editionsMinted, c.maxEditions, c.pricePerEdition, c.active, c.closed);
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

    // ============ Withdraw ============

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        to.transfer(amount);
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

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        payable(treasury).transfer(balance);
        emit EmergencyWithdraw(treasury, balance);
    }

    // ============ Required Overrides ============

    /**
     * @dev Override _update to enforce freeze, soulbound, and blacklist checks
     */
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
