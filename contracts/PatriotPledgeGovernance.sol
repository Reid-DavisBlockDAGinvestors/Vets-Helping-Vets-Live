// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PatriotPledgeGovernance is Ownable {
    struct Proposal {
        uint256 id;
        address creator;
        string title;
        string description;
        string category; // e.g., fee_adjustment, expand_disasters, expand_children
        uint256 yesVotes;
        uint256 noVotes;
        bool open;
        uint256 createdAt;
    }

    IERC20 public govToken;
    uint256 public nextId;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed id, address indexed creator, string title, string category);
    event Voted(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event Closed(uint256 indexed id);
    event Moderated(uint256 indexed id, bool open);

    constructor(address _govToken) Ownable(msg.sender) {
        govToken = IERC20(_govToken);
    }

    function createProposal(string memory title, string memory description, string memory category) external returns (uint256) {
        uint256 id = ++nextId;
        proposals[id] = Proposal({
            id: id,
            creator: msg.sender,
            title: title,
            description: description,
            category: category,
            yesVotes: 0,
            noVotes: 0,
            open: true,
            createdAt: block.timestamp
        });
        emit ProposalCreated(id, msg.sender, title, category);
        return id;
    }

    function vote(uint256 id, bool support) external {
        Proposal storage p = proposals[id];
        require(p.open, "closed");
        require(!hasVoted[id][msg.sender], "voted");
        uint256 weight = govToken.balanceOf(msg.sender);
        require(weight > 0, "no weight");
        if (support) p.yesVotes += weight; else p.noVotes += weight;
        hasVoted[id][msg.sender] = true;
        emit Voted(id, msg.sender, support, weight);
    }

    function close(uint256 id) external onlyOwner {
        Proposal storage p = proposals[id];
        require(p.open, "already");
        p.open = false;
        emit Closed(id);
    }

    function moderate(uint256 id, bool open) external onlyOwner {
        proposals[id].open = open;
        emit Moderated(id, open);
    }
}
