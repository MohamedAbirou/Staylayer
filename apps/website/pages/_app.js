import Layout from "@/components/layout/layout";
import "@/styles/globals.css";
import "@puckeditor/core/puck.css";

export default function App({ Component, pageProps }) {
  // Puck CMS pages include their own Navbar/Footer components —
  // skip the global Layout wrapper to avoid duplicates and container constraints.
  const isCmsPage = !!(pageProps.cmsPage?.puckData || pageProps.page?.puckData);

  if (isCmsPage) {
    return <Component {...pageProps} />;
  }

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
