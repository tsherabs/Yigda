import "./globals.css";

export const metadata = {
  title: "Yigda - Document Verification Platform",
  description: "Issue, share, and verify official documents on the blockchain."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
