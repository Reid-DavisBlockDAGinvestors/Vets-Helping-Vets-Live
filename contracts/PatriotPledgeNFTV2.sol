// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PatriotPledgeNFTV2 is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    struct Campaign {
        string category;
        uint256 goal;
        uint256 raised;
    }

    mapping(uint256 => Campaign) public campaigns;

    event TokenURIUpdated(uint256 indexed tokenId, string newUri);

    constructor() ERC721("Patriot Pledge NFT", "PPNFT") Ownable(msg.sender) {}

    function mint(
        address to,
        string calldata uri,
        string calldata category,
        uint256 goal
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        campaigns[tokenId] = Campaign(category, goal, 0);
        return tokenId;
    }

    function updateTokenURI(uint256 tokenId, string calldata newUri) external onlyOwner {
        _setTokenURI(tokenId, newUri);
        emit TokenURIUpdated(tokenId, newUri);
    }

    function addRaised(uint256 tokenId, uint256 amount) external onlyOwner {
        campaigns[tokenId].raised += amount;
    }

    function burn(uint256 tokenId) external onlyOwner {
        delete campaigns[tokenId];
        _burn(tokenId);
    }

    // The following functions are overrides required by Solidity multiple inheritance
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