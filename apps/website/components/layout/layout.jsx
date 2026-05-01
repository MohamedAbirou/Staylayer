import React, { useEffect, useState } from "react";
import Navbar from "./navbar";
import Footer from "./footer";
import GoogleTagScript from "../googleTagScript";
import ClarityScript from "../clarityScript";
import { fetchSettings } from "@/lib/cmsClient";

export default function Layout({ children }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSettings().then((s) => setSettings(s));
  }, []);

  return (
    <>
      <Navbar />
      <GoogleTagScript
        gaId={settings?.gaTrackingId || ""}
        gtmId={settings?.gtmContainerId || ""}
      />
      <ClarityScript clarityId={settings?.clarityId || ""} />
      <div className="min-h-screen flex justify-center">
        <div className="container ">{children}</div>
      </div>
      <Footer />
    </>
  );
}
