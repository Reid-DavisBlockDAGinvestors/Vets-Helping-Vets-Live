// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PatriotPledgeNFT is ERC721URIStorage, Ownable {
    uint256 public nextTokenId;
    address public nonprofit;
    uint96 public feeBps = 100; // 1%

    mapping(uint256 => uint8) public progress; // 0-100
    mapping(uint256 => string[]) public images; // additional media URIs
    mapping(uint256 => string) public category; // 'veteran' | 'general'

    // Oracle support for automated updates (e.g., Chainlink Automation/Functions)
    mapping(address => bool) public oracle;

    event Minted(address indexed creator, uint256 indexed tokenId, string uri, string category);
    event ProgressUpdated(uint256 indexed tokenId, uint8 progress);
    event ImageAdded(uint256 indexed tokenId, string uri);
    event UriUpdated(uint256 indexed tokenId, string uri);
    event MilestoneReleased(uint256 indexed tokenId, uint8 milestone, uint256 timestamp);

    constructor(address _nonprofit) ERC721("PatriotPledge", "PPLEDGE") Ownable(msg.sender) {
        nonprofit = _nonprofit;
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
        require(_isApprovedOrOwner(msg.sender, tokenId) || msg.sender == owner(), "not auth");
        _setTokenURI(tokenId, uri);
        emit UriUpdated(tokenId, uri);
    }

    function addImage(uint256 tokenId, string memory uri) external {
        require(_isApprovedOrOwner(msg.sender, tokenId) || msg.sender == owner(), "not auth");
        images[tokenId].push(uri);
        emit ImageAdded(tokenId, uri);
    }

    function setProgress(uint256 tokenId, uint8 p) external {
        require(_isApprovedOrOwner(msg.sender, tokenId) || msg.sender == owner(), "not auth");
        require(p <= 100, "range");
        progress[tokenId] = p;
        emit ProgressUpdated(tokenId, p);
    }

    // Oracle-controlled progress and milestone emission
    function oracleSetProgress(uint256 tokenId, uint8 p) external {
        require(oracle[msg.sender] || msg.sender == owner(), "not oracle");
        require(p <= 100, "range");
        progress[tokenId] = p;
        emit ProgressUpdated(tokenId, p);
    }

    function oracleReleaseMilestone(uint256 tokenId, uint8 milestone) external {
        require(oracle[msg.sender] || msg.sender == owner(), "not oracle");
        emit MilestoneReleased(tokenId, milestone, block.timestamp);
        // Placeholder: integrate release mechanics (escrow/vesting) via OZ Defender/Automation
    }
}
