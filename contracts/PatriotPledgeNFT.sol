// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PatriotPledgeNFT is ERC721Enumerable, ERC721URIStorage, Ownable, ReentrancyGuard, ERC721Holder {
    uint256 public nextTokenId;
    uint256 public nextCampaignId;
    address public nonprofit;
    uint96 public feeBps = 100;

    mapping(uint256 => uint8) public progress;
    mapping(uint256 => string[]) public images;
    mapping(uint256 => string) public category;

    mapping(address => bool) public oracle;
    // Dedicated campaign progress (0-100) separate from per-token progress
    mapping(uint256 => uint8) public campaignProgress;

    struct Campaign {
        uint256 priceWei;
        uint256 goalWei;
        uint256 raisedWei;
        uint256 releasedWei;
        uint256 startTokenId;
        uint256 size;
        uint256 sold;
        address creator;
        string baseURI;
        string cat;
        bool active;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => uint256) public tokenCampaign; // tokenId => campaignId

    event Minted(address indexed creator, uint256 indexed tokenId, string uri, string category);
    event ProgressUpdated(uint256 indexed tokenId, uint8 progress);
    event ImageAdded(uint256 indexed tokenId, string uri);
    event UriUpdated(uint256 indexed tokenId, string uri);
    event MilestoneReleased(uint256 indexed tokenId, uint8 milestone, uint256 timestamp);

    event CampaignCreated(uint256 indexed campaignId, uint256 startTokenId, uint256 size, uint256 priceWei, uint256 goalWei, address indexed creator, string category);
    event NFTPurchased(uint256 indexed campaignId, uint256 indexed tokenId, address indexed buyer, uint256 priceWei);
    event FundsReleased(uint256 indexed campaignId, address indexed to, uint256 amountWei, uint256 feeWei, uint256 netWei, uint8 milestone);
    event CampaignProgressUpdated(uint256 indexed campaignId, uint8 progress);
    event TokenLinkedToCampaign(uint256 indexed tokenId, uint256 indexed campaignId);

    constructor(address _nonprofit, uint96 _feeBps) ERC721("PatriotPledge", "PPLEDGE") Ownable(msg.sender) {
        nonprofit = _nonprofit;
        feeBps = _feeBps;
    }

    function _isOwnerOrApproved(address spender, uint256 tokenId) internal view returns (bool) {
        address ownerAddr = ownerOf(tokenId);
        return (
            spender == ownerAddr ||
            spender == owner() ||
            getApproved(tokenId) == spender ||
            isApprovedForAll(ownerAddr, spender)
        );
    }

    function setFeeBps(uint96 bps) external onlyOwner { feeBps = bps; }
    function setNonprofit(address a) external onlyOwner { nonprofit = a; }
    function setOracle(address a, bool v) external onlyOwner { oracle[a] = v; }

    function mint(address to, string memory uri, string memory cat) external returns (uint256) {
        uint256 tokenId = ++nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        category[tokenId] = cat;
        emit Minted(to, tokenId, uri, cat);
        return tokenId;
    }

    function updateTokenURI(uint256 tokenId, string memory uri) external {
        require(_isOwnerOrApproved(msg.sender, tokenId), "not auth");
        _setTokenURI(tokenId, uri);
        emit UriUpdated(tokenId, uri);
    }

    function addImage(uint256 tokenId, string memory uri) external {
        require(_isOwnerOrApproved(msg.sender, tokenId), "not auth");
        images[tokenId].push(uri);
        emit ImageAdded(tokenId, uri);
    }

    function setProgress(uint256 tokenId, uint8 p) external {
        require(_isOwnerOrApproved(msg.sender, tokenId), "not auth");
        require(p <= 100, "range");
        progress[tokenId] = p;
        emit ProgressUpdated(tokenId, p);
    }

    function oracleSetProgress(uint256 tokenId, uint8 p) external {
        require(oracle[msg.sender] || msg.sender == owner(), "not oracle");
        require(p <= 100, "range");
        progress[tokenId] = p;
        emit ProgressUpdated(tokenId, p);
    }

    function mintSeries(
        uint256 size,
        uint256 priceWei,
        uint256 goalWei,
        address creator,
        string memory baseURI,
        string memory cat
    ) external onlyOwner returns (uint256 campaignId) {
        require(size > 0, "size");
        require(priceWei > 0, "price");
        campaignId = ++nextCampaignId;
        uint256 startId = nextTokenId + 1;
        campaigns[campaignId] = Campaign({
            priceWei: priceWei,
            goalWei: goalWei,
            raisedWei: 0,
            releasedWei: 0,
            startTokenId: startId,
            size: size,
            sold: 0,
            creator: creator,
            baseURI: baseURI,
            cat: cat,
            active: true
        });
        for (uint256 i = 0; i < size; i++) {
            uint256 tokenId = ++nextTokenId;
            _safeMint(address(this), tokenId);
            _setTokenURI(tokenId, baseURI);
            category[tokenId] = cat;
            tokenCampaign[tokenId] = campaignId;
            emit Minted(address(this), tokenId, baseURI, cat);
            emit TokenLinkedToCampaign(tokenId, campaignId);
        }
        emit CampaignCreated(campaignId, startId, size, priceWei, goalWei, creator, cat);
    }

    function setCampaignActive(uint256 campaignId, bool active) external onlyOwner {
        campaigns[campaignId].active = active;
    }

    function buy(uint256 campaignId) external payable nonReentrant returns (uint256 tokenId) {
        Campaign storage c = campaigns[campaignId];
        require(c.active, "inactive");
        require(c.sold < c.size, "sold out");
        require(msg.value == c.priceWei, "price");
        tokenId = c.startTokenId + c.sold;
        c.sold += 1;
        c.raisedWei += msg.value;
        _safeTransfer(address(this), msg.sender, tokenId, "");
        emit NFTPurchased(campaignId, tokenId, msg.sender, msg.value);
    }

    function releaseFunds(uint256 campaignId, uint256 amountWei, uint8 milestone) external nonReentrant {
        require(oracle[msg.sender] || msg.sender == owner(), "not oracle");
        Campaign storage c = campaigns[campaignId];
        uint256 available = c.raisedWei - c.releasedWei;
        require(amountWei <= available, "insufficient");
        uint256 fee = (amountWei * feeBps) / 10000;
        uint256 net = amountWei - fee;
        c.releasedWei += amountWei;
        (bool ok1, ) = payable(nonprofit).call{value: fee}("");
        require(ok1, "fee xfer");
        (bool ok2, ) = payable(c.creator).call{value: net}("");
        require(ok2, "net xfer");
        emit FundsReleased(campaignId, c.creator, amountWei, fee, net, milestone);
        emit MilestoneReleased(c.startTokenId, milestone, block.timestamp);
    }

    function updateCampaignProgress(uint256 campaignId, uint8 p) external {
        require(oracle[msg.sender] || msg.sender == owner(), "not oracle");
        require(p <= 100, "range");
        // store dedicated campaign progress
        campaignProgress[campaignId] = p;
        // also mirror to first token for compatibility with existing UIs
        uint256 tokenId = campaigns[campaignId].startTokenId;
        if (tokenId != 0) {
            progress[tokenId] = p;
        }
        emit CampaignProgressUpdated(campaignId, p);
    }

    function getCampaignProgress(uint256 campaignId) external view returns (uint8) {
        return campaignProgress[campaignId];
    }

    // Per-campaign enumeration helpers
    function totalSupplyInCampaign(uint256 campaignId) public view returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        return c.size;
    }

    function tokenIdInCampaignByIndex(uint256 campaignId, uint256 index) public view returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        require(index < c.size, "oob");
        return c.startTokenId + index;
    }

    function tokensOfCampaign(uint256 campaignId, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        Campaign storage c = campaigns[campaignId];
        require(offset < c.size, "offset");
        uint256 n = c.size - offset;
        if (n > limit) n = limit;
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = c.startTokenId + offset + i;
        }
    }

    function tokensOfOwnerInCampaign(address owner_, uint256 campaignId, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        Campaign storage c = campaigns[campaignId];
        require(offset < c.size, "offset");
        uint256 end = c.startTokenId + c.size;
        uint256 start = c.startTokenId + offset;
        uint256 count;
        // count matches up to limit
        for (uint256 t = start; t < end && count < limit; t++) {
            if (_ownerOf(t) == owner_) {
                count++;
            }
        }
        ids = new uint256[](count);
        uint256 j;
        for (uint256 t2 = start; t2 < end && j < count; t2++) {
            if (_ownerOf(t2) == owner_) {
                ids[j++] = t2;
            }
        }
    }

    // OpenZeppelin required overrides for multiple inheritance
    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 amount) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, amount);
    }
}
