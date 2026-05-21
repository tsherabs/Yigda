"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const linksByType = {
  admin: [{ href: "/admin", label: "Admin" }],
  org: [{ href: "/org", label: "Organization" }],
  company: [
    { href: "/company", label: "Company" },
    { href: "/company/verify", label: "Verify" }
  ],
  citizen: [
    { href: "/vault", label: "Vault" },
    { href: "/vault/share", label: "Share" }
  ]
};

export default function Navbar() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (mounted) setUser(data.user || null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/official/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  const links = user ? linksByType[user.type] || [] : [];
  const displayName = user?.cid ? `CID ${user.cid}` : user?.name;

  return (
    <nav className="nav">
      <Link className="brand" href="/">
        <span className="brandMark">Y</span>
        <span>Yigda</span>
      </Link>
      <div className="navLinks">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        {user ? (
          <>
            <span className="muted">{displayName}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <Link href="/official-login">Official Login</Link>
        )}
      </div>
    </nav>
  );
}
