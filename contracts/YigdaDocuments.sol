// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract YigdaDocuments {
    struct Document {
        bool exists;
        bool revoked;
        string orgId;
        string cid;
        uint256 timestamp;
        string revokeReason;
    }

    mapping(string => Document) private documents;
    address public owner;

    event DocumentAnchored(string indexed docHash, string cid, string orgId, uint256 timestamp);
    event DocumentRevoked(string indexed docHash, string reason, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    function anchorDocument(
        string memory cid,
        string memory docHash,
        string memory orgId
    ) public onlyOwner {
        require(!documents[docHash].exists, "Document already anchored");
        documents[docHash] = Document(true, false, orgId, cid, block.timestamp, "");
        emit DocumentAnchored(docHash, cid, orgId, block.timestamp);
    }

    function revokeDocument(
        string memory docHash,
        string memory reason
    ) public onlyOwner {
        require(documents[docHash].exists, "Document not found");
        require(!documents[docHash].revoked, "Already revoked");
        documents[docHash].revoked = true;
        documents[docHash].revokeReason = reason;
        emit DocumentRevoked(docHash, reason, block.timestamp);
    }

    function verifyDocument(string memory docHash)
        public
        view
        returns (
            bool exists,
            bool revoked,
            string memory orgId,
            string memory cid,
            uint256 timestamp,
            string memory revokeReason
        )
    {
        Document memory doc = documents[docHash];
        return (doc.exists, doc.revoked, doc.orgId, doc.cid, doc.timestamp, doc.revokeReason);
    }
}
