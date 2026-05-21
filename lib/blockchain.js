import { ethers } from "ethers";
import { sha256Hex } from "@/lib/crypto";

const ABI = [
  "function anchorDocument(string cid, string docHash, string orgId) public",
  "function revokeDocument(string docHash, string reason) public",
  "function verifyDocument(string docHash) public view returns (bool exists, bool revoked, string orgId, string cid, uint256 timestamp, string revokeReason)"
];

function hasBlockchainConfig() {
  return Boolean(process.env.BLOCKCHAIN_RPC_URL && process.env.WALLET_PRIVATE_KEY && process.env.CONTRACT_ADDRESS);
}

function contract() {
  if (!hasBlockchainConfig()) return null;
  const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);
}

export function hashPDF(buffer) {
  return sha256Hex(buffer);
}

export async function anchorDocumentHash(cid, docHash, orgId) {
  const instance = contract();
  if (!instance) return null;
  const tx = await instance.anchorDocument(String(cid), String(docHash), String(orgId));
  await tx.wait();
  return tx.hash;
}

export async function revokeDocumentHash(docHash, reason) {
  const instance = contract();
  if (!instance) return null;
  const tx = await instance.revokeDocument(String(docHash), String(reason || ""));
  await tx.wait();
  return tx.hash;
}

export async function verifyDocumentHash(docHash) {
  const instance = contract();
  if (!instance) return null;
  const result = await instance.verifyDocument(String(docHash));
  return {
    exists: result.exists,
    revoked: result.revoked,
    orgId: result.orgId,
    cid: result.cid,
    timestamp: Number(result.timestamp),
    revokeReason: result.revokeReason
  };
}
