export default function VerifyResult({ result }) {
  if (!result) return null;

  if (result.status === "VERIFIED") {
    return (
      <section className="panel resultVerified">
        <h2>Verified</h2>
        <p>This PDF matches a document issued on Yigda.</p>
        <div className="grid two" style={{ marginTop: 18 }}>
          <div>
            <strong>Issued by</strong>
            <p>{result.issuedBy || "Unknown"}</p>
          </div>
          <div>
            <strong>Document</strong>
            <p>{result.documentType || "Official Document"}</p>
          </div>
          <div>
            <strong>Recipient CID</strong>
            <p>{result.recipient || "Hidden"}</p>
          </div>
          <div>
            <strong>Network</strong>
            <p>{result.blockchainProof?.network}</p>
          </div>
        </div>
      </section>
    );
  }

  if (result.status === "REVOKED") {
    return (
      <section className="panel resultRevoked">
        <h2>Revoked</h2>
        <p>This document was issued but is no longer valid.</p>
        <div className="status error">Reason: {result.reason}</div>
      </section>
    );
  }

  return (
    <section className="panel resultFailed">
      <h2>Not Verified</h2>
      <p>{result.message || "This PDF was not found on Yigda."}</p>
    </section>
  );
}
